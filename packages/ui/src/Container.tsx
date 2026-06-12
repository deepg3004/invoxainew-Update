import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

// Centered max-width wrapper.
export function Container({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6", className)} {...rest}>
      {children}
    </div>
  );
}

// Vertical rhythm section.
export function Section({
  className,
  children,
  id,
}: {
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-20 sm:py-28", className)}>
      {children}
    </section>
  );
}
