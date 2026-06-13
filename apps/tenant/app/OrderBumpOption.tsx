"use client";

import { formatRupees } from "@invoxai/utils/money";

export type BumpInfo = {
  id: string;
  title: string;
  pricePaise: number;
  compareAtPaise: number | null;
  imageUrl: string | null;
  blurb: string | null;
};

/**
 * One-tap order-bump card shown at checkout (product pages + cart). Display only —
 * checking it just sets a boolean the checkout action sends; the bump's price and
 * stock are re-fetched server-trusted before the order is created.
 */
export function OrderBumpOption({
  bump,
  checked,
  onChange,
}: {
  bump: BumpInfo;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const onSale = bump.compareAtPaise != null && bump.compareAtPaise > bump.pricePaise;
  return (
    <label
      className={`mt-3 flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition ${
        checked ? "border-brand bg-brand/5" : "border-dashed border-zinc-300 hover:border-brand/40"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0"
      />
      {bump.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bump.imageUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-md border border-zinc-200 object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900">Add: {bump.title}</p>
        {bump.blurb ? <p className="text-xs text-muted">{bump.blurb}</p> : null}
        <p className="mt-0.5 text-sm">
          <span className="font-semibold text-zinc-900">{formatRupees(bump.pricePaise)}</span>
          {onSale ? (
            <span className="ml-1.5 text-xs text-muted line-through">
              {formatRupees(bump.compareAtPaise!)}
            </span>
          ) : null}
        </p>
      </div>
    </label>
  );
}
