"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { EndorseButton } from "@/components/EndorseButton";
import { SignPetitionButton } from "@/components/SignPetitionButton";
import { PetitionProgress } from "@/components/PetitionProgress";
import { CommentSection } from "@/components/CommentSection";
import { DetailPageSkeleton } from "@/components/Skeleton";


// ─── Types ───────────────────────────────────────────────────────────────────

interface Endorser {
  user: { name: string | null; location: string | null };
}

interface Signer {
  id: string;
  fullName: string;
  location: string | null;
  createdAt: string;
}

interface PolicyDetail {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category: string | null;
  jurisdiction: string | null;
  targetLawText: string | null;
  targetLawName: string | null;
  readabilityScore: number | null;
  potentialConflicts: string | null;
  affectedGroups: string | null;
  published: boolean;
  publishedAt: string | null;
  viewCount: number;
  createdAt: string;
  author: {
    id: string;
    clerkId: string;
    name: string | null;
    email: string;
    location: string | null;
  };
  endorsements: Endorser[];
  _count: {
    endorsements: number;
    petitionSignatures: number;
  };
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function scoreColor(score: number): string {
  if (score > 60) return "text-green-700 bg-green-50 border-green-200";
  if (score >= 40) return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-red-700 bg-red-50 border-red-200";
}

function useCurrentClerkId(): string | null {
  const { user } = useUser();
  return user?.id ?? null;
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const clerkId = useCurrentClerkId();

  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Share state
  const [copied, setCopied] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);


  // Petition signatures
  const [signatures, setSignatures] = useState<Signer[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);

