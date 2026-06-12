"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardShell, type NavGroup } from "@invoxai/ui";
import { LayoutDashboard, Store, Users, BarChart3, Layers, Star, Tag, Settings } from "lucide-react";

const ADMIN_NAV: NavGroup[] = [
  { heading: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    heading: "Sellers",
    items: [
      { href: "/tenants", label: "Tenants", icon: Store },
      { href: "/buyers", label: "Buyers", icon: Users },
    ],
  },
  {
    heading: "Revenue",
    items: [{ href: "/reports", label: "Reports", icon: BarChart3 }],
  },
  {
    heading: "Config",
    items: [
      { href: "/plans", label: "Plans", icon: Layers },
      { href: "/features", label: "Features", icon: Star },
      { href: "/pricing", label: "Pricing", icon: Tag },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Client shell wrapper for the admin app — collapsible left sidebar + profile. */
export function AdminShellClient({
  email,
  alerts = 0,
  children,
}: {
  email: string | null | undefined;
  alerts?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <DashboardShell
      pathname={pathname}
      nav={ADMIN_NAV}
      brandSuffix="admin"
      barePrefixes={["/login"]}
      user={{ name: email ?? "Admin", email }}
      notificationsHref="/notifications"
      unreadCount={alerts}
    >
      {children}
    </DashboardShell>
  );
}
