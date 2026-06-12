import Link from "next/link";

// Branded 404 for storefront hosts — shown for unknown AI-page slugs, removed
// products/pages, mistyped URLs, etc. (Next renders this for any notFound()).
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900">Page not found</h1>
      <p className="mt-2 text-muted">
        This page isn’t available, or it may have moved.
      </p>
      <Link
        href="/store"
        className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white"
      >
        Browse the store
      </Link>
      <div className="mt-3">
        <Link href="/" className="text-sm text-cyan underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}
