import type { ReactNode } from "react";
import { cn } from "./cn";

// Compact KPI tile for dashboards.
export function StatCard({
  label,
  value,
  hint,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: "brand" | "warning" | "success";
  className?: string;
}) {
  const valueColor =
    accent === "warning"
      ? "text-warning"
      : accent === "success"
        ? "text-success"
        : "text-zinc-900";
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-card",
        className,
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={cn("mt-1.5 font-display text-2xl font-bold", valueColor)}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
