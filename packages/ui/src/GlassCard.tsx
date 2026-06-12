import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

// Glassmorphism surface used across the premium-dark UI.
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
        "rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl",
        "shadow-card",
        className,
      )}
      {...rest}
    >
      {title ? (
        <h2 className="mb-3 font-display text-base font-semibold text-white">
          {title}
        </h2>
      ) : null}
      {children}
    </div>
  );
}
