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

type Point = { date: string; views: number };

export default function TrafficChartInner({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="invoxViews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
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
          width={36}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value) => [String(value), "Views"]}
          labelStyle={{ color: "#18181B", fontWeight: 500 }}
          contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", fontSize: 12 }}
          cursor={{ stroke: "#8B5CF6", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone"
          dataKey="views"
          stroke="#8B5CF6"
          strokeWidth={2.5}
          fill="url(#invoxViews)"
          animationDuration={900}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
