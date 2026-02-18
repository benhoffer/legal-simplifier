"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { PolicyCardSkeletonGrid } from "@/components/Skeleton";

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const CATEGORIES = [
  "Housing",
  "Healthcare",
  "Education",
  "Environment",
  "Transportation",
  "Criminal Justice",
  "Economic Policy",
  "Civil Rights",
  "Other",
];

const JURISDICTION_TYPES = ["Federal", "State", "County", "City"];

const CATEGORY_COLORS: Record<string, string> = {
  Housing: "bg-purple-100 text-purple-700",
  Healthcare: "bg-green-100 text-green-700",
  Education: "bg-amber-100 text-amber-700",
  Environment: "bg-emerald-100 text-emerald-700",
  Transportation: "bg-sky-100 text-sky-700",
  "Criminal Justice": "bg-red-100 text-red-700",
  "Economic Policy": "bg-indigo-100 text-indigo-700",
  "Civil Rights": "bg-pink-100 text-pink-700",
  Other: "bg-gray-100 text-gray-600",
};

interface PolicyAuthor {
  name: string | null;
  location: string | null;
}

interface Policy {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  jurisdiction: string | null;
  publishedAt: string | null;
  viewCount: number;
  author: PolicyAuthor;
  _count: {
    endorsements: number;
    petitionSignatures: number;
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const trimmed = text.slice(0, max);
  const lastSpace = trimmed.lastIndexOf(" ");
  return (lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed) + "...";
}

function relativeTime(dateStr: string): string {
  const seconds = Math.floor((Date.now() - Date.parse(dateStr)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function useIsSignedIn() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  if (clerkEnabled) return useUser().isSignedIn ?? false;
  return true;
}

export default function PoliciesPage() {
  const isSignedIn = useIsSignedIn();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterJurisdiction, setFilterJurisdiction] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPolicies = useCallback(async () => {
    setIsLoadingList(true);
    setListError("");
    try {
      const res = await fetch("/api/policies");
      if (!res.ok) throw new Error("Failed to load policies.");
      const data = await res.json();
      setPolicies(data.policies);
    } catch {
      setListError("Could not load policies. Please refresh the page.");
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      if (filterCategory && p.category !== filterCategory) return false;
      if (
        filterJurisdiction &&
        !p.jurisdiction?.startsWith(filterJurisdiction)
      )
        return false;
      if (
        searchQuery &&
        !p.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [policies, filterCategory, filterJurisdiction, searchQuery]);

  const hasFilters = filterCategory || filterJurisdiction || searchQuery;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page heading */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Policy Proposals
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Browse community-submitted policy proposals.
            </p>
          </div>
          {isSignedIn && (
            <Link
              href="/policies/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Publish a Policy
            </Link>
          )}
        </div>

        {/* Filter bar */}
        {!isLoadingList && policies.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              aria-label="Filter by category"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filterJurisdiction}
              onChange={(e) => setFilterJurisdiction(e.target.value)}
              aria-label="Filter by jurisdiction"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Jurisdictions</option>
              {JURISDICTION_TYPES.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title..."
              aria-label="Search policies by title"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Error loading list */}
        {listError && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {listError}
          </div>
        )}

        {/* Policy cards */}
        {isLoadingList ? (
          <PolicyCardSkeletonGrid />
        ) : policies.length === 0 && !listError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">
              No policies have been published yet.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {isSignedIn ? (
                <Link
                  href="/policies/new"
                  className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Be the first to publish a policy proposal
                </Link>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="font-medium text-blue-600 hover:text-blue-700"
                  >
                    Sign in
                  </Link>{" "}
                  to publish the first policy proposal.
                </>
              )}
            </p>
          </div>
        ) : filteredPolicies.length === 0 && hasFilters ? (
          <p className="py-16 text-center text-sm text-gray-500">
            No policies match your filters.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPolicies.map((policy) => (
              <Link
                key={policy.id}
                href={`/policies/${policy.id}`}
                className="group rounded-lg border border-gray-300 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-700">
                  {policy.title}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                  {policy.author.name && <span>{policy.author.name}</span>}
                  {policy.author.name && policy.author.location && (
                    <>
                      <span aria-hidden="true">&middot;</span>
                      <span>{policy.author.location}</span>
                    </>
                  )}
                  {(policy.author.name || policy.author.location) &&
                    policy.publishedAt && (
                      <span aria-hidden="true">&middot;</span>
                    )}
                  {policy.publishedAt && (
                    <time dateTime={policy.publishedAt}>
                      {relativeTime(policy.publishedAt)}
                    </time>
                  )}
                </div>

                {/* Metadata badges */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {policy.category && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[policy.category] ?? CATEGORY_COLORS.Other}`}
                    >
                      {policy.category}
                    </span>
                  )}
                  {policy.jurisdiction && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                      {policy.jurisdiction}
                    </span>
                  )}
                </div>

                {policy.summary && (
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">
                    {truncate(policy.summary, 150)}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
                    Read more &rarr;
                  </span>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {policy._count.endorsements > 0 && (
                      <span>
                        {policy._count.endorsements} endorsement
                        {policy._count.endorsements !== 1 ? "s" : ""}
                      </span>
                    )}
                    {policy._count.petitionSignatures > 0 && (
                      <span>
                        {policy._count.petitionSignatures.toLocaleString()}{" "}
                        signature
                        {policy._count.petitionSignatures !== 1 ? "s" : ""}
                      </span>
                    )}
                    {policy.viewCount > 0 && (
                      <span>
                        {policy.viewCount.toLocaleString()} view
                        {policy.viewCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Sign-in prompt */}
        {!isSignedIn && (
          <div className="mt-12 border-t border-gray-200 pt-10 text-center">
            <p className="text-sm text-gray-500">
              <Link
                href="/sign-in"
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                Sign in
              </Link>{" "}
              to publish your own policy proposal.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
