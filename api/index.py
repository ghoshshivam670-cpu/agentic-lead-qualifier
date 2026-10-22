import os
import json
import re
import warnings
from typing import Optional, Dict, Any, List

# Suppress SDK deprecation notices
warnings.filterwarnings("ignore", category=FutureWarning)

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from bs4 import BeautifulSoup
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import google.generativeai as genai

# Load environment variables (override allows .env to take precedence over stale process variables)
load_dotenv(override=True)

# Strict Pydantic schema for LLM extraction
class LeadQualification(BaseModel):
    company_size: str = Field(
        ...,
        description="Estimated company size category (e.g., '1-10', '11-50', '51-200', '201-1000', '1000+').",
    )
    core_product: str = Field(
        ...,
        description="Clear and concise summary of the company's core product, platform, or service offering.",
    )
    is_b2b: bool = Field(
        ...,
        description="True if the company primarily serves other businesses (B2B), False if consumer-facing (B2C) or non-commercial.",
    )
    qualification_score: int = Field(
        ...,
        description="Lead qualification score on a strict integer scale of 1 to 10 based on B2B readiness, market fit, product maturity, and enterprise value.",
    )

    @field_validator("qualification_score")
    @classmethod
    def clamp_score(cls, v: int) -> int:
        return max(1, min(10, v))

class QualifyRequest(BaseModel):
    url: str
    api_key: Optional[str] = None

class QualifyResponse(BaseModel):
    success: bool
    url: str
    page_title: Optional[str] = None
    data: Optional[LeadQualification] = None
    raw_text_length: Optional[int] = None
    error: Optional[str] = None

app = FastAPI(
    title="Lead Qualifier FDE Engine",
    description="Production-ready asynchronous web scraper and Gemini-powered B2B lead qualifier",
    version="1.0.0",
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Browser Headers for resilient web scraping
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Not-A.Brand";v="99", "Chromium";v="124"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
}

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
    reraise=True,
)
async def fetch_html_with_retry(url: str) -> str:
    """
    Asynchronously fetch target website HTML with Tenacity exponential backoff retry.
    Retries up to 3 times on connection drops or temporary HTTP status errors.
    """
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(15.0, connect=5.0),
        follow_redirects=True,
        headers=BROWSER_HEADERS,
        verify=False,
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.text

def clean_scraped_content(html: str) -> tuple[str, str]:
    """
    Extract meaningful body content, titles, and meta descriptions using BeautifulSoup,
    stripping boilerplate scripts, styles, navigation, and SVG elements.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Extract Page Title
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    elif soup.find("h1"):
        title = soup.find("h1").get_text(strip=True)

    # Extract Meta description
    meta_desc = ""
    meta_tag = soup.find("meta", attrs={"name": "description"}) or soup.find(
        "meta", attrs={"property": "og:description"}
    )
    if meta_tag and meta_tag.get("content"):
        meta_desc = meta_tag.get("content").strip()

    # Remove non-text elements
    for element in soup(["script", "style", "noscript", "svg", "nav", "footer", "aside", "header", "form"]):
        element.decompose()

    # Locate main body containers
    main_container = soup.find("main") or soup.find("article") or soup.find(id="content") or soup.body
    if not main_container:
        main_container = soup

    # Get clean text
    lines = (line.strip() for line in main_container.get_text().splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    clean_text = " ".join(chunk for chunk in chunks if chunk)

    combined_content = f"Page Title: {title}\nMeta Description: {meta_desc}\n\nMain Content:\n{clean_text}"
    return title, combined_content[:15000]

CANDIDATE_MODELS = [
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-pro-latest",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]

def qualify_with_gemini(text: str, api_key: str) -> LeadQualification:
    """
    Query Gemini LLM with strict JSON schema enforcing LeadQualification Pydantic model.
    Tries candidate models with response_schema, with robust fallbacks.
    """
    genai.configure(api_key=api_key)

    prompt = f"""
You are an expert Forward Deployed Engineer and B2B Revenue Operations specialist evaluating corporate leads.
Analyze the following scraped company website text and extract the structured lead qualification data.

