"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface AccessiblePolicy {
  id: string;
  title: string;
  category: string | null;
  organization: { name: string } | null;
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
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

type Mode = "ask" | "compare";

export default function AnalysisWorkspace() {
  const [mode, setMode] = useState<Mode>("ask");
  const [policies, setPolicies] = useState<AccessiblePolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);

  // Ask mode state
  const [askPolicyId, setAskPolicyId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState("");

  // Compare mode state
  const [comparePrimaryId, setComparePrimaryId] = useState("");

  useEffect(() => {
    fetch("/api/policies/accessible")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.policies) setPolicies(data.policies);
      })
      .catch(() => {})
      .finally(() => setPoliciesLoading(false));
  }, []);

  async function handleAsk() {
    if (!askPolicyId || !question.trim()) return;
    setIsAsking(true);
    setAskError("");
    setAnswer("");

    try {
      const res = await fetch(`/api/policies/${askPolicyId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAskError(data.error || "Failed to get an answer. Please try again.");
        return;
      }
      setAnswer(data.answer);
    } catch {
      setAskError("Could not connect to the server.");
    } finally {
      setIsAsking(false);
    }
  }

  const noOrgs = !policiesLoading && policies.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Policy Analysis
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Ask questions about policies or compare them side-by-side.
        </p>

        {/* ── No org onboarding ── */}
        {noOrgs && (
          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6 text-center">
            <h2 className="text-sm font-semibold text-blue-900">Get started on Agora</h2>
            <p className="mt-2 text-sm text-blue-800">
              Join an organization to access policies for analysis.
            </p>
            <Link
              href="/organizations"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Browse Organizations
            </Link>
          </div>
        )}

        {/* ── Mode tabs ── */}
        {!noOrgs && (
          <>
            <div className="mt-8 flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
              {(["ask", "compare"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    mode === m
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {m === "ask" ? "Ask a Question" : "Compare Policies"}
                </button>
              ))}
            </div>

            {/* ── ASK MODE ── */}
            {mode === "ask" && (
              <div className="mt-6 space-y-5">
                <div>
                  <label htmlFor="ask-policy" className="mb-1 block text-sm font-medium text-gray-700">
                    Policy
                  </label>
                  {policiesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Spinner /> Loading policies...
                    </div>
                  ) : (
                    <select
                      id="ask-policy"
                      value={askPolicyId}
                      onChange={(e) => {
                        setAskPolicyId(e.target.value);
                        setAnswer("");
                        setAskError("");
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a policy...</option>
                      {policies.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                          {p.organization ? ` — ${p.organization.name}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label htmlFor="question" className="mb-1 block text-sm font-medium text-gray-700">
                    Question
                  </label>
                  <textarea
                    id="question"
                    value={question}
                    onChange={(e) => {
                      setQuestion(e.target.value);
                      setAnswer("");
                      setAskError("");
                    }}
                    rows={3}
                    maxLength={1000}
                    placeholder="e.g. What does this policy say about enforcement? Who is affected by Section 2?"
                    className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-right text-xs text-gray-400">{question.length}/1000</p>
                </div>

                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={!askPolicyId || !question.trim() || isAsking}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAsking && <Spinner />}
                  {isAsking ? "Analyzing..." : "Ask"}
                </button>

                {askError && (
                  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {askError}
                  </div>
                )}

                {answer && (
                  <div className="rounded-lg border border-gray-200 bg-white p-5">
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Answer</h2>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                      {answer}
                    </div>
                    {askPolicyId && (
                      <div className="mt-4 border-t border-gray-100 pt-3">
                        <Link
                          href={`/policies/${askPolicyId}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          View full policy &rarr;
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── COMPARE MODE ── */}
            {mode === "compare" && (
              <div className="mt-6 space-y-5">
                <p className="text-sm text-gray-500">
                  Select a policy, then use the side-by-side comparison tool to see what changed.
                </p>
                <div>
                  <label htmlFor="compare-primary" className="mb-1 block text-sm font-medium text-gray-700">
                    Policy to compare
                  </label>
                  {policiesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Spinner /> Loading policies...
                    </div>
                  ) : (
                    <select
                      id="compare-primary"
                      value={comparePrimaryId}
                      onChange={(e) => setComparePrimaryId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a policy...</option>
                      {policies.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                          {p.organization ? ` — ${p.organization.name}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <Link
                  href={comparePrimaryId ? `/policies/${comparePrimaryId}/compare` : "#"}
                  onClick={(e) => { if (!comparePrimaryId) e.preventDefault(); }}
                  className={`inline-block rounded-lg px-6 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    comparePrimaryId
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "cursor-not-allowed bg-gray-200 text-gray-400"
                  }`}
                  aria-disabled={!comparePrimaryId}
                >
                  Open Comparison Tool &rarr;
                </Link>

                <p className="text-xs text-gray-400">
                  The comparison tool shows a full diff alongside AI-generated additions, removals, and impact analysis.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
