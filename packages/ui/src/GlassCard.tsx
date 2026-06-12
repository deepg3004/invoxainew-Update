import type { HTMLAttributes } from "react";
import { cn } from "./cn";

// Glassmorphism surface used across the premium-dark UI.
export function GlassCard({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl",
        "shadow-card",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
