"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardShell, type NavGroup } from "@invoxai/ui";

const ADMIN_NAV: NavGroup[] = [
  {
    heading: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: "M4 5h16M4 12h10M4 19h16" }],
  },
  {
    heading: "Sellers",
    items: [
      { href: "/tenants", label: "Tenants", icon: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 21v-1a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v1" },
      { href: "/buyers", label: "Buyers", icon: "M3 7h18v10H3zM3 11h18" },
    ],
  },
  {
    heading: "Revenue",
    items: [
      { href: "/reports", label: "Reports", icon: "M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-9" },
    ],
  },
  {
    heading: "Config",
    items: [
      { href: "/plans", label: "Plans", icon: "M3 7h18v10H3zM3 11h18" },
      { href: "/features", label: "Features", icon: "M12 2l2.4 6.9H22l-6 4.3 2.3 7-6.3-4.5L5.7 20l2.3-7-6-4.3h7.6L12 2Z" },
      { href: "/pricing", label: "Pricing", icon: "M3 9a2 2 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" },
    ],
  },
];

/** Client shell wrapper for the admin app — left sidebar via the shared shell. */
export function AdminShellClient({
  email,
  children,
}: {
  email: string | null | undefined;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <DashboardShell
      pathname={pathname}
      nav={ADMIN_NAV}
      brandSuffix="admin"
      barePrefixes={["/login"]}
      topRight={
        <>
          {email ? (
            <span className="hidden text-sm text-muted sm:inline">{email}</span>
          ) : null}
          <form action="/auth/signout" method="post">
            <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-muted transition hover:bg-zinc-50 hover:text-zinc-900">
              Sign out
            </button>
          </form>
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}
