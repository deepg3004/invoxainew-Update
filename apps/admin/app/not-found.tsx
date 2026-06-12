import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">404</p>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">Page not found</h1>
      <p className="mt-2 text-neutral-500">This admin page isn’t available.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
      >
        Back to admin
      </Link>
    </main>
  );
}
