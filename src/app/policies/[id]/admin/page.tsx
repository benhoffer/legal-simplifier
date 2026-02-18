"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DetailPageSkeleton } from "@/components/Skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminPolicy {
  id: string;
  title: string;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  viewCount: number;
}

interface Stats {
  views: number;
  totalEndorsements: number;
  individualEndorsements: number;
  orgEndorsements: number;
  verifiedSignatures: number;
  totalSignatures: number;
  comments: number;
}

interface TimelinePoint {
  date: string;
  total: number;
}

interface EndorsementTimelinePoint {
  date: string;
  individual: number;
  organization: number;
}

interface LocationEntry {
  location: string;
  count: number;
}

interface AdminData {
  policy: AdminPolicy;
  stats: Stats;
  signatureTimeline: TimelinePoint[];
  endorsementTimeline: EndorsementTimelinePoint[];
  topLocations: LocationEntry[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = "text-gray-900",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PolicyAdminPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Export state
  const [exportingSignatures, setExportingSignatures] = useState(false);
  const [exportingEndorsements, setExportingEndorsements] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/policies/${id}/admin`)
      .then((res) => {
        if (res.status === 403 || res.status === 401) {
          router.push(`/policies/${id}`);
          return null;
        }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => setError("Failed to load admin data."))
      .finally(() => setIsLoading(false));
  }, [id, router]);

  async function handleExport(
    type: "signatures" | "endorsements",
    setLoading: (v: boolean) => void
  ) {
    setLoading(true);
    try {
      const res = await fetch(`/api/policies/${id}/${type}/export`);
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Export failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] ?? `${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
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

  // ─── Loading ──────────────────────────────────────────────────────────

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-sm text-red-600">{error || "Not found."}</p>
          <Link
            href={`/policies/${id}`}
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            &larr; Back to Policy
          </Link>
        </div>
      </div>
    );
  }

  const { policy, stats, signatureTimeline, endorsementTimeline, topLocations } =
    data;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/policies/${id}`}
          className="inline-flex items-center gap-1 rounded text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          &larr; Back to Policy
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-900">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">{policy.title}</p>

        {/* ── Stats Grid ── */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Views"
            value={stats.views.toLocaleString()}
          />
          <StatCard
            label="Endorsements"
            value={stats.totalEndorsements}
            sub={`${stats.individualEndorsements} individual, ${stats.orgEndorsements} org`}
          />
          <StatCard
            label="Signatures"
            value={stats.totalSignatures}
            sub={`${stats.verifiedSignatures} verified`}
            color={
              stats.verifiedSignatures === stats.totalSignatures
                ? "text-green-700"
                : "text-gray-900"
            }
          />
          <StatCard label="Comments" value={stats.comments} />
        </div>

        {/* ── Signatures Over Time ── */}
        {signatureTimeline.length > 1 && (
          <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">
              Signatures Over Time
            </h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={signatureTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    allowDecimals={false}
                  />
                  <Tooltip
                    labelFormatter={(label) =>
                      new Date(label).toLocaleDateString()
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total Signatures"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={signatureTimeline.length < 30}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Endorsements Breakdown ── */}
        {endorsementTimeline.length > 0 && (
          <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">
              Endorsements Over Time
            </h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={endorsementTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    allowDecimals={false}
                  />
                  <Tooltip
                    labelFormatter={(label) =>
                      new Date(label).toLocaleDateString()
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="individual"
                    name="Individual"
                    fill="#3b82f6"
                    stackId="a"
                  />
                  <Bar
                    dataKey="organization"
                    name="Organization"
                    fill="#10b981"
                    stackId="a"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Geographic Distribution ── */}
        {topLocations.length > 0 && (
          <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">
              Top Locations
            </h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topLocations}
                  layout="vertical"
                  margin={{ left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="location"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    width={70}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="Signatures" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Export ── */}
        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            Export Data
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                handleExport("signatures", setExportingSignatures)
              }
              disabled={exportingSignatures}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              {exportingSignatures
                ? "Exporting..."
                : `Export Signatures (${stats.totalSignatures})`}
            </button>

            <button
              type="button"
              onClick={() =>
                handleExport("endorsements", setExportingEndorsements)
              }
              disabled={exportingEndorsements}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              {exportingEndorsements
                ? "Exporting..."
                : `Export Endorsements (${stats.totalEndorsements})`}
            </button>
          </div>
        </section>

        {/* ── Danger Zone ── */}
        <section className="mt-8 rounded-lg border border-red-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-red-600">Danger Zone</h2>
          <p className="mt-1 text-xs text-gray-500">
            Deleting this policy will remove it and all associated data
            (endorsements, signatures, comments).
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete This Policy
          </button>
        </section>
      </main>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900">
              Delete Policy
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently delete &ldquo;{policy.title}&rdquo; and all
              {stats.totalEndorsements > 0 &&
                ` ${stats.totalEndorsements} endorsement${stats.totalEndorsements !== 1 ? "s" : ""}`}
              {stats.totalSignatures > 0 &&
                `, ${stats.totalSignatures} signature${stats.totalSignatures !== 1 ? "s" : ""}`}
              {stats.comments > 0 &&
                `, ${stats.comments} comment${stats.comments !== 1 ? "s" : ""}`}
              . This cannot be undone.
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
                {isDeleting && (
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