  // AI summary expanded state
  const [summaryExpanded, setSummaryExpanded] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 640 : true
  );

  const isAuthor = clerkId != null && policy?.author.clerkId === clerkId;

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
      const p: PolicyDetail = data.policy;
      setPolicy(p);
    } catch {
      setError("Failed to load policy.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  // Fetch verified signatures
  useEffect(() => {
    if (!id) return;
    fetch(`/api/policies/${id}/sign`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSignatures(data.signatures);
          setVerifiedCount(data.count);
        }
      })
      .catch(() => {});
  }, [id]);

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/policies/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/policies");
      }
    } catch {
      // Ignore
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }


  // ─── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  // ─── Not Found ───────────────────────────────────────────────────────────

  if (error === "not_found" || !policy) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Policy Not Found</h1>
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

  // ─── Error ───────────────────────────────────────────────────────────────

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

  const affectedGroupsList = policy.affectedGroups
    ? policy.affectedGroups.split(", ").filter(Boolean)
    : [];
  const conflictsList = policy.potentialConflicts
    ? policy.potentialConflicts.split("\n").filter(Boolean)
    : [];
  const signatureCount = policy._count.petitionSignatures;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back */}
        <Link
          href="/policies"
          className="inline-flex items-center gap-1 rounded text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          &larr; Back to Policies
        </Link>

        {/* ── HEADER ── */}
        <article className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {policy.title}
          </h1>

          {/* Metadata */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
            <span>By {policy.author.name ?? policy.author.email}</span>
            {policy.author.location && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>{policy.author.location}</span>
              </>
            )}
            {policy.publishedAt && (
              <>
                <span aria-hidden="true">&middot;</span>
                <time dateTime={policy.publishedAt}>
                  {formatDate(policy.publishedAt)}
                </time>
              </>
            )}
            {policy.category && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>{policy.category}</span>
              </>
            )}
            {policy.jurisdiction && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>{policy.jurisdiction}</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <EndorseButton
              policyId={policy.id}
              initialEndorsed={false}
              initialCount={policy._count.endorsements}
            />

            <SignPetitionButton
              policyId={policy.id}
              initialSigned={false}
              initialCount={policy._count.petitionSignatures}
            />

            <button
              type="button"
              onClick={handleShare}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {copied ? "Link Copied!" : "Share"}
            </button>

            {isAuthor && (
              <Link
                href={`/policies/${policy.id}/admin`}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Admin Dashboard
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
            <span>
              {policy._count.endorsements} endorsement
              {policy._count.endorsements !== 1 ? "s" : ""}
            </span>
            <span>
              {signatureCount} signature
              {signatureCount !== 1 ? "s" : ""}
            </span>
            <span>
              {policy.viewCount.toLocaleString()} view
              {policy.viewCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Petition progress */}
          <PetitionProgress
            currentCount={verifiedCount}
            className="mt-6"
          />
        </article>

        {/* ── AI SUMMARY ── */}
        {(policy.summary || policy.readabilityScore != null || affectedGroupsList.length > 0 || conflictsList.length > 0) && (
          <section className="mt-8 rounded-lg border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={summaryExpanded}
            >
              AI Analysis Summary
              <span
                className={`transition-transform ${summaryExpanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                &#9660;
              </span>
            </button>

            {summaryExpanded && (
              <div className="space-y-4 border-t border-gray-200 px-5 py-4">
                {/* Readability score */}
                {policy.readabilityScore != null && (
                  <div
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${scoreColor(policy.readabilityScore)}`}
                  >
                    Readability: {policy.readabilityScore}/100
                  </div>
                )}

                {/* Summary */}
                {policy.summary && (
                  <p className="text-sm leading-relaxed text-gray-700">
                    {policy.summary}
                  </p>
                )}

                {/* Affected groups */}
                {affectedGroupsList.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Affected Groups
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {affectedGroupsList.map((group) => (
                        <span
                          key={group}
                          className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                        >
                          {group}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts */}
                {conflictsList.length > 0 && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-yellow-800">
                      Potential Conflicts
                    </h3>
                    <ul className="space-y-1">
                      {conflictsList.map((conflict, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-sm text-yellow-800"
                        >
                          <span className="shrink-0" aria-hidden="true">
                            &#9888;
                          </span>
                          {conflict}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── ACTIONS ROW ── */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Analyze in Workspace
          </Link>

          {policy.targetLawText && (
            <Link
              href={`/policies/${policy.id}/compare`}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Compare to {policy.targetLawName || "Existing Law"}
            </Link>
          )}
        </div>

        {/* ── POLICY CONTENT ── */}
        <section className="mt-8 rounded-lg border border-gray-300 bg-white p-6 sm:p-8">
          <h2 className="sr-only">Policy Content</h2>
          <div className="whitespace-pre-wrap text-base leading-relaxed text-gray-800">
            {policy.content}
          </div>
        </section>

        {/* ── ENDORSEMENTS ── */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Endorsements ({policy._count.endorsements})
          </h2>

          {policy.endorsements.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {policy.endorsements.slice(0, 20).map((e, i) => (
                <li key={i} className="text-sm text-gray-600">
                  {e.user.name ?? "Anonymous"}
                  {e.user.location && (
                    <span className="text-gray-400">
                      {" "}
                      ({e.user.location})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-400">
              No endorsements yet. Be the first to endorse!
            </p>
          )}

          {policy._count.endorsements > 20 && (
            <p className="mt-2 text-sm text-gray-500">
              and {policy._count.endorsements - 20} more...
            </p>
          )}
        </section>

        {/* ── PETITION SIGNATURES ── */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Verified Signatures ({verifiedCount})
          </h2>

          {signatures.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {signatures.map((s) => (
                <li key={s.id} className="text-sm text-gray-600">
                  {s.fullName}
                  {s.location && (
                    <span className="text-gray-400"> ({s.location})</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-400">
              No verified signatures yet. Be the first to sign!
            </p>
          )}

          {verifiedCount > 50 && (
            <p className="mt-2 text-sm text-gray-500">
              and {verifiedCount - 50} more...
            </p>
          )}
        </section>

        {/* ── COMMENTS ── */}
        <CommentSection
          policyId={policy.id}
          policyAuthorClerkId={policy.author.clerkId}
        />

        {/* ── DELETE (author only) ── */}
        {isAuthor && (
          <section className="mt-12 border-t border-gray-200 pt-8">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Delete This Policy
            </button>
          </section>
        )}
      </main>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-title"
              className="text-lg font-semibold text-gray-900"
            >
              Delete Policy
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently delete &ldquo;{policy.title}&rdquo; and
              remove all {policy._count.endorsements} endorsement
              {policy._count.endorsements !== 1 ? "s" : ""}. This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting && <Spinner />}
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
