"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrgCardSkeleton } from "@/components/Skeleton";

interface OrgSummary {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  verified: boolean;
  createdAt: string;
  _count: { members: number; endorsements: number; policies: number };
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setIsLoading(true);
    const url = debouncedSearch
      ? `/api/organizations?search=${encodeURIComponent(debouncedSearch)}`
      : "/api/organizations";

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setOrganizations(data.organizations);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [debouncedSearch]);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Organizations
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Groups and organizations endorsing and publishing policies.
            </p>
          </div>
          <Link
            href="/organizations/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create Organization
          </Link>
        </div>

        {/* Search */}
        <div className="mt-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations..."
            aria-label="Search organizations by name"
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Grid */}
        <div className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <OrgCardSkeleton key={i} />
              ))}
            </div>
          ) : organizations.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              {debouncedSearch
                ? "No organizations match your search."
                : "No organizations yet. Create one!"}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {organizations.map((org) => (
                <Link
                  key={org.id}
                  href={`/organizations/${org.id}`}
                  className="rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="flex items-start gap-3">
                    {/* Logo placeholder */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-sm font-bold text-blue-700">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-gray-900">
                        {org.name}
                        {org.verified && (
                          <span className="ml-1.5 inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                            Verified
                          </span>
                        )}
                      </h2>
                      {org.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                          {org.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-4 text-xs text-gray-400">
                    <span>{org._count.members} member{org._count.members !== 1 ? "s" : ""}</span>
                    <span>{org._count.policies} polic{org._count.policies !== 1 ? "ies" : "y"}</span>
                    <span>{org._count.endorsements} endorsement{org._count.endorsements !== 1 ? "s" : ""}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
