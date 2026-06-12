"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardShell, SELLER_NAV } from "@invoxai/ui";

// Thin client wrapper: supplies the current path + seller nav + topbar actions to
// the shared shell, so the design-system package stays free of next/navigation.
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <DashboardShell
      pathname={pathname}
      nav={SELLER_NAV}
      topRight={
        <>
          <a
            href="/notifications"
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-muted transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            Notifications
          </a>
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
