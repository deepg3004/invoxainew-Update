import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  { href: "/tenants", label: "Tenants" },
  { href: "/buyers", label: "Buyers" },
  { href: "/reports", label: "Reports" },
  { href: "/plans", label: "Plans" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
];

/** Header + nav chrome shared by every authorized admin page. */
export function AdminShell({
  email,
  children,
}: {
  email: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-ink/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <nav className="flex items-center gap-1 overflow-x-auto text-sm">
            <Link
              href="/"
              className="mr-2 whitespace-nowrap font-display font-bold tracking-tight text-zinc-900"
            >
              Invox<span className="text-gradient">AI</span> admin
            </Link>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-muted transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm text-muted">
            {email ? <span className="hidden sm:inline">{email}</span> : null}
            <form action="/auth/signout" method="post">
              <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-muted transition hover:bg-zinc-100 hover:text-zinc-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
