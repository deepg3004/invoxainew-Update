import type { ReactNode } from "react";

/**
 * Standard page header used at the top of every dashboard page (seller + admin):
 * an optional uppercase eyebrow, the title, an optional description, and an
 * optional right-aligned actions slot (buttons, tabs, search).
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-zinc-900">
          {title}
        </h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
