import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "brand" | "cyan" | "neutral" | "success";

const tones: Record<Tone, string> = {
  brand: "border-brand/30 bg-brand/10 text-accent",
  cyan: "border-cyan/30 bg-cyan/10 text-cyan",
  neutral: "border-white/10 bg-white/5 text-muted",
  success: "border-success/30 bg-success/10 text-success",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
