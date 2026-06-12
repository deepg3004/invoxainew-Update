"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

// One nav item.
type NavItem = { href: string; label: string; icon: string };
type NavGroup = { heading: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    heading: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: "M4 5h16M4 12h10M4 19h16" }],
  },
  {
    heading: "Build",
    items: [
      { href: "/ai-pages", label: "AI pages", icon: "M12 3v18M3 12h18" },
    ],
  },
  {
    heading: "Commerce",
    items: [
      { href: "/products", label: "Products", icon: "M3 7l9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7" },
      { href: "/coupons", label: "Coupons", icon: "M3 9a2 2 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" },
      { href: "/courses", label: "Courses", icon: "M12 4 3 9l9 5 9-5-9-5ZM5 11v5l7 4 7-4v-5" },
      { href: "/pay-pages", label: "Pay pages", icon: "M3 7h18v10H3zM3 11h18" },
      { href: "/orders", label: "Orders", icon: "M3 3h2l2 13h11l2-9H7M9 21h.01M18 21h.01" },
    ],
  },
  {
    heading: "Money",
    items: [
      { href: "/wallet", label: "Wallet", icon: "M3 7h15a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm13 4h.01" },
      { href: "/gateway", label: "Gateway", icon: "M12 2v6m0 8v6M2 12h6m8 0h6" },
      { href: "/billing", label: "Billing", icon: "M3 10h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" },
      { href: "/invoices", label: "Invoices", icon: "M6 2h9l5 5v15H6zM15 2v5h5M9 13h6M9 17h6" },
    ],
  },
  {
    heading: "Grow",
    items: [
      { href: "/domains", label: "Domains", icon: "M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" },
      { href: "/tracking", label: "Tracking", icon: "M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-9" },
      { href: "/usage", label: "Usage", icon: "M12 20V10M6 20V4M18 20v-6" },
    ],
  },
];

// Routes that should render without the dashboard chrome.
const BARE_PREFIXES = ["/login", "/onboarding"];

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const FLAT = NAV.flatMap((g) => g.items);

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Premium-dark dashboard chrome: fixed sidebar (lg+), mobile top-strip nav,
 * topbar with notifications + sign out. Auth routes render children bare.
 *
 * `pathname` is passed in by the app's root layout via a thin client wrapper,
 * keeping this component free of a hard next/navigation dependency.
 */
export function DashboardShell({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const bare = BARE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (bare) return <>{children}</>;

  return (
    <div className="min-h-screen bg-ink">
      {/* Sidebar (lg+) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-surface/40 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-6">
          <a href="/" className="font-display text-lg font-bold tracking-tight text-white">
            Invox<span className="text-gradient">AI</span>
          </a>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.heading}>
              <div className="px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted/70">
                {group.heading}
              </div>
              <div className="mt-2 space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                        active
                          ? "bg-brand/15 font-medium text-white shadow-[inset_0_0_0_1px_rgba(124,58,237,0.3)]"
                          : "text-muted hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span className={active ? "text-accent" : ""}>
                        <Icon d={item.icon} />
                      </span>
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/5 bg-ink/70 px-4 backdrop-blur-xl sm:px-6">
          <a
            href="/"
            className="font-display text-base font-bold tracking-tight text-white lg:hidden"
          >
            Invox<span className="text-gradient">AI</span>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <a
              href="/notifications"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition hover:bg-white/5 hover:text-white"
            >
              Notifications
            </a>
            <form action="/auth/signout" method="post">
              <button className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition hover:bg-white/5 hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* Mobile nav strip */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-white/5 px-4 py-2 lg:hidden">
          {FLAT.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition",
                  active
                    ? "bg-brand/15 font-medium text-white"
                    : "text-muted hover:bg-white/5 hover:text-white",
                )}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <main className="px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