Strictly adhere to these guidelines:
1. `company_size`: Estimate employee count range (e.g., '1-10', '11-50', '51-200', '201-1000', '1000+').
2. `core_product`: Provide a crisp, 1-2 sentence description of their primary product, platform, or service.
3. `is_b2b`: Return true if their primary customer base is other businesses or enterprises; false if B2C / direct-to-consumer.
4. `qualification_score`: Rate lead quality on an integer scale of 1 to 10 for enterprise B2B sales potential:
   - 9-10: Established B2B scaleup/enterprise with clear ROI, active hiring/careers, enterprise tier pricing, modern tech stack.
   - 6-8: Promising B2B company, active product, clear value proposition, mid-market appeal.
   - 3-5: Early-stage project, unclear monetization, niche utility, or mixed B2B/B2C.
   - 1-2: Pure consumer app, defunct website, student project, parked domain, or scam.

Website Content:
{text}
"""

    last_error = None
    for model_name in CANDIDATE_MODELS:
        # Attempt 1: Structured output schema
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=LeadQualification,
                    temperature=0.1,
                ),
            )
            response = model.generate_content(prompt)
            data = json.loads(response.text.strip())
            return LeadQualification(**data)
        except Exception as e:
            last_error = e

        # Attempt 2: Fallback prompt without response_schema
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            fallback_prompt = (
                prompt
                + "\n\nRespond ONLY with a valid JSON object matching this schema:\n"
                + json.dumps(LeadQualification.model_json_schema(), indent=2)
            )
            response = model.generate_content(fallback_prompt)
            text_resp = response.text.strip()
            if text_resp.startswith("```"):
                text_resp = re.sub(r"^```(?:json)?\n?", "", text_resp)
                text_resp = re.sub(r"\n?```$", "", text_resp)
            data = json.loads(text_resp.strip())
            return LeadQualification(**data)
        except Exception as e:
            last_error = e
            continue

    raise RuntimeError(f"All Gemini model candidate extractions failed: {str(last_error)}")

def get_active_gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
    if not key or key == "your_gemini_api_key_here":
        return ""
    return key

async def process_qualification(url: str, request_key: Optional[str] = None) -> QualifyResponse:
    # Normalize URL
    target_url = url.strip()
    if not target_url.startswith("http://") and not target_url.startswith("https://"):
        target_url = "https://" + target_url

    gemini_key = (request_key or "").strip() or get_active_gemini_key()
    if not gemini_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GEMINI_API_KEY is not configured. Please set a valid Gemini API key in your .env file.",
        )

    # Step 1: Scrape with Tenacity retry
    try:
        html = await fetch_html_with_retry(target_url)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to scrape website after 3 retry attempts: {str(e)}",
        )

    # Step 2: Parse and clean content
    title, cleaned_text = clean_scraped_content(html)
    if len(cleaned_text.strip()) < 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Scraped page contained insufficient readable text to qualify.",
        )

    # Step 3: LLM Extraction
    try:
        qualification = qualify_with_gemini(cleaned_text, gemini_key)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gemini LLM extraction failed: {str(e)}",
        )

    return QualifyResponse(
        success=True,
        url=target_url,
        page_title=title,
        data=qualification,
        raw_text_length=len(cleaned_text),
    )

# Endpoints mounted on both /api/qualify and /qualify
@app.post("/api/qualify", response_model=QualifyResponse)
async def qualify_endpoint_api(payload: QualifyRequest):
    return await process_qualification(payload.url, payload.api_key)

@app.post("/qualify", response_model=QualifyResponse)
async def qualify_endpoint(payload: QualifyRequest):
    return await process_qualification(payload.url, payload.api_key)

# Health checks
@app.get("/api/health")
@app.get("/health")
@app.get("/")
async def health_check():
    has_gemini = bool(get_active_gemini_key())
    return {
        "status": "healthy",
        "service": "Lead Qualifier Engine",
        "gemini_api_key_configured": has_gemini,
    }
