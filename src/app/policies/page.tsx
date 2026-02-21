"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PolicyCardSkeletonGrid } from "@/components/Skeleton";

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

interface Policy {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  jurisdiction: string | null;
  publishedAt: string | null;
  viewCount: number;
  author: { name: string | null; location: string | null };
  organization: { name: string } | null;
  _count: { endorsements: number; petitionSignatures: number };
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

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
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

  // Derive unique org names for the filter
  const orgNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of policies) {
      if (p.organization?.name) names.add(p.organization.name);
    }
    return Array.from(names).sort();
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      if (filterCategory && p.category !== filterCategory) return false;
      if (filterOrg && p.organization?.name !== filterOrg) return false;
      if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [policies, filterCategory, filterOrg, searchQuery]);

  const hasFilters = filterCategory || filterOrg || searchQuery;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Policy Proposals
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Browse policy proposals within your organizations.
            </p>
          </div>
          <Link
            href="/policies/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Publish a Policy
          </Link>
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
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {orgNames.length > 1 && (
              <select
                value={filterOrg}
                onChange={(e) => setFilterOrg(e.target.value)}
                aria-label="Filter by organization"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Organizations</option>
                {orgNames.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}

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

        {listError && (
          <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {listError}
          </div>
        )}

        {isLoadingList ? (
          <PolicyCardSkeletonGrid />
        ) : policies.length === 0 && !listError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">No policies found in your organizations.</p>
            <div className="mt-4 flex flex-col items-center gap-3">
              <Link
                href="/policies/new"
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Publish a policy proposal
              </Link>
              <Link href="/organizations" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Browse organizations
              </Link>
            </div>
          </div>
        ) : filteredPolicies.length === 0 && hasFilters ? (
          <p className="py-16 text-center text-sm text-gray-500">No policies match your filters.</p>
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
                  {policy.author.name && policy.publishedAt && <span aria-hidden="true">&middot;</span>}
                  {policy.publishedAt && (
                    <time dateTime={policy.publishedAt}>{relativeTime(policy.publishedAt)}</time>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {policy.category && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[policy.category] ?? CATEGORY_COLORS.Other}`}>
                      {policy.category}
                    </span>
                  )}
                  {policy.organization?.name && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                      {policy.organization.name}
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
                      <span>{policy._count.endorsements} endorsement{policy._count.endorsements !== 1 ? "s" : ""}</span>
                    )}
                    {policy._count.petitionSignatures > 0 && (
                      <span>{policy._count.petitionSignatures.toLocaleString()} signature{policy._count.petitionSignatures !== 1 ? "s" : ""}</span>
                    )}
                    {policy.viewCount > 0 && (
                      <span>{policy.viewCount.toLocaleString()} view{policy.viewCount !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
