"use client";

import dynamic from "next/dynamic";

// Recharts touches the DOM, so render it client-only (no SSR) with a skeleton.
const Inner = dynamic(() => import("./RevenueChartInner"), {
  ssr: false,
  loading: () => <div className="h-60 animate-pulse rounded-xl bg-zinc-100" />,
});

export function RevenueChart({
  data,
}: {
  data: { date: string; revenue: number; orders: number }[];
}) {
  return <Inner data={data} />;
}
