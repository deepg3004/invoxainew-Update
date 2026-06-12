"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Slice = { name: string; value: number };

const COLORS = ["#EC4899", "#F97316", "#8B5CF6", "#10B981"];
const compact = (v: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v);

export default function RevenueBreakdownChartInner({ data }: { data: Slice[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1E7E0" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#78716C" }}
          tickLine={false}
          axisLine={{ stroke: "#F1E7E0" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#78716C" }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={compact}
        />
        <Tooltip
          formatter={(value) => [
            "₹" + new Intl.NumberFormat("en-IN").format(Number(value)),
            "Amount",
          ]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E4E4E7",
            fontSize: 12,
            boxShadow: "0 8px 24px -12px rgba(0,0,0,.2)",
          }}
          cursor={{ fill: "rgba(236,72,153,0.06)" }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={900}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
