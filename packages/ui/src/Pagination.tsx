"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PAGE_SIZES, DEFAULT_PAGE_SIZE } from "./pageSlice";

/**
 * Shared list pagination — a rows-per-page selector + "Showing X–Y of N" +
 * Prev/Next. Self-navigating: it reads the current path + query and rebuilds links
 * preserving every other param (search, status tabs, …), so a page just computes
 * its slice (via pageSlice) and drops <Pagination> in — no href builder needed.
 */
export function Pagination({
  page,
  totalPages,
  firstOnPage,
  lastOnPage,
  total,
  pageSize,
  label = "",
}: {
  page: number;
  totalPages: number;
  firstOnPage: number;
  lastOnPage: number;
  total: number;
  pageSize: number;
  label?: string;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();

  const hrefWith = (changes: Record<string, number | undefined>) => {
    const next = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(changes)) {
      // Drop defaults (page 1, size 10) to keep URLs clean.
      if (v === undefined || (k === "page" && v === 1) || (k === "size" && v === DEFAULT_PAGE_SIZE)) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    const s = next.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  const navCls = "rounded-lg border border-zinc-200 px-3 py-1.5 font-medium hover:bg-zinc-50";
  const disabledCls = "rounded-lg border border-zinc-200 px-3 py-1.5 text-muted/40";

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing {firstOnPage}–{lastOnPage} of {total}
          {label ? ` ${label}` : ""}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="text-xs">Rows</span>
          <select
            value={pageSize}
            onChange={(e) => router.push(hrefWith({ size: Number(e.target.value), page: 1 }))}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-brand"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        </label>
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={hrefWith({ page: page - 1 })} className={navCls}>← Prev</Link>
          ) : (
            <span className={disabledCls}>← Prev</span>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefWith({ page: page + 1 })} className={navCls}>Next →</Link>
          ) : (
            <span className={disabledCls}>Next →</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
