"use client";

import React, { useState } from "react";
import {
  Globe,
  Search,
  Sparkles,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertCircle,
  Code2,
  Copy,
  Check,
  RotateCcw,
  Zap,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

interface LeadData {
  company_size: string;
  core_product: string;
  is_b2b: boolean;
  qualification_score: number;
}

interface QualifyResult {
  success: boolean;
  url: string;
  page_title?: string;
  data?: LeadData;
  raw_text_length?: number;
  error?: string;
  timestamp: string;
}

const SAMPLE_URLS = [
  { label: "Stripe", url: "https://stripe.com" },
  { label: "Linear", url: "https://linear.app" },
  { label: "Notion", url: "https://notion.so" },
  { label: "Resend", url: "https://resend.com" },
  { label: "Spotify", url: "https://spotify.com" },
];

export default function LeadQualifierPage() {
  const [urlInput, setUrlInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [currentResult, setCurrentResult] = useState<QualifyResult | null>(null);
  const [history, setHistory] = useState<QualifyResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "json">("table");

  const runQualification = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;

    let formattedUrl = targetUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = "https://" + formattedUrl;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setLoadingStep(1);

    // Dynamic step simulator for rich user feedback
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1800);

    try {
      const response = await fetch("/api/qualify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: formattedUrl }),
      });

      clearInterval(stepInterval);

      // Check if response is valid JSON or an HTML error page (e.g. proxy failure)
      const contentType = response.headers.get("content-type") || "";
      let resData: any = null;

      if (contentType.includes("application/json")) {
        resData = await response.json();
      } else {
        await response.text();
        throw new Error(
          "FastAPI backend is offline or unreachable on port 8000. Please start the backend service using: npm run dev:backend"
        );
      }

      if (!response.ok) {
        throw new Error(resData?.detail || resData?.error || `HTTP error ${response.status}`);
      }

      const result: QualifyResult = {
        ...resData,
        timestamp: new Date().toLocaleTimeString(),
      };

      setCurrentResult(result);
      setHistory((prev) => [result, ...prev.filter((item) => item.url !== result.url)]);
    } catch (err: unknown) {
      clearInterval(stepInterval);
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runQualification(urlInput);
  };

  const handleCopyJson = () => {
    if (!currentResult?.data) return;
    navigator.clipboard.writeText(JSON.stringify(currentResult.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreBadge = (score: number) => {
    if (score >= 8) {
      return {
        bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        label: "Tier 1 Enterprise Lead",
        barColor: "bg-emerald-500",
      };
    }
    if (score >= 5) {
      return {
        bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
        label: "Mid-Market Qualified",
        barColor: "bg-amber-500",
      };
    }
    return {
      bg: "bg-rose-500/10 border-rose-500/30 text-rose-400",
      label: "Low Fit / Non-B2B",
      barColor: "bg-rose-500",
    };
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-sky-500/15 to-transparent blur-3xl opacity-70" />
      </div>

      {/* Top Navigation Bar with View Architecture Button */}
      <nav className="w-full border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold tracking-tight text-sm text-slate-200">
              LeadQualifier
            </span>
          </div>

          <a
            href="https://github.com/ghoshshivam670-cpu/agentic-lead-qualifier"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 transition-colors shadow-sm"
          >
            <span>View Architecture</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </nav>

      <div className="relative w-full max-w-5xl px-4 py-12 md:py-16 space-y-8">
        {/* Top Header */}
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Autonomous Lead Qualifier
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            Input any target company URL. The asynchronous engine scrapes the site with exponential backoff retry and passes clean content to Gemini to extract strict B2B qualification signals.
          </p>
        </header>

        {/* Input Form Section */}
        <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl shadow-black/40 space-y-4">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://company.com (e.g. stripe.com)"
                disabled={isLoading}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 text-sm md:text-base font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !urlInput.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Qualify Lead</span>
                </>
              )}
            </button>
          </form>

          {/* Preset Sample URLs */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-400">Quick Test Samples:</span>
            {SAMPLE_URLS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => {
                  setUrlInput(sample.url);
                  runQualification(sample.url);
                }}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 hover:text-slate-200 border border-slate-700/60 transition-colors cursor-pointer"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
            <div className="space-y-1 text-sm flex-1">
              <p className="font-semibold text-rose-300">Extraction Error</p>
              <p className="text-rose-200/90">{errorMessage}</p>
              {errorMessage.includes("GEMINI_API_KEY") && (
                <div className="mt-2 text-xs bg-rose-950/80 p-2.5 rounded-lg border border-rose-800/40 text-rose-300">
                  Tip: Open <code className="text-rose-200 font-mono bg-rose-900/60 px-1 py-0.5 rounded">.env</code> in your root folder and set your Google Gemini API key:
                  <div className="font-mono mt-1 text-slate-200 select-all">GEMINI_API_KEY=AIzaSy...</div>
                </div>
              )}
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 p-1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading State Pipeline Indicator */}
        {isLoading && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 space-y-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="font-semibold text-slate-200 text-sm md:text-base">
                  FDE Engine In Action
                </span>
              </div>
              <span className="text-xs text-indigo-400 font-mono">
                Step {Math.max(loadingStep, 1)} of 3
              </span>
            </div>

            {/* Stepper Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  loadingStep >= 1
                    ? "bg-indigo-950/30 border-indigo-700/60 text-indigo-300"
                    : "bg-slate-900 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>1. Resilient HTTPX Fetch</span>
                </div>
                <p className="text-[11px] mt-1 text-slate-400">
                  3 attempts with Tenacity exponential backoff.
                </p>
              </div>

              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  loadingStep >= 2
                    ? "bg-indigo-950/30 border-indigo-700/60 text-indigo-300"
                    : "bg-slate-900 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>2. DOM Parsing</span>
                </div>
                <p className="text-[11px] mt-1 text-slate-400">
                  BeautifulSoup sanitizes and extracts body text.
                </p>
              </div>

              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  loadingStep >= 3
                    ? "bg-indigo-950/30 border-indigo-700/60 text-indigo-300"
                    : "bg-slate-900 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>3. Gemini LLM Extraction</span>
                </div>
                <p className="text-[11px] mt-1 text-slate-400">
                  Enforces strict JSON against Pydantic schema.
                </p>
              </div>
            </div>

            {/* Skeleton Table Rows */}
            <div className="space-y-3 pt-2">
              <div className="h-4 bg-slate-800/80 rounded w-1/3" />
              <div className="h-10 bg-slate-800/50 rounded-xl w-full" />
              <div className="h-10 bg-slate-800/50 rounded-xl w-full" />
              <div className="h-10 bg-slate-800/50 rounded-xl w-full" />
            </div>
          </div>
        )}

        {/* Results Section */}
        {currentResult && currentResult.data && !isLoading && (
          <div className="space-y-6">
            {/* Lead Overview Card */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">
                      Target Entity
                    </span>
                    <a
                      href={currentResult.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-mono"
                    >
                      {currentResult.url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <h2 className="text-2xl font-bold text-white mt-1">
                    {currentResult.page_title || "Company Profile"}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode(viewMode === "table" ? "json" : "table")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    {viewMode === "table" ? "View JSON" : "View Data Table"}
                  </button>
                  <button
                    onClick={handleCopyJson}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
                    title="Copy Structured JSON"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Scorecard Hero Banner */}
              {(() => {
                const scoreInfo = getScoreBadge(currentResult.data.qualification_score);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Score Gauge Card */}
                    <div className="md:col-span-1 p-5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold">Qualification Score</span>
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div className="py-2 flex items-baseline gap-2">
                        <span className="text-5xl font-black tracking-tight text-white">
                          {currentResult.data.qualification_score}
                        </span>
                        <span className="text-sm font-semibold text-slate-400">/ 10</span>
                      </div>
                      <div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full ${scoreInfo.barColor} transition-all duration-700`}
                            style={{
                              width: `${(currentResult.data.qualification_score / 10) * 100}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${scoreInfo.bg}`}
                        >
                          {scoreInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Quick Metric Cards */}
                    <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Company Size */}
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3.5">
                        <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                            Estimated Company Size
                          </p>
                          <p className="text-lg font-bold text-slate-100 font-mono">
                            {currentResult.data.company_size}
                          </p>
                          <p className="text-xs text-slate-400">Employee range category</p>
                        </div>
                      </div>

                      {/* Business Model Pill */}
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3.5">
                        <div
                          className={`p-2.5 rounded-lg shrink-0 border ${
                            currentResult.data.is_b2b
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          }`}
                        >
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                            Business Model
                          </p>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            {currentResult.data.is_b2b ? (
                              <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5" /> B2B Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sm font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
                                <XCircle className="w-3.5 h-3.5" /> B2C / Non-B2B
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">Target audience category</p>
                        </div>
                      </div>

                      {/* Core Product Summary */}
                      <div className="sm:col-span-2 p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                          Core Product / Platform
                        </p>
                        <p className="text-sm text-slate-200 leading-relaxed font-normal">
                          {currentResult.data.core_product}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Data Table / JSON View */}
              {viewMode === "table" ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-300">
                    Pydantic Schema Field Verification
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-slate-950/90 text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider font-mono">
                        <tr>
                          <th className="py-3 px-4">Field Name</th>
                          <th className="py-3 px-4">Pydantic Type</th>
                          <th className="py-3 px-4">Extracted Value</th>
                          <th className="py-3 px-4">Validation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 bg-slate-950/40 font-mono text-xs md:text-sm">
                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 text-indigo-400 font-semibold">
                            company_size
                          </td>
                          <td className="py-3 px-4 text-slate-400">string</td>
                          <td className="py-3 px-4 text-slate-200 font-sans font-medium">
                            {currentResult.data.company_size}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Validated
                            </span>
                          </td>
                        </tr>

                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 text-indigo-400 font-semibold">
                            core_product
                          </td>
                          <td className="py-3 px-4 text-slate-400">string</td>
                          <td className="py-3 px-4 text-slate-200 font-sans font-medium max-w-md">
                            {currentResult.data.core_product}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Validated
                            </span>
                          </td>
                        </tr>

                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 text-indigo-400 font-semibold">
                            is_b2b
                          </td>
                          <td className="py-3 px-4 text-slate-400">boolean</td>
                          <td className="py-3 px-4 text-slate-200">
                            {currentResult.data.is_b2b ? "true" : "false"}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Validated
                            </span>
                          </td>
                        </tr>

                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 text-indigo-400 font-semibold">
                            qualification_score
                          </td>
                          <td className="py-3 px-4 text-slate-400">integer (1-10)</td>
                          <td className="py-3 px-4 text-slate-200 font-bold">
                            {currentResult.data.qualification_score}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Validated
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono">JSON Output (Pydantic Encoded)</span>
                    <span>application/json</span>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-indigo-300 font-mono text-xs overflow-x-auto leading-relaxed">
                    {JSON.stringify(currentResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History / Recent Qualifications */}
        {history.length > 1 && (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Recent Session Leads ({history.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {history.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentResult(item);
                    setUrlInput(item.url);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all flex items-center gap-2 ${
                    currentResult?.url === item.url
                      ? "bg-indigo-950 border-indigo-600 text-indigo-200"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="font-semibold text-slate-400">
                    {item.page_title?.slice(0, 18) || item.url.replace(/^https?:\/\//, "")}
                  </span>
                  {item.data && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 text-[10px] font-bold">
                      {item.data.qualification_score}/10
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Technical Architecture Footer */}
        <footer className="pt-8 border-t border-slate-900 text-center text-xs text-slate-400 space-y-2">
          <p>
            Built with Next.js 14, Tailwind CSS, FastAPI, Tenacity backoff retry, BeautifulSoup4, and Google Gemini API.
          </p>
          <p className="text-slate-400">
            Forward Deployed Engineer Pipeline &bull; Production Ready
          </p>
        </footer>
      </div>
    </main>
  );
}
