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

interface AccessiblePolicy {
  id: string;
  title: string;
  category: string | null;
  organization: { name: string } | null;
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
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Diff component ──────────────────────────────────────────────────────────

function DiffView({ oldText, newText, side }: { oldText: string; newText: string; side: "left" | "right" }) {
  const parts = useMemo(() => {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);
    return diffs;
  }, [oldText, newText]);

  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map(([op, text], i) => {
        if (side === "left") {
          if (op === DiffMatchPatch.DIFF_DELETE) return <span key={i} className="bg-red-100 text-red-900">{text}</span>;
          if (op === DiffMatchPatch.DIFF_INSERT) return null;
          return <span key={i}>{text}</span>;
        }
        if (op === DiffMatchPatch.DIFF_INSERT) return <span key={i} className="bg-green-100 text-green-900">{text}</span>;
        if (op === DiffMatchPatch.DIFF_DELETE) return null;
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

  // Accessible policies for the picker
  const [accessiblePolicies, setAccessiblePolicies] = useState<AccessiblePolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");

  // Active comparison state
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
      if (res.status === 404) { setError("not_found"); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      const p = data.policy as PolicyData;
      setPolicy(p);

      // If the policy has stored targetLawText, auto-trigger comparison
      if (p.targetLawText) {
        setActiveLawText(p.targetLawText);
        setLawLabel(p.targetLawName || "Reference Law");
      }
    } catch {
      setError("Failed to load policy.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Load accessible policies for the picker
  useEffect(() => {
    fetch("/api/policies/accessible")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.policies) {
          // Exclude the current policy from the comparison options
          setAccessiblePolicies(data.policies.filter((p: AccessiblePolicy) => p.id !== id));
        }
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => { fetchPolicy(); }, [fetchPolicy]);

  // Auto-trigger when policy has stored targetLawText
  useEffect(() => {
    if (policy?.targetLawText && activeLawText && !comparison && !isAnalyzing) {
      runAnalysis(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy, activeLawText]);

  async function runAnalysis(comparePolicyId: string | null) {
    setIsAnalyzing(true);
    setAnalysisError("");
    setComparison(null);

    try {
      const res = await fetch(`/api/policies/${id}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comparePolicyId ? { comparePolicyId } : {}),
      });
      const data = await res.json();

      if (!res.ok) {
        setAnalysisError(data.error || "Failed to generate comparison.");
        return;
      }

      setComparison(data.comparison);
      if (data.lawLabel) setLawLabel(data.lawLabel);
    } catch {
      setAnalysisError("Could not connect to the server.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleCompareSelected() {
    if (!selectedPolicyId) return;
    const selected = accessiblePolicies.find((p) => p.id === selectedPolicyId);
    if (selected) setLawLabel(selected.title);
    setActiveLawText("policy:" + selectedPolicyId); // sentinel to trigger diff view
    await runAnalysis(selectedPolicyId);
  }

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Loading / Error ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error === "not_found" || !policy) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Policy Not Found</h1>
          <Link href="/policies" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
            &larr; Back to Policies
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={fetchPolicy} className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700">
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
        <Link
          href={`/policies/${id}`}
          className="inline-flex items-center gap-1 rounded text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          &larr; Back to Policy
        </Link>

        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Compare: {policy.title}
          </h1>
          {hasComparison && (
            <p className="mt-1 text-sm text-gray-500">vs. {lawLabel}</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {copied ? "Link Copied!" : "Share Comparison"}
          </button>
        </div>

        {/* ── POLICY PICKER ── */}
        {!hasComparison && (
          <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Select a Policy to Compare</h2>
            <p className="mt-1 text-sm text-gray-500">
              Choose another policy from your organization to compare against.
            </p>

            {accessiblePolicies.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">
                No other policies available in your organizations.
              </p>
            ) : (
              <div className="mt-4 flex gap-3">
                <select
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a policy...</option>
                  {accessiblePolicies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                      {p.organization ? ` — ${p.organization.name}` : ""}
                      {p.category ? ` (${p.category})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCompareSelected}
                  disabled={!selectedPolicyId || isAnalyzing}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAnalyzing && <Spinner />}
                  {isAnalyzing ? "Comparing..." : "Compare"}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Reset button when comparison is active */}
        {hasComparison && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                setActiveLawText("");
                setComparison(null);
                setAnalysisError("");
                setSelectedPolicyId("");
                setLawLabel("");
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              &larr; Compare with a different policy
            </button>
          </div>
        )}

        {/* ── DIFF VIEW ── */}
        {hasComparison && comparison && (
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Text Comparison</h2>
            <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border border-red-200 bg-red-100" />
                Removed from reference
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border border-green-200 bg-green-100" />
                Added in this policy
              </span>
            </div>

            <div className="grid gap-0 overflow-hidden rounded-lg border border-gray-200 lg:grid-cols-2">
              <div className="border-b border-gray-200 bg-white lg:border-b-0 lg:border-r">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reference Policy</h3>
                  {lawLabel && <p className="mt-0.5 truncate text-xs text-gray-400">{lawLabel}</p>}
                </div>
                <div className="max-h-[600px] overflow-y-auto p-4">
                  <DiffView
                    oldText={comparison.summary}
                    newText={policy.content}
                    side="left"
                  />
                </div>
              </div>
              <div className="bg-white">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">This Policy</h3>
                  <p className="mt-0.5 truncate text-xs text-gray-400">{policy.title}</p>
                </div>
                <div className="max-h-[600px] overflow-y-auto p-4">
                  <DiffView
                    oldText={comparison.summary}
                    newText={policy.content}
                    side="right"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── AI ANALYSIS ── */}
        {(isAnalyzing || analysisError || comparison) && (
          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">AI Analysis</h2>
              {comparison && !isAnalyzing && (
                <button
                  type="button"
                  onClick={() => runAnalysis(selectedPolicyId || null)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Re-analyze
                </button>
              )}
            </div>

            {isAnalyzing && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-5 py-8">
                <Spinner className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-gray-500">Analyzing differences...</p>
              </div>
            )}

            {analysisError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {analysisError}
              </div>
            )}

            {comparison && !isAnalyzing && (
              <div className="mt-4 space-y-6">
                <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
                  <h3 className="text-sm font-semibold text-gray-900">Summary</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-700">{comparison.summary}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-800">Key Additions</h3>
                    {comparison.additions.length > 0 ? (
                      <ul className="space-y-1.5">
                        {comparison.additions.map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm text-green-800">
                            <span className="mt-0.5 shrink-0">+</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic text-green-700">No significant additions.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-800">Key Removals</h3>
                    {comparison.removals.length > 0 ? (
                      <ul className="space-y-1.5">
                        {comparison.removals.map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm text-red-800">
                            <span className="mt-0.5 shrink-0">&minus;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic text-red-700">No significant removals.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-800">Modifications</h3>
                    {comparison.changes.length > 0 ? (
                      <ul className="space-y-1.5">
                        {comparison.changes.map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm text-yellow-800">
                            <span className="mt-0.5 shrink-0">~</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic text-yellow-700">No significant modifications.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-800">Overall Impact</h3>
                  <p className="text-sm leading-relaxed text-blue-900">{comparison.impactAnalysis}</p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
