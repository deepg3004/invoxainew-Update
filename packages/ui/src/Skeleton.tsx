import { cn } from "./cn";

// Shimmering placeholder block. Compose into route-level loading.tsx files.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-zinc-200/70", className)} />;
}

// Generic full-page loading placeholder for route-level loading.tsx files —
// a header line, a row of stat tiles, and a few list rows.
export function PageLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="mt-8 space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}
