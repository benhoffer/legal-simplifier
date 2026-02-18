import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <p className="text-6xl font-bold text-gray-200">404</p>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          Page Not Found
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go Home
          </Link>
          <Link
            href="/policies"
            className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Browse Policies
          </Link>
          <Link
            href="/organizations"
            className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Organizations
          </Link>
        </div>
      </div>
    </div>
  );
}
