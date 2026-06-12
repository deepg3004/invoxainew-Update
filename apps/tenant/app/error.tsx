"use client";

import { useEffect } from "react";
import Link from "next/link";

// Storefront error boundary — graceful fallback for unexpected runtime errors
// instead of Next's default error screen. `reset` retries the failed render.
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the server logs / Sentry (if configured); never the user.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-zinc-900">Something went wrong</h1>
      <p className="mt-2 text-muted">
        We hit a snag loading this page. Please try again in a moment.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white"
      >
        Try again
      </button>
      <div className="mt-3">
        <Link href="/" className="text-sm text-cyan underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}
