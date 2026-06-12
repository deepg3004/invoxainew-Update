import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "brand" | "cyan" | "neutral" | "success";

const tones: Record<Tone, string> = {
  brand: "border-pink-200 bg-pink-50 text-pink-700",
  cyan: "border-violet-200 bg-violet-50 text-violet-700",
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
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
