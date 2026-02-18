"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

interface AdminOrg {
  id: string;
  name: string;
}

interface EndorseButtonProps {
  policyId: string;
  initialEndorsed: boolean;
  initialCount: number;
  className?: string;
}

function useClerkSignedIn() {
  if (!clerkEnabled) return { isSignedIn: true, isLoaded: true };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isSignedIn, isLoaded } = useUser();
  return { isSignedIn: isSignedIn ?? false, isLoaded: isLoaded ?? false };
}

function ThumbIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V3a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m.729-7.305a2.25 2.25 0 0 0-2.25-2.25H3.75a.75.75 0 0 0-.75.75v8.25c0 .414.336.75.75.75h.633a2.25 2.25 0 0 0 2.25-2.25V10.25z"
      />
    </svg>
  );
}

function Spinner() {
  return (
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
  );
}

export function EndorseButton({
  policyId,
  initialEndorsed,
  initialCount,
  className = "",
}: EndorseButtonProps) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useClerkSignedIn();

  const [endorsed, setEndorsed] = useState(initialEndorsed);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Org endorsement state
  const [adminOrgs, setAdminOrgs] = useState<AdminOrg[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEndorsed(initialEndorsed);
  }, [initialEndorsed]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  // Fetch user's admin orgs
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/organizations?membership=admin")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.organizations) {
          setAdminOrgs(
            data.organizations.map((o: { id: string; name: string }) => ({
              id: o.id,
              name: o.name,
            }))
          );
        }
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const showToastMsg = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  async function handlePersonalEndorse() {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setShowDropdown(false);

    const prevEndorsed = endorsed;
    const prevCount = count;
    setEndorsed(!endorsed);
    setCount(endorsed ? count - 1 : count + 1);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/policies/${policyId}/endorse`, {
        method: endorsed ? "DELETE" : "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setEndorsed(data.endorsed);
        setCount(data.count);
        showToastMsg(
          data.endorsed ? "Policy endorsed!" : "Endorsement removed.",
          "success"
        );
      } else if (res.status === 400 && !endorsed) {
        setEndorsed(true);
        showToastMsg("You already endorsed this policy.", "error");
      } else {
        setEndorsed(prevEndorsed);
        setCount(prevCount);
        showToastMsg(data.error || "Something went wrong.", "error");
      }
    } catch {
      setEndorsed(prevEndorsed);
      setCount(prevCount);
      showToastMsg("Could not connect to the server.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOrgEndorse(orgId: string, orgName: string) {
    setShowDropdown(false);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/organizations/${orgId}/endorse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId }),
      });

      const data = await res.json();

      if (res.ok) {
        setCount(data.count);
        showToastMsg(`Endorsed as ${orgName}!`, "success");
      } else {
        showToastMsg(data.error || "Failed to endorse.", "error");
      }
    } catch {
      showToastMsg("Could not connect to the server.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  function handleButtonClick() {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    // If user has admin orgs, show dropdown
    if (adminOrgs.length > 0 && !endorsed) {
      setShowDropdown(!showDropdown);
      return;
    }

    // Otherwise, personal endorse/un-endorse
    handlePersonalEndorse();
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={isLoading}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${
            endorsed
              ? "border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 focus:ring-green-500"
              : "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
          } ${className}`}
          aria-pressed={endorsed}
          aria-haspopup={adminOrgs.length > 0 && !endorsed ? "true" : undefined}
          aria-expanded={showDropdown ? "true" : undefined}
        >
          {isLoading ? <Spinner /> : <ThumbIcon filled={endorsed} />}

          {endorsed ? "Endorsed" : "Endorse"}

          {count > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                endorsed
                  ? "bg-green-200 text-green-800"
                  : "bg-blue-500 text-white"
              }`}
            >
              {count}
            </span>
          )}

          {/* Dropdown arrow when orgs available */}
          {adminOrgs.length > 0 && !endorsed && (
            <svg className="h-3 w-3 opacity-70" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <path d="M6 8.825L1.175 4 2.238 2.938 6 6.7l3.763-3.763L10.825 4z" />
            </svg>
          )}
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={handlePersonalEndorse}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <ThumbIcon filled={false} />
              Endorse as yourself
            </button>

            {adminOrgs.length > 0 && (
              <div className="my-1 border-t border-gray-100" />
            )}

            {adminOrgs.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => handleOrgEndorse(org.id, org.name)}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-100 text-[10px] font-bold text-blue-700">
                  {org.name.charAt(0).toUpperCase()}
                </span>
                Endorse as {org.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "bg-green-800 text-white"
              : "bg-red-800 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
