"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface OrgOption {
  id: string;
  name: string;
}

interface AnalysisResult {
  readabilityScore: number;
  readabilityLevel: string;
  potentialConflicts: string[];
  affectedGroups: string[];
  missingElements: string[];
  suggestions: string[];
  summary: string;
  category: string;
}

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

function scoreColor(score: number): string {
  if (score > 60) return "text-green-700 bg-green-50 border-green-200";
  if (score >= 40) return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-red-700 bg-red-50 border-red-200";
}

export default function NewPolicyPage() {
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState("");
  const [orgId, setOrgId] = useState("");
  const [userOrgs, setUserOrgs] = useState<OrgOption[]>([]);
  const [content, setContent] = useState("");
  const [hasExistingLaw, setHasExistingLaw] = useState(false);
  const [targetLawName, setTargetLawName] = useState("");
  const [targetLawText, setTargetLawText] = useState("");

  // Analysis state
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  // Publish state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/organizations?membership=member")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.organizations) setUserOrgs(data.organizations);
      })
      .catch(() => {});
  }, []);

  async function handleAnalyze() {
    setAnalysisError("");
    setAnalysis(null);

    if (content.trim().length < 100) {
      setAnalysisError("Policy content must be at least 100 characters.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const res = await fetch("/api/policies/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          targetLawText: hasExistingLaw ? targetLawText.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAnalysisError(data.error || "Analysis failed. Please try again.");
        return;
      }

      setAnalysis(data.analysis);
    } catch {
      setAnalysisError("Could not connect to the server. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handlePublish() {
    setPublishError("");
    setIsPublishing(true);

    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          organizationId: orgId || null,
          targetLawName: hasExistingLaw ? targetLawName.trim() || null : null,
          targetLawText: hasExistingLaw ? targetLawText.trim() || null : null,
          analysisResults: analysis
            ? {
                category: analysis.category,
                readabilityScore: analysis.readabilityScore,
                summary: analysis.summary,
                potentialConflicts: analysis.potentialConflicts,
                affectedGroups: analysis.affectedGroups,
              }
            : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPublishError(data.error || "Failed to publish. Please try again.");
        return;
      }

      router.push(`/policies/${data.policy.id}`);
    } catch {
      setPublishError("Could not connect to the server. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  }

  const canAnalyze = content.trim().length >= 100 && !isAnalyzing;
  const canPublish =
    title.trim().length > 0 &&
    content.trim().length >= 100 &&
    orgId.length > 0 &&
    analysis !== null &&
    !isPublishing;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Publish a Policy Proposal
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Draft your policy, run a pre-publish check, and share it with the
          community.
        </p>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-8 space-y-8"
        >
          {/* ── BASIC INFO ── */}
          <fieldset className="space-y-5">
            <legend className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Basic Info
            </legend>

            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. Community Solar Access Program"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-right text-xs text-gray-400">
                {title.length}/200
              </p>
            </div>

            {/* Organization (jurisdiction) */}
            <div>
              <label
                htmlFor="org-select"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Organization <span className="text-red-500">*</span>
              </label>
              {userOrgs.length === 0 ? (
                <p className="text-sm text-gray-500">
                  You must be a member of an organization to publish a policy.{" "}
                  <Link href="/organizations" className="text-blue-600 hover:underline">
                    Browse organizations
                  </Link>
                </p>
              ) : (
                <select
                  id="org-select"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select organization...</option>
                  {userOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Category will be assigned automatically by AI during the pre-publish check.
              </p>
            </div>
          </fieldset>

          {/* ── POLICY CONTENT ── */}
          <fieldset className="space-y-5">
            <legend className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Policy Content
            </legend>

            <div>
              <label
                htmlFor="content"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  // Reset analysis when content changes
                  if (analysis) setAnalysis(null);
                }}
                rows={14}
                placeholder="Paste or write your finalized policy text here. Include sections for purpose, scope, definitions, provisions, enforcement, and any relevant timelines or budgets."
                className="w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-gray-900 placeholder:font-sans placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p
                className={`mt-1 text-right text-xs ${
                  content.trim().length < 100 && content.trim().length > 0
                    ? "text-red-500"
                    : "text-gray-400"
                }`}
              >
                {content.length.toLocaleString()} characters
                {content.trim().length > 0 && content.trim().length < 100 && (
                  <span> (minimum 100)</span>
                )}
              </p>
            </div>
          </fieldset>

          {/* ── COMPARISON ── */}
          <fieldset className="space-y-5">
            <legend className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Comparison (optional)
            </legend>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hasExistingLaw}
                onChange={(e) => setHasExistingLaw(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Does this replace or modify an existing law?
              </span>
            </label>

            {hasExistingLaw && (
              <div className="space-y-4 border-l-2 border-blue-200 pl-5">
                <div>
                  <label
                    htmlFor="law-name"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Existing Law Name
                  </label>
                  <input
                    id="law-name"
                    type="text"
                    value={targetLawName}
                    onChange={(e) => setTargetLawName(e.target.value)}
                    placeholder='e.g. "Prop 13", "AB-123", "Section 8 Housing Act"'
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="law-text"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Existing Law Text
                  </label>
                  <textarea
                    id="law-text"
                    value={targetLawText}
                    onChange={(e) => setTargetLawText(e.target.value)}
                    rows={6}
                    placeholder="Paste the relevant existing law text here for conflict analysis..."
                    className="w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-gray-900 placeholder:font-sans placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </fieldset>

          {/* ── PRE-PUBLISH CHECK ── */}
          <div className="border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing && <Spinner />}
              {isAnalyzing
                ? "Running analysis..."
                : analysis
                  ? "Re-run Pre-Publish Check"
                  : "Run Pre-Publish Check"}
            </button>

            {analysisError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {analysisError}
              </div>
            )}

            {analysis && <AnalysisResults analysis={analysis} />}
          </div>

          {/* ── PUBLISH ── */}
          <div className="border-t border-gray-200 pt-6">
            {publishError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {publishError}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={!canPublish}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Publish Policy
            </button>

            {!analysis && content.trim().length >= 100 && (
              <p className="mt-2 text-xs text-gray-500">
                Run the pre-publish check before publishing.
              </p>
            )}
          </div>
        </form>

        {/* ── CONFIRMATION MODAL ── */}
        {showConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !isPublishing && setShowConfirm(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="confirm-title"
                className="text-lg font-semibold text-gray-900"
              >
                Confirm Publication
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Once published, this policy cannot be edited. You can only
                delete it (which will remove all endorsements). Continue?
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  disabled={isPublishing}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirm(false);
                    handlePublish();
                  }}
                  disabled={isPublishing}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isPublishing && <Spinner />}
                  {isPublishing ? "Publishing..." : "Yes, Publish"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function AnalysisResults({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="mt-6 space-y-4">
      {/* Readability */}
      <div
        className={`rounded-lg border p-4 ${scoreColor(analysis.readabilityScore)}`}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Readability Score</h3>
          <span className="text-2xl font-bold">{analysis.readabilityScore}</span>
        </div>
        <p className="mt-1 text-sm opacity-80">
          Level: {analysis.readabilityLevel}
        </p>
      </div>

      {/* AI Category */}
      {analysis.category && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Tagged as:</span>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800">
            {analysis.category}
          </span>
        </div>
      )}

      {/* Summary */}
      <ExpandableSection title="Summary" defaultOpen>
        <p className="text-sm leading-relaxed text-gray-700">
          {analysis.summary}
        </p>
      </ExpandableSection>

      {/* Affected Groups */}
      {analysis.affectedGroups.length > 0 && (
        <ExpandableSection title="Affected Groups" defaultOpen>
          <div className="flex flex-wrap gap-2">
            {analysis.affectedGroups.map((group) => (
              <span
                key={group}
                className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
              >
                {group}
              </span>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Potential Conflicts */}
      {analysis.potentialConflicts.length > 0 && (
        <ExpandableSection title="Potential Conflicts">
          <ul className="space-y-2">
            {analysis.potentialConflicts.map((conflict, i) => (
              <li key={i} className="flex gap-2 text-sm text-yellow-800">
                <span className="mt-0.5 shrink-0" aria-hidden="true">
                  &#9888;
                </span>
                {conflict}
              </li>
            ))}
          </ul>
        </ExpandableSection>
      )}

      {/* Missing Elements */}
      {analysis.missingElements.length > 0 && (
        <ExpandableSection title="Missing Elements">
          <ul className="space-y-1.5">
            {analysis.missingElements.map((el, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true">
                  &#9744;
                </span>
                {el}
              </li>
            ))}
          </ul>
        </ExpandableSection>
      )}

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <ExpandableSection title="Suggestions">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
            {analysis.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </ExpandableSection>
      )}
    </div>
  );
}

function ExpandableSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        aria-expanded={open}
      >
        {title}
        <span
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          &#9660;
        </span>
      </button>
      {open && <div className="border-t border-gray-200 px-4 py-3">{children}</div>}
    </div>
  );
}
