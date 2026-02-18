"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import DiffMatchPatch from "diff-match-patch";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PolicyData {
  id: string;
  title: string;
  content: string;
  targetLawText: string | null;
  targetLawName: string | null;
}

interface ComparisonResult {
  additions: string[];
  removals: string[];
  changes: string[];
  summary: string;
  impactAnalysis: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── Diff component ──────────────────────────────────────────────────────────

function DiffView({
  oldText,
  newText,
  side,
}: {
  oldText: string;
  newText: string;
  side: "left" | "right";
}) {
  const parts = useMemo(() => {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);
    return diffs;
  }, [oldText, newText]);

  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map(([op, text], i) => {
        // Left side: show deletions highlighted, insertions hidden, equal as-is
        if (side === "left") {
          if (op === DiffMatchPatch.DIFF_DELETE) {
            return (
              <span key={i} className="bg-red-100 text-red-900">
                {text}
              </span>
            );
          }
          if (op === DiffMatchPatch.DIFF_INSERT) {
            return null;
          }
          return <span key={i}>{text}</span>;
        }

        // Right side: show insertions highlighted, deletions hidden, equal as-is
        if (op === DiffMatchPatch.DIFF_INSERT) {
          return (
            <span key={i} className="bg-green-100 text-green-900">
              {text}
            </span>
          );
        }
        if (op === DiffMatchPatch.DIFF_DELETE) {
          return null;
        }
        return <span key={i}>{text}</span>;
      })}
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ComparePage() {
  const { id } = useParams<{ id: string }>();

  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Custom law input (when policy has no targetLawText)
  const [customLawText, setCustomLawText] = useState("");

  // The law text being compared
  const [activeLawText, setActiveLawText] = useState("");
  const [lawLabel, setLawLabel] = useState("");

  // AI analysis
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  // Share
  const [copied, setCopied] = useState(false);

  const fetchPolicy = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/policies/${id}`);
      if (res.status === 404) {
        setError("not_found");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      const p = data.policy as PolicyData;
      setPolicy(p);

      // Auto-populate if policy has target law
      if (p.targetLawText) {
        setActiveLawText(p.targetLawText);
        setLawLabel(p.targetLawName || "Existing Law");
      }
    } catch {
      setError("Failed to load policy.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  // Auto-trigger AI analysis when policy has targetLawText
  useEffect(() => {
    if (policy?.targetLawText && activeLawText && !comparison && !isAnalyzing) {
      runAnalysis(activeLawText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy, activeLawText]);

  async function runAnalysis(lawText: string) {
    setIsAnalyzing(true);
    setAnalysisError("");
    setComparison(null);

    try {
      const res = await fetch(`/api/policies/${id}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingLawText: lawText }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAnalysisError(data.error || "Failed to generate comparison.");
        return;
      }

      setComparison(data.comparison);
    } catch {
      setAnalysisError("Could not connect to the server.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleCustomSubmit() {
    const text = customLawText.trim();
    if (!text) return;
    setActiveLawText(text);
    setLawLabel("Custom Law");
    runAnalysis(text);
  }

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner className="mx-auto h-8 w-8 text-blue-600" />
          <p className="mt-3 text-sm text-gray-500">Loading policy...</p>
        </div>
      </div>
    );
  }

  // ─── Not found ─────────────────────────────────────────────────────────────

  if (error === "not_found" || !policy) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Policy Not Found
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            This policy may have been deleted or does not exist.
          </p>
          <Link
            href="/policies"
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            &larr; Back to Policies
          </Link>
        </div>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchPolicy}
            className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasComparison = !!activeLawText;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href={`/policies/${id}`}
          className="inline-flex items-center gap-1 rounded text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          &larr; Back to Policy
        </Link>

        {/* Header */}
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Compare: {policy.title}
          </h1>
          {hasComparison && (
            <p className="mt-1 text-sm text-gray-500">
              vs. {lawLabel}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
            title="Coming soon"
          >
            Download Comparison
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {copied ? "Link Copied!" : "Share Comparison"}
          </button>
        </div>

        {/* ── INPUT SECTION (no targetLawText) ── */}
        {!policy.targetLawText && !hasComparison && (
          <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Paste Existing Law
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              This policy doesn&apos;t have a linked law. Paste the existing law
              text below to generate a comparison.
            </p>
            <textarea
              value={customLawText}
              onChange={(e) => setCustomLawText(e.target.value)}
              placeholder="Paste the existing law or regulation text here..."
              rows={12}
              className="mt-4 w-full resize-y rounded-lg border border-gray-300 bg-white p-4 font-mono text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {customLawText.length.toLocaleString()} characters
              </p>
              <button
                type="button"
                onClick={handleCustomSubmit}
                disabled={!customLawText.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate Comparison
              </button>
            </div>
          </section>
        )}

        {/* ── Allow re-entering custom text even when policy has targetLawText ── */}
        {hasComparison && !policy.targetLawText && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                setActiveLawText("");
                setComparison(null);
                setAnalysisError("");
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              &larr; Use different law text
            </button>
          </div>
        )}

        {/* ── DIFF VIEW ── */}
        {hasComparison && (
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Text Comparison
            </h2>

            {/* Legend */}
            <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-red-100 border border-red-200" />
                Removed from existing law
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-green-100 border border-green-200" />
                Added in proposed policy
              </span>
            </div>

            <div className="grid gap-0 overflow-hidden rounded-lg border border-gray-200 lg:grid-cols-2">
              {/* Left: existing law */}
              <div className="border-b border-gray-200 bg-white lg:border-b-0 lg:border-r">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Existing Law
                  </h3>
                  {lawLabel && (
                    <p className="mt-0.5 text-xs text-gray-400 truncate">
                      {lawLabel}
                    </p>
                  )}
                </div>
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  <DiffView
                    oldText={activeLawText}
                    newText={policy.content}
                    side="left"
                  />
                </div>
              </div>

              {/* Right: proposed policy */}
              <div className="bg-white">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Proposed Policy
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-400 truncate">
                    {policy.title}
                  </p>
                </div>
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  <DiffView
                    oldText={activeLawText}
                    newText={policy.content}
                    side="right"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── AI ANALYSIS ── */}
        {hasComparison && (
          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                AI Analysis
              </h2>
              {comparison && !isAnalyzing && (
                <button
                  type="button"
                  onClick={() => runAnalysis(activeLawText)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Re-analyze
                </button>
              )}
            </div>

            {isAnalyzing && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-5 py-8">
                <Spinner className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-gray-500">
                  Analyzing differences...
                </p>
              </div>
            )}

            {analysisError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {analysisError}
              </div>
            )}

            {comparison && !isAnalyzing && (
              <div className="mt-4 space-y-6">
                {/* Summary */}
                <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Summary
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-700">
                    {comparison.summary}
                  </p>
                </div>

                {/* Three columns: Additions, Removals, Modifications */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Additions */}
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-800">
                      Key Additions
                    </h3>
                    {comparison.additions.length > 0 ? (
                      <ul className="space-y-1.5">
                        {comparison.additions.map((item, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-sm text-green-800"
                          >
                            <span className="shrink-0 mt-0.5">+</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic text-green-700">
                        No significant additions.
                      </p>
                    )}
                  </div>

                  {/* Removals */}
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-800">
                      Key Removals
                    </h3>
                    {comparison.removals.length > 0 ? (
                      <ul className="space-y-1.5">
                        {comparison.removals.map((item, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-sm text-red-800"
                          >
                            <span className="shrink-0 mt-0.5">&minus;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic text-red-700">
                        No significant removals.
                      </p>
                    )}
                  </div>

                  {/* Modifications */}
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-800">
                      Modifications
                    </h3>
                    {comparison.changes.length > 0 ? (
                      <ul className="space-y-1.5">
                        {comparison.changes.map((item, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-sm text-yellow-800"
                          >
                            <span className="shrink-0 mt-0.5">~</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic text-yellow-700">
                        No significant modifications.
                      </p>
                    )}
                  </div>
                </div>

                {/* Overall Impact */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-800">
                    Overall Impact
                  </h3>
                  <p className="text-sm leading-relaxed text-blue-900">
                    {comparison.impactAnalysis}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
