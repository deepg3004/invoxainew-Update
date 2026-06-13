/**
 * Server-safe pagination math (NO "use client" — pages call this during render).
 * Kept separate from the <Pagination> client component so the server can import it.
 */

/** Allowed rows-per-page options (the "custom page number" selector). */
export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Compute a clamped page + slice from the raw `page`/`size` search params. The
 * size is validated against PAGE_SIZES (default 10). Returns page, totalPages,
 * skip/take for the DB query, and the resolved pageSize (pass to <Pagination>).
 */
export function pageSlice(total: number, rawPage?: string, rawSize?: string) {
  const sizeNum = Number(rawSize);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeNum)
    ? sizeNum
    : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1), totalPages);
  return { page, totalPages, skip: (page - 1) * pageSize, take: pageSize, pageSize };
}
