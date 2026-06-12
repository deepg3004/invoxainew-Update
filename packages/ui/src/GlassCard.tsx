import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

// Light card surface used across the Sunset Gradient UI.
// Optional `title` mirrors the legacy Card API so app pages can swap in place.
export function GlassCard({
  className,
  children,
  title,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { title?: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white p-6",
        "shadow-card",
        className,
      )}
      {...rest}
    >
      {title ? (
        <h2 className="mb-3 font-display text-base font-semibold text-zinc-900">
          {title}
        </h2>
      ) : null}
      {children}
    </div>
  );
}
