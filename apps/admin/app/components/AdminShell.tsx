import type { ReactNode } from "react";
import { AdminShellClient } from "./AdminShellClient";

/** Left-sidebar chrome shared by every authorized admin page. Keeps the same
 *  `email`-prop server API so all admin pages stay unchanged; the sidebar +
 *  active-route highlighting live in the client wrapper. */
export function AdminShell({
  email,
  children,
}: {
  email: string | null | undefined;
  children: ReactNode;
}) {
  return <AdminShellClient email={email}>{children}</AdminShellClient>;
}
