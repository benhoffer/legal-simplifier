"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

interface SignPetitionButtonProps {
  policyId: string;
  initialSigned: boolean;
  initialCount: number;
  className?: string;
}

function useClerkUser() {
  if (!clerkEnabled) {
    return {
      isSignedIn: true,
      isLoaded: true,
      fullName: "Demo User",
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isSignedIn, isLoaded, user } = useUser();
  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName ?? "";
  return {
    isSignedIn: isSignedIn ?? false,
    isLoaded: isLoaded ?? false,
    fullName,
  };
}

export function SignPetitionButton({
  policyId,
  initialSigned,
  initialCount,
  className = "",
}: SignPetitionButtonProps) {
  const router = useRouter();
  const { isSignedIn, isLoaded, fullName: clerkName } = useClerkUser();

  const [signed, setSigned] = useState(initialSigned);
  const [count, setCount] = useState(initialCount);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Form state
  const [nameInput, setNameInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [verified, setVerified] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setSigned(initialSigned);
  }, [initialSigned]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  function openModal() {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    if (signed) {
      showToast("You have already signed this petition.", "error");
      return;
    }
    setNameInput(clerkName);
    setLocationInput("");
    setVerified(false);
    setFormError("");
    setShowConfirmation(false);
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!nameInput.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (!verified) {
      setFormError("Please verify you are a real person.");
      return;
    }
    setFormError("");
    setIsSubmitting(true);

    // Optimistic update
    const prevSigned = signed;
    const prevCount = count;
    setSigned(true);
    setCount(count + 1);

    try {
      const res = await fetch(`/api/policies/${policyId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: nameInput.trim(),
          location: locationInput.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCount(data.count);
        setShowConfirmation(true);
      } else if (res.status === 400) {
        setSigned(true);
        showToast(data.error || "You have already signed.", "error");
        setShowModal(false);
      } else {
        // Rollback
        setSigned(prevSigned);
        setCount(prevCount);
        setFormError(data.error || "Something went wrong.");
      }
    } catch {
      setSigned(prevSigned);
      setCount(prevCount);
      setFormError("Could not connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={signed}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${
          signed
            ? "border border-purple-300 bg-purple-50 text-purple-700 cursor-default focus:ring-purple-500"
            : "bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500"
        } ${className}`}
        aria-pressed={signed}
      >
        {/* Pen icon */}
        <svg
          className="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
          <path d="M19.5 7.125 16.862 4.487" />
        </svg>

        {signed ? "Signed" : "Sign Petition"}

        {count > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs ${
              signed
                ? "bg-purple-200 text-purple-800"
                : "bg-purple-500 text-white"
            }`}
          >
            {count}
          </span>
        )}
      </button>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !isSubmitting && setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sign-petition-title"
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {showConfirmation ? (
              /* ── Confirmation view ── */
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Petition Signed!
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Check your email to verify your signature. Verified signatures
                  are shown publicly.
                </p>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mt-6 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  Done
                </button>
              </div>
            ) : (
              /* ── Form view ── */
              <>
                <h2
                  id="sign-petition-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  Sign This Petition
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Your name will be publicly visible. We&apos;ll send a
                  verification email to confirm your signature.
                </p>

                <div className="mt-5 space-y-4">
                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="sign-name"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="sign-name"
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Your full name"
                      disabled={isSubmitting}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label
                      htmlFor="sign-location"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Location{" "}
                      <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      id="sign-location"
                      type="text"
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      placeholder="City, State"
                      disabled={isSubmitting}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                    />
                  </div>

                  {/* Verification checkbox */}
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={verified}
                      onChange={(e) => setVerified(e.target.checked)}
                      disabled={isSubmitting}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">
                      I verify that I am a real person and this is my genuine
                      signature.
                    </span>
                  </label>
                </div>

                {/* Error */}
                {formError && (
                  <p className="mt-3 text-sm text-red-600">{formError}</p>
                )}

                {/* Buttons */}
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={isSubmitting}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {isSubmitting && (
                      <svg
                        className="h-4 w-4 animate-spin"
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
                    )}
                    {isSubmitting ? "Signing..." : "Sign Petition"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
