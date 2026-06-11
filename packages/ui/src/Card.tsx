import type { ReactNode } from "react";

export function Card({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      {title ? (
        <h2 className="mb-2 text-lg font-semibold text-neutral-900">{title}</h2>
      ) : null}
      <div className="text-neutral-600">{children}</div>
    </div>
  );
}
