# ⚡ Lead Qualifier — Forward Deployed AI Engine

Production-ready B2B Lead Qualification application with a **Next.js** frontend and a **Python (FastAPI)** serverless backend.

The engine asynchronously scrapes target company websites using `httpx` and `BeautifulSoup4` with **resilient exponential backoff retry** via `tenacity`, then passes the sanitised content to Google Gemini to extract strictly structured JSON matching a Pydantic schema.

---

## 🏗 Architecture

```
lead-qualifier/
├── api/
│   ├── index.py              # FastAPI serverless app, scraper & Gemini extraction engine
│   └── requirements.txt      # Python dependencies
├── app/
│   ├── layout.tsx            # Global layout with Geist fonts & dark theme
│   ├── globals.css           # Tailwind CSS directives
│   └── page.tsx              # Modern dashboard, URL input, stepper & results data table
├── next.config.mjs           # Next.js API rewrites to Python FastAPI backend
├── .env.example              # Template environment variables
├── .env                      # Local environment configuration
└── package.json              # Node dependencies and execution scripts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10+)

### 2. Configure Environment Variables
Verify your `.env` file in the project root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
NOTION_API_KEY=your_notion_api_key_here
```

### 3. Run the Development Servers

Open two terminals:

#### Terminal 1 — Start the Python FastAPI Engine:
```bash
# Windows
.\venv\Scripts\uvicorn.exe api.index:app --reload --port 8000

# macOS / Linux
./venv/bin/uvicorn api.index:app --reload --port 8000
```
*(Or run `npm run dev:backend`)*

#### Terminal 2 — Start the Next.js Frontend:
```bash
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔍 Extracted Pydantic Schema

Every qualified lead conforms strictly to:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `company_size` | `string` | Estimated employee range (e.g., `'1000+'`, `'51-200'`) |
| `core_product` | `string` | Concise description of primary product/platform |
| `is_b2b` | `boolean` | `true` if business-to-business; `false` if consumer |
| `qualification_score` | `integer` (1-10) | Enterprise B2B fit & readiness score |

---

## 📡 API Endpoints

- `POST /api/qualify` (or `/qualify`)
  - Payload: `{ "url": "https://stripe.com" }`
  - Response:
    ```json
    {
      "success": true,
      "url": "https://stripe.com",
      "page_title": "Stripe | Financial Infrastructure to Grow Your Revenue",
      "data": {
        "company_size": "1000+",
        "core_product": "Stripe provides a global financial infrastructure...",
        "is_b2b": true,
        "qualification_score": 10
      },
      "raw_text_length": 14250
    }
    ```
- `GET /api/health`
  - Health check and environment verification.
