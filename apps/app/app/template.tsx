import type { ReactNode } from "react";

// Re-mounts on every navigation, so the page content fades up on each route
// change — a subtle page transition. The sidebar lives in the layout and stays put.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
