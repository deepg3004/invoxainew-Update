"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardShell } from "@invoxai/ui";

// Thin client wrapper: supplies the current path to the shared shell, so the
// design-system package stays free of a next/navigation dependency.
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <DashboardShell pathname={pathname}>{children}</DashboardShell>;
}
