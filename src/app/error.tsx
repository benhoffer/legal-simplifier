"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <p className="text-5xl font-bold text-gray-200">Error</p>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-gray-400">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
