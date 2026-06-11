/**
 * Shown on a suspended tenant's storefront (Phase 3 admin). Buyers can't browse
 * or pay while the store is suspended; payment pages and AI pages are hidden.
 */
export function StoreUnavailable({ name }: { name: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">Store unavailable</h1>
      <p className="mt-2 text-neutral-500">
        {name} is temporarily unavailable. Please check back later.
      </p>
    </main>
  );
}
