"use client";

import dynamic from "next/dynamic";

const Inner = dynamic(() => import("./TrafficChartInner"), {
  ssr: false,
  loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-zinc-100" />,
});

export function TrafficChart({ data }: { data: { date: string; views: number }[] }) {
  return <Inner data={data} />;
}
