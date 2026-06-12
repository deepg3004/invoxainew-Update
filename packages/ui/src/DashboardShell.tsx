"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { heading: string; items: NavItem[] };

// Seller (app) navigation — exported so the seller shell wrapper can pass it in.
export const SELLER_NAV: NavGroup[] = [
  {
    heading: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: "M4 5h16M4 12h10M4 19h16" }],
  },
  {
    heading: "Build",
    items: [
      { href: "/ai-pages", label: "AI pages", icon: "M12 3v18M3 12h18" },
      { href: "/bio", label: "Bio link", icon: "M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM7 17a5 5 0 0 1 10 0M12 3v2" },
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
      { href: "/abandoned", label: "Abandoned", icon: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" },
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
      { href: "/forms", label: "Forms", icon: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" },
      { href: "/contacts", label: "Contacts", icon: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 21v-1a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v1" },
      { href: "/domains", label: "Domains", icon: "M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" },
      { href: "/analytics", label: "Analytics", icon: "M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-9" },
      { href: "/tracking", label: "Tracking", icon: "M12 2a10 10 0 1 0 10 10h-10V2Z" },
      { href: "/usage", label: "Usage", icon: "M12 20V10M6 20V4M18 20v-6" },
    ],
  },
];

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

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function Brand({ href, suffix }: { href: string; suffix?: string }) {
  return (
    <a href={href} className="font-display text-lg font-bold tracking-tight text-zinc-900">
      Invox<span className="text-gradient">AI</span>
      {suffix ? (
        <span className="ml-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
          {suffix}
        </span>
      ) : null}
    </a>
  );
}

function NavLinks({
  nav,
  pathname,
  onNavigate,
}: {
  nav: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {nav.map((group) => (
        <div key={group.heading}>
          <div className="px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted/80">
            {group.heading}
          </div>
          <div className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150",
                    active
                      ? "bg-gradient-to-r from-brand/[0.12] via-flame/[0.06] to-transparent font-medium text-brand-strong"
                      : "text-zinc-600 hover:translate-x-0.5 hover:bg-zinc-100 hover:text-zinc-900",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-gradient" />
                  ) : null}
                  <span className={active ? "text-brand-strong" : "text-muted transition group-hover:text-zinc-700"}>
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
  );
}

/**
 * Shared dashboard chrome (seller + admin): a high-contrast solid-white sidebar
 * on lg+, a slide-in drawer on mobile, and a sticky topbar. `nav` and `topRight`
 * are supplied by each app's thin client wrapper, keeping this package free of a
 * hard next/navigation dependency.
 */
export function DashboardShell({
  pathname,
  nav = SELLER_NAV,
  topRight,
  brandHref = "/",
  brandSuffix,
  barePrefixes = ["/login", "/onboarding"],
  children,
}: {
  pathname: string;
  nav?: NavGroup[];
  topRight?: ReactNode;
  brandHref?: string;
  brandSuffix?: string;
  barePrefixes?: string[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const bare = barePrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (bare) return <>{children}</>;

  return (
    <div className="min-h-screen bg-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200 bg-white shadow-[6px_0_28px_-20px_rgba(15,23,42,0.45)] lg:flex">
        <div className="flex h-16 items-center px-6">
          <Brand href={brandHref} suffix={brandSuffix} />
        </div>
        <NavLinks nav={nav} pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 animate-fadein bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 animate-slidein flex-col border-r border-zinc-200 bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between px-6">
              <Brand href={brandHref} suffix={brandSuffix} />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-muted hover:bg-zinc-100 hover:text-zinc-900"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <NavLinks nav={nav} pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-200 bg-ink/85 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-zinc-200 p-2 text-zinc-700 transition hover:bg-zinc-100 lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="lg:hidden">
            <Brand href={brandHref} suffix={brandSuffix} />
          </span>
          <div className="ml-auto flex items-center gap-2">{topRight}</div>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
