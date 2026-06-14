"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Wallet,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Sparkles,
  Link2,
  Package,
  Ticket,
  GraduationCap,
  CreditCard,
  ShoppingBag,
  Clock,
  Star,
  Store,
  Plug,
  Receipt,
  FileText,
  ClipboardList,
  Users,
  UsersRound,
  BadgeCheck,
  ArrowLeftRight,
  Coins,
  Globe,
  LineChart,
  Target,
  Gauge,
  History,
  type LucideIcon,
} from "lucide-react";
import { cn } from "./cn";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { heading: string; items: NavItem[] };

// Seller (app) navigation — exported so the seller shell wrapper can pass it in.
export const SELLER_NAV: NavGroup[] = [
  { heading: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    heading: "Build",
    items: [
      { href: "/ai-pages", label: "AI pages", icon: Sparkles },
      { href: "/bio", label: "Bio link", icon: Link2 },
      { href: "/storefront", label: "Storefront", icon: Store },
    ],
  },
  {
    heading: "Commerce",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/coupons", label: "Coupons", icon: Ticket },
      { href: "/courses", label: "Courses", icon: GraduationCap },
      { href: "/communities", label: "Communities", icon: UsersRound },
      { href: "/pay-pages", label: "Pay pages", icon: CreditCard },
      { href: "/orders", label: "Orders", icon: ShoppingBag },
      { href: "/reviews", label: "Reviews", icon: Star },
      { href: "/abandoned", label: "Abandoned", icon: Clock },
    ],
  },
  {
    heading: "Money",
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/wallet", label: "Wallet", icon: Wallet },
      { href: "/gateway", label: "Gateway", icon: Plug },
      { href: "/billing", label: "Billing", icon: Receipt },
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/feature-payments", label: "Feature charges", icon: Coins },
    ],
  },
  {
    heading: "Grow",
    items: [
      { href: "/forms", label: "Forms", icon: ClipboardList },
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/domains", label: "Domains", icon: Globe },
      { href: "/analytics", label: "Analytics", icon: LineChart },
      { href: "/tracking", label: "Tracking", icon: Target },
      { href: "/usage", label: "Usage", icon: Gauge },
      { href: "/verification", label: "Verification", icon: BadgeCheck },
      { href: "/activity", label: "Activity", icon: History },
    ],
  },
];

export type ShellUser = { name: string; email?: string | null };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  if (parts.length <= 1) return (first.slice(0, 2) || "?").toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function Brand({
  href,
  suffix,
  mark,
  logoUrl,
}: {
  href: string;
  suffix?: string;
  mark?: boolean;
  logoUrl?: string;
}) {
  if (mark) {
    return (
      <Link
        href={href}
        className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-brand-gradient font-display text-sm font-bold text-white"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          "IA"
        )}
      </Link>
    );
  }
  if (logoUrl) {
    return (
      <Link href={href} className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="InvoxAI" className="h-8 w-auto" />
      </Link>
    );
  }
  return (
    <Link href={href} className="font-display text-lg font-bold tracking-tight text-zinc-900">
      Invox<span className="text-gradient">AI</span>
      {suffix ? (
        <span className="ml-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">{suffix}</span>
      ) : null}
    </Link>
  );
}

