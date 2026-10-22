import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

interface LeadData {
  company_size: string;
  core_product: string;
  is_b2b: boolean;
  qualification_score: number;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Resilient scraper with exponential backoff retry (3 attempts)
async function fetchWithRetry(url: string, attempts = 3): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        // Exponential backoff delay: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  throw lastErr;
}

// Clean DOM content with cheerio (exact equivalent of BeautifulSoup)
function cleanHtmlContent(html: string): { title: string; cleanedText: string } {
  const $ = cheerio.load(html);

  // Extract Title
  let title = $("title").first().text().trim();
  if (!title) {
    title = $("h1").first().text().trim();
  }

  // Extract Meta description
  const metaDesc =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  // Decompose unneeded tags
  $("script, style, noscript, svg, nav, footer, aside, header, form, iframe").remove();

  // Find main body
  const mainElem = $("main, article, #content, body").first();
  const rawText = (mainElem.length ? mainElem.text() : $("body").text()) || "";

  // Normalize whitespace
  const cleanedText = rawText.replace(/\s+/g, " ").trim().slice(0, 15000);

  const combinedContent = `Page Title: ${title}\nMeta Description: ${metaDesc}\n\nMain Content:\n${cleanedText}`;
  return { title, cleanedText: combinedContent };
}

const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
];

async function extractLeadWithGemini(
  content: string,
  apiKey: string
): Promise<LeadData> {
  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `You are an expert Forward Deployed Engineer and B2B Revenue Operations specialist evaluating corporate leads.
Analyze the following scraped company website text and extract the structured lead qualification data.

Strictly adhere to these guidelines:
1. company_size: Estimate employee count range (e.g., '1-10', '11-50', '51-200', '201-1000', '1000+').
2. core_product: Provide a crisp, 1-2 sentence description of their primary product, platform, or service.
3. is_b2b: Return true if their primary customer base is other businesses or enterprises; false if B2C / direct-to-consumer.
4. qualification_score: Rate lead quality on an integer scale of 1 to 10 for enterprise B2B sales potential:
   - 9-10: Established B2B scaleup/enterprise with clear ROI, active hiring, enterprise pricing.
   - 6-8: Promising B2B company, active product, clear value proposition.
   - 3-5: Early-stage project, unclear monetization, niche utility, or mixed B2B/B2C.
   - 1-2: Pure consumer app, defunct website, student project, parked domain, or scam.

Website Content:
${content}`;

  let lastError: unknown;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              company_size: { type: SchemaType.STRING },
              core_product: { type: SchemaType.STRING },
              is_b2b: { type: SchemaType.BOOLEAN },
              qualification_score: { type: SchemaType.INTEGER },
            },
            required: [
              "company_size",
              "core_product",
              "is_b2b",
              "qualification_score",
            ],
          },
          temperature: 0.1,
        },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text);

      return {
        company_size: String(parsed.company_size || "Unknown"),
        core_product: String(parsed.core_product || ""),
        is_b2b: Boolean(parsed.is_b2b),
        qualification_score: Math.max(
          1,
          Math.min(10, Math.round(Number(parsed.qualification_score) || 5))
        ),
      };
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw new Error(`Gemini LLM extraction failed: ${String(lastError)}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let targetUrl = (body.url || "").trim();

    if (!targetUrl) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    // Try delegating to local Python backend if available
    if (process.env.NODE_ENV === "development") {
      try {
        const pythonRes = await fetch("http://127.0.0.1:8000/api/qualify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(2000), // Quick check
        });
        if (pythonRes.ok) {
          const data = await pythonRes.json();
          return NextResponse.json(data);
        }
      } catch {
        // Fall through to native production engine
      }
    }

    const apiKey =
      body.api_key ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";

    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY to your environment variables on Vercel/Netlify or in .env",
        },
        { status: 400 }
      );
    }

    // Step 1: Scrape
    let html = "";
    try {
      html = await fetchWithRetry(targetUrl);
    } catch (err) {
      return NextResponse.json(
        {
          error: `Failed to scrape website after 3 retry attempts: ${String(
            err
          )}`,
        },
        { status: 502 }
      );
    }

    // Step 2: Clean content
    const { title, cleanedText } = cleanHtmlContent(html);
    if (cleanedText.length < 50) {
      return NextResponse.json(
        { error: "Scraped page contained insufficient readable text to qualify." },
        { status: 422 }
      );
    }

    // Step 3: LLM Extraction
    const data = await extractLeadWithGemini(cleanedText, apiKey);

    return NextResponse.json({
      success: true,
      url: targetUrl,
      page_title: title,
      data,
      raw_text_length: cleanedText.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
