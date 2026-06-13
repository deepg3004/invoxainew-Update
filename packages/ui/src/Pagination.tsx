/**
 * Shared list pagination — "Showing X–Y of N" + Prev/Next. Presentational only
 * (renders <a> links), so it works as a server component. The page computes the
 * slice and passes a `hrefFor(page)` builder that preserves its own query params.
 */
export function Pagination({
  page,
  totalPages,
  firstOnPage,
  lastOnPage,
  total,
  hrefFor,
  label = "",
}: {
  page: number;
  totalPages: number;
  firstOnPage: number;
  lastOnPage: number;
  total: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  const navCls = "rounded-lg border border-zinc-200 px-3 py-1.5 font-medium hover:bg-zinc-50";
  const disabledCls = "rounded-lg border border-zinc-200 px-3 py-1.5 text-muted/40";

  return (
    <div className="mt-6 flex items-center justify-between text-sm text-muted">
      <span>
        Showing {firstOnPage}–{lastOnPage} of {total}
        {label ? ` ${label}` : ""}
      </span>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <a href={hrefFor(page - 1)} className={navCls}>← Prev</a>
          ) : (
            <span className={disabledCls}>← Prev</span>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a href={hrefFor(page + 1)} className={navCls}>Next →</a>
          ) : (
            <span className={disabledCls}>Next →</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Compute a clamped page + slice for a fixed page size. `rawPage` is the raw
 * searchParam; `total` is the full count. Returns the page, totalPages, and the
 * skip/take for the DB query. (firstOnPage/lastOnPage are derived in the page once
 * the row count is known.)
 */
export function pageSlice(total: number, rawPage: string | undefined, pageSize = 10) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1), totalPages);
  return { page, totalPages, skip: (page - 1) * pageSize, take: pageSize, pageSize };
}