function NavLinks({
  nav,
  pathname,
  collapsed,
  onNavigate,
}: {
  nav: NavGroup[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {nav.map((group) => (
        <div key={group.heading}>
          {!collapsed ? (
            <div className="px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted/80">
              {group.heading}
            </div>
          ) : (
            <div className="mx-3 mb-1 border-t border-zinc-100" />
          )}
          <div className="mt-1.5 space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const I = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl py-2 text-sm transition-all duration-150",
                    collapsed ? "justify-center px-0" : "px-3",
                    active
                      ? "bg-gradient-to-r from-brand/[0.12] via-flame/[0.06] to-transparent font-medium text-brand-strong"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                    !active && !collapsed ? "hover:translate-x-0.5" : "",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-gradient" />
                  ) : null}
                  <I
                    size={18}
                    strokeWidth={1.75}
                    className={active ? "text-brand-strong" : "text-muted transition group-hover:text-zinc-700"}
                  />
                  {!collapsed ? item.label : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Profile({ user, signOutAction, collapsed }: { user: ShellUser; signOutAction: string; collapsed?: boolean }) {
  return (
    <div className="border-t border-zinc-200 p-3">
      <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-semibold text-white"
          title={user.name}
        >
          {initials(user.name)}
        </div>
        {!collapsed ? (
          <>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-zinc-900">{user.name}</div>
              {user.email ? <div className="truncate text-xs text-muted">{user.email}</div> : null}
            </div>
            <form action={signOutAction} method="post">
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="rounded-lg p-1.5 text-muted transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                <LogOut size={16} />
              </button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Shared dashboard chrome (seller + admin): a high-contrast collapsible sidebar
 * (icon-only ↔ icon+text, persisted), a mobile drawer, a sticky topbar with a
 * notification bell + wallet pill, and a bottom user profile. Resets scroll to
 * the top on every navigation.
 */
export function DashboardShell({
  pathname,
  nav = SELLER_NAV,
  brandHref = "/",
  brandSuffix,
  logoUrl,
  barePrefixes = ["/login", "/onboarding"],
  user,
  walletLabel,
  walletHref = "/wallet",
  notificationsHref,
  unreadCount = 0,
  signOutAction = "/auth/signout",
  children,
}: {
  pathname: string;
  nav?: NavGroup[];
  brandHref?: string;
  brandSuffix?: string;
  logoUrl?: string;
  barePrefixes?: string[];
  user?: ShellUser | null;
  walletLabel?: string | null;
  walletHref?: string;
  notificationsHref?: string;
  unreadCount?: number;
  signOutAction?: string;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the collapsed preference after mount (avoids an SSR mismatch).
  useEffect(() => {
    setCollapsed(typeof window !== "undefined" && localStorage.getItem("invox-nav-collapsed") === "1");
  }, []);

  // Reset scroll to the top on every route change.
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") localStorage.setItem("invox-nav-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const bare = barePrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (bare) return <>{children}</>;

  return (
    <div className="min-h-screen bg-ink">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-zinc-200 bg-white shadow-[6px_0_28px_-20px_rgba(15,23,42,0.45)] transition-[width] duration-200 lg:flex print:hidden",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className={cn("flex h-16 items-center", collapsed ? "justify-center px-0" : "justify-between px-6")}>
          <Brand href={brandHref} suffix={brandSuffix} mark={collapsed} logoUrl={logoUrl} />
          {!collapsed ? (
            <button
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse"
              className="rounded-lg p-1.5 text-muted transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <PanelLeftClose size={18} />
            </button>
          ) : null}
        </div>
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand"
            className="mx-auto mb-1 rounded-lg p-1.5 text-muted transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <PanelLeftOpen size={18} />
          </button>
        ) : null}
        <NavLinks nav={nav} pathname={pathname} collapsed={collapsed} />
        {user ? <Profile user={user} signOutAction={signOutAction} collapsed={collapsed} /> : null}
      </aside>

      {/* Mobile drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 animate-fadein bg-black/30 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 animate-slidein flex-col border-r border-zinc-200 bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between px-6">
              <Brand href={brandHref} suffix={brandSuffix} logoUrl={logoUrl} />
              <button onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-muted hover:bg-zinc-100 hover:text-zinc-900">
                <X size={18} />
              </button>
            </div>
            <NavLinks nav={nav} pathname={pathname} onNavigate={() => setDrawer(false)} />
            {user ? <Profile user={user} signOutAction={signOutAction} /> : null}
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className={cn("transition-[padding] duration-200 print:!pl-0", collapsed ? "lg:pl-16" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-200 bg-ink/85 px-4 backdrop-blur-xl sm:px-6 print:hidden">
          <button
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="rounded-lg border border-zinc-200 p-2 text-zinc-700 transition hover:bg-zinc-100 lg:hidden"
          >
            <Menu size={18} />
          </button>
          <span className="lg:hidden">
            <Brand href={brandHref} suffix={brandSuffix} logoUrl={logoUrl} />
          </span>
          <div className="ml-auto flex items-center gap-2">
            {walletLabel != null ? (
              <Link
                href={walletHref}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                title="Wallet balance"
              >
                <Wallet size={16} className="text-brand-strong" />
                {walletLabel}
              </Link>
            ) : null}
            {notificationsHref ? (
              <Link
                href={notificationsHref}
                aria-label="Notifications"
                className="relative rounded-lg border border-zinc-200 p-2 text-zinc-700 transition hover:bg-zinc-50"
              >
                <Bell size={18} />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            ) : null}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 print:!p-0">{children}</main>
      </div>
    </div>
  );
}
