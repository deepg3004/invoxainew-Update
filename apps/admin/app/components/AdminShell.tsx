import Link from "next/link";
import type { ReactNode } from "react";

/** Header + nav chrome shared by every authorized admin page. */
export function AdminShell({
  email,
  children,
}: {
  email: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/" className="font-semibold text-neutral-900">
              InvoxAI admin
            </Link>
            <Link href="/tenants" className="text-neutral-600 hover:text-neutral-900">
              Tenants
            </Link>
            <Link href="/buyers" className="text-neutral-600 hover:text-neutral-900">
              Buyers
            </Link>
            <Link href="/reports" className="text-neutral-600 hover:text-neutral-900">
              Reports
            </Link>
            <Link href="/plans" className="text-neutral-600 hover:text-neutral-900">
              Plans
            </Link>
            <Link
              href="/pricing"
              className="text-neutral-600 hover:text-neutral-900"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            {email ? <span className="hidden sm:inline">{email}</span> : null}
            <form action="/auth/signout" method="post">
              <button className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}
