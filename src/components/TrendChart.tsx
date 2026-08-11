import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint, Metric } from "../lib/clinical";

export default function TrendChart({ points, target, metric, min, max, padding }: {
  points: ChartPoint[];
  target: [number | null, number | null];
  metric: Metric;
  min: number;
  max: number;
  padding: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={points} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5).replace("-", "/")} tick={{ fontSize: 11, fill: "var(--muted)" }} />
        <YAxis domain={[min - padding, max + padding]} tick={{ fontSize: 11, fill: "var(--muted)" }} />
        {target[0] !== null && target[1] !== null && (
          <ReferenceArea y1={target[0]} y2={target[1]} fill="var(--target)" fillOpacity={0.18} />
        )}
        <Tooltip
          labelFormatter={(label) => `日期 ${label}`}
          formatter={(value) => [`${Number(value).toFixed(1)} ${metric.unit}`, metric.label]}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}
        />
        <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: "var(--accent)" }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
