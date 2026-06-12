"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">Something went wrong</h1>
      <p className="mt-2 text-neutral-500">
        We hit a snag loading this page. Please try again in a moment.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
      >
        Try again
      </button>
      <div className="mt-3">
        <Link href="/" className="text-sm text-blue-600 underline">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
