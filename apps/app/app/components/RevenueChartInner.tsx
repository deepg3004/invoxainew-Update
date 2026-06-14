"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartResizeNudge } from "./useChartResizeNudge";

type Point = { date: string; revenue: number; orders: number };

const compact = (v: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v);
const full = (v: number) => "₹" + new Intl.NumberFormat("en-IN").format(v);

export default function RevenueChartInner({ data }: { data: Point[] }) {
  // Fixes the "blank chart on first load" measure race — see useChartResizeNudge.
  useChartResizeNudge();

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="invoxRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EC4899" stopOpacity={0.35} />
            <stop offset="55%" stopColor="#8B5CF6" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1E7E0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#78716C" }}
          tickLine={false}
          axisLine={{ stroke: "#F1E7E0" }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#78716C" }}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={compact}
        />
        <Tooltip
          formatter={(value) => [full(Number(value)), "Revenue"]}
          labelStyle={{ color: "#18181B", fontWeight: 500 }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E4E4E7",
            fontSize: 12,
            boxShadow: "0 8px 24px -12px rgba(0,0,0,.2)",
          }}
          cursor={{ stroke: "#EC4899", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#EC4899"
          strokeWidth={2.5}
          fill="url(#invoxRev)"
          animationDuration={900}
          dot={false}
          activeDot={{ r: 4, fill: "#EC4899", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
