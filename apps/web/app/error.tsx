"use client";

import { useEffect } from "react";
import { AuroraBackground, Button } from "@invoxai/ui";

export default function SiteError({
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
    <>
      <AuroraBackground />
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-muted">Please try again in a moment.</p>
        <div className="mt-7 flex items-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button href="/" variant="ghost">
            Back to home
          </Button>
        </div>
      </main>
    </>
  );
}
