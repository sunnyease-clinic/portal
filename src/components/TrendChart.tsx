import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
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
  const axis = niceAxis(min, max, padding);
  const [lowTarget, highTarget] = target;
  const targetArea = targetAreaBounds(target, axis.domain);

  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={points} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5).replace("-", "/")} tick={{ fontSize: 11, fill: "var(--muted)" }} />
        <YAxis
          domain={axis.domain}
          ticks={axis.ticks}
          tickFormatter={formatAxisTick}
          allowDecimals
          tick={{ fontSize: 11, fill: "var(--muted)" }}
        />
        <ReferenceArea y1={targetArea[0]} y2={targetArea[1]} fill="var(--accent)" fillOpacity={0.1} />
        {lowTarget !== null && <ReferenceLine y={lowTarget} stroke="var(--accent)" strokeDasharray="5 4" strokeOpacity={0.75} />}
        {highTarget !== null && <ReferenceLine y={highTarget} stroke="var(--accent)" strokeDasharray="5 4" strokeOpacity={0.75} />}
        <Tooltip
          labelFormatter={(label) => `日期 ${label}`}
          formatter={(value) => [`${Number(value).toFixed(1)} ${metric.unit}`, metric.label]}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--accent)"
          strokeWidth={3}
          dot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "var(--accent)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function targetAreaBounds(
  [low, high]: [number | null, number | null],
  [axisLow, axisHigh]: [number, number],
): [number, number] {
  return [low ?? axisLow, high ?? axisHigh];
}

export function niceAxis(min: number, max: number, padding = 0) {
  const spread = Math.max(max - min, padding, 0.5);
  const desiredStep = spread / 5;
  const steps = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000];
  const step = steps.find((candidate) => candidate >= desiredStep) ?? Math.ceil(desiredStep / 1000) * 1000;
  const lower = Math.max(0, Math.floor((min - step * 0.5) / step) * step);
  const upper = Math.ceil((max + step * 0.5) / step) * step;
  const ticks: number[] = [];
  for (let value = lower; value <= upper + step / 10; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return { domain: [lower, upper] as [number, number], ticks, step };
}

function formatAxisTick(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
