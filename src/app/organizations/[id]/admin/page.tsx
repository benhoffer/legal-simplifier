"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DetailPageSkeleton } from "@/components/Skeleton";

interface Member {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string; location: string | null };
}

interface AccessRequest {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

interface OrgInfo {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  verified: boolean;
  _count: { members: number; endorsements: number; policies: number };
}

export default function OrgAdminPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [accessRequestsError, setAccessRequestsError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const fetchAccessRequests = useCallback(async () => {
    setAccessRequestsError(false);
    try {
      const res = await fetch(`/api/organizations/${id}/access-requests?status=pending`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setAccessRequests(data.requests);
    } catch {
      setAccessRequestsError(true);
    }
  }, [id]);

  useEffect(() => {
    setIsLoading(true);

    Promise.all([
      fetch(`/api/organizations/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/organizations/${id}/members`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([orgData, memberData]) => {
        if (!orgData || !orgData.membership || orgData.membership.role !== "admin") {
          router.push(`/organizations/${id}`);
          return;
        }
        setOrg(orgData.organization);
        setIsAdmin(true);
        setEditName(orgData.organization.name);
        setEditDesc(orgData.organization.description || "");
        setEditWebsite(orgData.organization.website || "");

        if (memberData) setMembers(memberData.members);

        return fetchAccessRequests();
      })
      .catch(() => router.push(`/organizations/${id}`))
      .finally(() => setIsLoading(false));
  }, [id, router, fetchAccessRequests]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
          website: editWebsite.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setOrg(data.organization);
        showToast("Organization updated.");
      } else {
        showToast(data.error || "Failed to update.");
      }
    } catch {
      showToast("Could not connect to the server.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReviewRequest(requestId: string, action: "approve" | "deny") {
    try {
      const res = await fetch(`/api/organizations/${id}/access-requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) {
        setAccessRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (action === "approve") {
          setOrg((prev) =>
            prev
              ? { ...prev, _count: { ...prev._count, members: prev._count.members + 1 } }
              : prev
          );
        }
        showToast(action === "approve" ? "Request approved." : "Request denied.");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to review request.");
      }
    } catch {
      showToast("Could not connect to the server.");
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await fetch(
        `/api/organizations/${id}/members?userId=${userId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.user.id !== userId));
        setOrg((prev) =>
          prev
            ? { ...prev, _count: { ...prev._count, members: prev._count.members - 1 } }
            : prev
        );
        showToast("Member removed.");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to remove member.");
      }
    } catch {
      showToast("Could not connect to the server.");
    }
  }

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (!isAdmin || !org) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/organizations/${id}`}
          className="inline-flex items-center gap-1 rounded text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          &larr; Back to {org.name}
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-900">
          Admin Dashboard
        </h1>

        {/* ── Edit Organization ── */}
        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Organization Info
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="admin-name" className="mb-1 block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                id="admin-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={100}
                disabled={isSaving}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="admin-desc" className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="admin-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                disabled={isSaving}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="admin-website" className="mb-1 block text-sm font-medium text-gray-700">
                Website
              </label>
              <input
                id="admin-website"
                type="url"
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                disabled={isSaving}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !editName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>

        {/* ── Members ── */}
        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Members ({members.length})
          </h2>

          <ul className="mt-4 divide-y divide-gray-100">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {m.user.name ?? m.user.email}
                  </span>
                  {m.user.location && (
                    <span className="ml-2 text-xs text-gray-400">
                      ({m.user.location})
                    </span>
                  )}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.role === "admin"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {m.role}
                  </span>
                </div>

                {m.role !== "admin" && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.user.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Access Requests ── */}
        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Access Requests ({accessRequests.length})
            </h2>
            <button
              type="button"
              onClick={fetchAccessRequests}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Refresh
            </button>
          </div>
          {accessRequestsError ? (
            <div className="mt-4 flex items-center gap-3">
              <p className="text-sm text-red-500">Failed to load requests.</p>
              <button
                type="button"
                onClick={fetchAccessRequests}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Retry
              </button>
            </div>
          ) : accessRequests.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">No pending requests.</p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100">
              {accessRequests.map((req) => (
                <li key={req.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {req.user.name ?? req.user.email}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                    {req.message && (
                      <p className="mt-0.5 text-xs text-gray-500">{req.message}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleReviewRequest(req.id, "approve")}
                      className="text-xs font-medium text-green-600 hover:text-green-700"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewRequest(req.id, "deny")}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Deny
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Stats ── */}

        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Stats</h2>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-2xl font-bold text-gray-900">{org._count.members}</p>
              <p className="mt-1 text-xs text-gray-500">Members</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-2xl font-bold text-gray-900">{org._count.policies}</p>
              <p className="mt-1 text-xs text-gray-500">Policies</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-2xl font-bold text-gray-900">{org._count.endorsements}</p>
              <p className="mt-1 text-xs text-gray-500">Endorsements</p>
            </div>
          </div>
        </section>
      </main>

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
