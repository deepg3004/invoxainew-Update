"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardShell, SELLER_NAV } from "@invoxai/ui";

export type Chrome = {
  name: string;
  email: string | null;
  walletLabel: string;
  unread: number;
} | null;

// Thin client wrapper: supplies the path + seller nav + header data (wallet,
// unread bell, user profile) to the shared shell, keeping the design-system
// package free of next/navigation and data deps.
export function Shell({ chrome, children }: { chrome: Chrome; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <DashboardShell
      pathname={pathname}
      nav={SELLER_NAV}
      user={chrome ? { name: chrome.name, email: chrome.email } : null}
      walletLabel={chrome?.walletLabel ?? null}
      notificationsHref="/notifications"
      unreadCount={chrome?.unread ?? 0}
    >
      {children}
    </DashboardShell>
  );
}
