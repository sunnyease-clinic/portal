import type { ClinicalRule, TrendPoint } from "./types";

export type Metric = {
  key: string;
  label: string;
  unit: string;
  ruleKey: string;
  fallback: [number | null, number | null];
  chartColor: string;
  targetHint?: string;
};

export type MetricGroup = {
  id: string;
  title: string;
  description: string;
  metrics: Metric[];
};

export type ChartPoint = { date: string; value: number };

export const METRIC_GROUPS: MetricGroup[] = [
  {
    id: "nutrition",
    title: "營養與代謝",
    description: "營養狀態、透析清除效率與重要電解質",
    metrics: [
      { key: "09038C", label: "白蛋白 Albumin", unit: "g/dL", ruleKey: "albumin_target", fallback: [3.8, 5], chartColor: "#f59e0b" },
      { key: "URR", label: "尿素清除率 URR", unit: "%", ruleKey: "urr_target", fallback: [65, null], chartColor: "#2563eb", targetHint: "> 65%" },
      { key: "eKtV", label: "透析清除率 eKt/V", unit: "", ruleKey: "ktv_target", fallback: [1.2, null], chartColor: "#7c3aed", targetHint: "> 1.2" },
      { key: "09022C", label: "血鉀 Potassium", unit: "mmol/L", ruleKey: "potassium_target", fallback: [3.5, 5.5], chartColor: "#e11d48" },
    ],
  },
  {
    id: "ckd-mbd",
    title: "鈣磷代謝",
    description: "骨骼礦物質、鈣磷平衡與副甲狀腺功能",
    metrics: [
      { key: "09012C", label: "血磷 Phosphorus", unit: "mg/dL", ruleKey: "phosphorus_target", fallback: [3.5, 5.5], chartColor: "#9333ea" },
      { key: "09011C", label: "血鈣 Calcium", unit: "mg/dL", ruleKey: "calcium_target", fallback: [8.4, 10.2], chartColor: "#0891b2" },
      { key: "CaP_product", label: "鈣磷乘積 Ca × P", unit: "", ruleKey: "ca_p_product_target", fallback: [null, 55], chartColor: "#dc2626", targetHint: "< 55" },
      { key: "09122C", label: "副甲狀腺素 i-PTH", unit: "pg/mL", ruleKey: "intact-PTH", fallback: [150, 600], chartColor: "#ea580c" },
      { key: "09027C", label: "鹼性磷酸酶 ALP", unit: "U/L", ruleKey: "alp_target", fallback: [40, 130], chartColor: "#16a34a" },
    ],
  },
  {
    id: "anemia",
    title: "造血與鐵質",
    description: "血色素與體內鐵質利用狀況",
    metrics: [
      { key: "08003C", label: "血色素 Hb", unit: "g/dL", ruleKey: "hb_target_dialysis", fallback: [10, 11.5], chartColor: "#e11d48" },
      { key: "12116C", label: "鐵蛋白 Ferritin", unit: "ng/mL", ruleKey: "ferritin_target", fallback: [200, 800], chartColor: "#d97706" },
      { key: "Tsat", label: "鐵飽和度 TSAT", unit: "%", ruleKey: "tsat_target", fallback: [20, 50], chartColor: "#0d9488" },
    ],
  },
];

export function parseRule(value: string): [number | null, number | null] | null {
  const normalized = value.trim().replace(/\s/g, "");
  const range = normalized.match(/^(-?\d+(?:\.\d+)?)[–~-](-?\d+(?:\.\d+)?)$/);
  if (range) return [Number(range[1]), Number(range[2])];
  const upper = normalized.match(/^<=(\d+(?:\.\d+)?)$/) ?? normalized.match(/^<(\d+(?:\.\d+)?)$/);
  if (upper) return [null, Number(upper[1])];
  const lower = normalized.match(/^>=(\d+(?:\.\d+)?)$/) ?? normalized.match(/^>(\d+(?:\.\d+)?)$/);
  if (lower) return [Number(lower[1]), null];
  return null;
}

export function getTarget(metric: Metric, rules: ClinicalRule[]): [number | null, number | null] {
  const rule = rules.find((item) => item.rule_key === metric.ruleKey);
  return (rule && parseRule(rule.rule_value)) || metric.fallback;
}

export function pointsForMetric(data: TrendPoint[], metricKey: string): ChartPoint[] {
  const grouped = new Map<string, number[]>();
  for (const point of data) {
    if (point.nhi_code !== metricKey) continue;
    const numeric = Number(point.test_result_numeric);
    if (!Number.isFinite(numeric) || !point.visit_date) continue;
    const date = point.visit_date.slice(0, 10);
    grouped.set(date, [...(grouped.get(date) ?? []), numeric]);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({
      date,
      value: values.reduce((sum, item) => sum + item, 0) / values.length,
    }));
}

export function statusFor(value: number, target: [number | null, number | null]): "達標" | "偏高" | "偏低" {
  const [low, high] = target;
  if (low !== null && value < low) return "偏低";
  if (high !== null && value > high) return "偏高";
  return "達標";
}

export function trendLabel(points: ChartPoint[]): string {
  if (points.length < 2) return "";
  const latest = points.at(-1)!.value;
  const previous = points.at(-2)!.value;
  const difference = latest - previous;
  if (Math.abs(difference) < Math.max(Math.abs(latest) * 0.01, 0.001)) return "→ 穩定";
  return difference > 0 ? `↑ +${difference.toFixed(1)}` : `↓ ${difference.toFixed(1)}`;
}
