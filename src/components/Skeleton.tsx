export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 ${className}`}
      aria-hidden="true"
    />
  );
}

export function PolicyCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <Skeleton className="h-5 w-3/4" />
      <div className="mt-2 flex gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="mt-2 flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1 h-4 w-5/6" />
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function PolicyCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <PolicyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function OrgCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-full" />
        </div>
      </div>
      <div className="mt-4 flex gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-6 h-8 w-3/4" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-20 rounded-lg" />
        </div>
        <Skeleton className="mt-8 h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}
