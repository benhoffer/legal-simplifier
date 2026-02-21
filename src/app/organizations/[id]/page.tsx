"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DetailPageSkeleton } from "@/components/Skeleton";

interface OrgPolicy {
  id: string;
  title: string;
  category: string | null;
  createdAt: string;
}

interface OrgEndorsement {
  id: string;
  createdAt: string;
  policy: { id: string; title: string; category: string | null };
}

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string; location: string | null };
}

interface OrgDetail {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  verified: boolean;
  createdAt: string;
  policies: OrgPolicy[];
  endorsements: OrgEndorsement[];
  _count: { members: number; endorsements: number; policies: number };
}

type Tab = "policies" | "endorsed" | "members";

export default function OrganizationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [membership, setMembership] = useState<{ role: string } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ status: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("policies");
  const [isRequesting, setIsRequesting] = useState(false);
  const [toast, setToast] = useState("");

  const isAdmin = membership?.role === "admin";
  const isMember = membership != null;

  const fetchOrg = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/organizations/${id}`);
      if (res.status === 404) {
        setError("not_found");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrg(data.organization);
      setMembership(data.membership);
      setPendingRequest(data.pendingRequest ?? null);
    } catch {
      setError("Failed to load organization.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  // Fetch members when tab switches to members
  useEffect(() => {
    if (tab !== "members") return;
    fetch(`/api/organizations/${id}/members`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setMembers(data.members);
      })
      .catch(() => {});
  }, [tab, id]);

  async function handleRequestAccess() {
    setIsRequesting(true);
    try {
      const res = await fetch(`/api/organizations/${id}/members`, {
        method: "POST",
      });
      if (res.status === 401) {
        router.push("/sign-in");
        return;
      }
      const data = await res.json();
      if (res.ok || res.status === 202) {
        setPendingRequest({ status: "pending" });
        setToast("Access request sent! An admin will review it shortly.");
        setTimeout(() => setToast(""), 4000);
      } else {
        setToast(data.error || "Failed to send request.");
        setTimeout(() => setToast(""), 3000);
      }
    } catch {
      setToast("Could not connect to the server.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setIsRequesting(false);
    }
  }

  async function handleLeave() {
    try {
      const res = await fetch(`/api/organizations/${id}/members`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMembership(null);
        setOrg((prev) =>
          prev
            ? { ...prev, _count: { ...prev._count, members: prev._count.members - 1 } }
            : prev
        );
        setToast("You have left the organization.");
        setTimeout(() => setToast(""), 3000);
      }
    } catch {
      // Ignore
    }
  }

  // ── Loading / Error ─────────────────────────────────────────────────────

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error === "not_found" || !org) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Organization Not Found</h1>
          <Link href="/organizations" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
            &larr; Back to Organizations
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
          <button onClick={fetchOrg} className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700">Try again</button>
        </div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "policies", label: "Policies Published", count: org._count.policies },
    { key: "endorsed", label: "Policies Endorsed", count: org._count.endorsements },
    { key: "members", label: "Members", count: org._count.members },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/organizations" className="inline-flex items-center gap-1 rounded text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
          &larr; Back to Organizations
        </Link>

        {/* ── Header ── */}
        <div className="mt-6 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xl font-bold text-blue-700">
            {org.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {org.name}
              {org.verified && (
                <span className="ml-2 inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Verified
                </span>
              )}
            </h1>
            {org.description && (
              <p className="mt-1 text-sm text-gray-600">{org.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {org.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              <span>{org._count.members} member{org._count.members !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="mt-4 flex flex-wrap gap-3">
          {!isMember ? (
            pendingRequest?.status === "pending" ? (
              <span className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-500">
                Request Pending
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestAccess}
                disabled={isRequesting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isRequesting ? "Requesting..." : "Request Access"}
              </button>
            )
          ) : (
            <>
              {isAdmin && (
                <Link
                  href={`/organizations/${org.id}/admin`}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Admin Dashboard
                </Link>
              )}
              {!isAdmin && (
                <button
                  type="button"
                  onClick={handleLeave}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Leave Organization
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="mt-8 border-b border-gray-200">
          <div className="-mb-px flex gap-6" role="tablist" aria-label="Organization content">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                onClick={() => setTab(t.key)}
                aria-selected={tab === t.key}
                aria-controls={`tabpanel-${t.key}`}
                className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                  tab === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="mt-6" role="tabpanel" id={`tabpanel-${tab}`} aria-label={TABS.find((t) => t.key === tab)?.label}>
          {tab === "policies" && (
            org.policies.length > 0 ? (
              <ul className="space-y-3">
                {org.policies.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/policies/${p.id}`}
                      className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:shadow-sm"
                    >
                      <h3 className="text-sm font-medium text-gray-900">{p.title}</h3>
                      <div className="mt-1 flex gap-2 text-xs text-gray-400">
                        {p.category && <span>{p.category}</span>}
                        <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No policies published yet.</p>
            )
          )}

          {tab === "endorsed" && (
            org.endorsements.length > 0 ? (
              <ul className="space-y-3">
                {org.endorsements.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/policies/${e.policy.id}`}
                      className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:shadow-sm"
                    >
                      <h3 className="text-sm font-medium text-gray-900">{e.policy.title}</h3>
                      <div className="mt-1 flex gap-2 text-xs text-gray-400">
                        {e.policy.category && <span>{e.policy.category}</span>}
                        <span>Endorsed {new Date(e.createdAt).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No policies endorsed yet.</p>
            )
          )}

          {tab === "members" && (
            members.length > 0 ? (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {m.user.name ?? m.user.email}
                      </span>
                      {m.user.location && (
                        <span className="ml-2 text-xs text-gray-400">({m.user.location})</span>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.role === "admin"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No members to show.</p>
            )
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
