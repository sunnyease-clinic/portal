import type { ClinicalRule, TrendPoint } from "./types";

export type Metric = {
  key: string;
  label: string;
  unit: string;
  ruleKey: string;
  fallback: [number | null, number | null];
  summaryHint: string;
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
      {
        key: "09038C",
        label: "白蛋白 Albumin",
        unit: "g/dL",
        ruleKey: "albumin_target",
        fallback: [3.8, 5],
        summaryHint: "反映體內蛋白質與整體營養狀況的重要指標",
      },
      {
        key: "URR",
        label: "尿素清除率 URR",
        unit: "%",
        ruleKey: "urr_target",
        fallback: [65, null],
        targetHint: "> 65%",
        summaryHint: "衡量單次洗腎清除體內尿毒素的比例，越高代表清除越充分",
      },
      {
        key: "eKtV",
        label: "透析清除率 eKt/V",
        unit: "",
        ruleKey: "ktv_target",
        fallback: [1.2, null],
        targetHint: "> 1.2",
        summaryHint: "評估透析治療劑量是否充足的國際標準指標",
      },
      {
        key: "09022C",
        label: "血鉀 Potassium",
        unit: "mmol/L",
        ruleKey: "potassium_target",
        fallback: [3.5, 5.5],
        summaryHint: "維持心跳與肌肉節律穩定，過高可能影響心臟安全",
      },
    ],
  },
  {
    id: "ckd-mbd",
    title: "鈣磷代謝",
    description: "骨骼礦物質、鈣磷平衡與副甲狀腺功能",
    metrics: [
      {
        key: "09012C",
        label: "血磷 Phosphorus",
        unit: "mg/dL",
        ruleKey: "phosphorus_target",
        fallback: [3.5, 5.5],
        summaryHint: "高血磷容易造成皮膚搔癢、骨質流失與血管鈣化",
      },
      {
        key: "09011C",
        label: "血鈣 Calcium",
        unit: "mg/dL",
        ruleKey: "calcium_target",
        fallback: [8.4, 10.2],
        summaryHint: "骨骼健康與神經肌肉傳導所需，須與血磷一同平衡",
      },
      {
        key: "CaP_product",
        label: "鈣磷乘積 Ca × P",
        unit: "",
        ruleKey: "ca_p_product_target",
        fallback: [null, 55],
        targetHint: "< 55",
        summaryHint: "血鈣與血磷數值相乘，偏高會增加血管與軟組織鈣化風險",
      },
      {
        key: "09122C",
        label: "副甲狀腺素 i-PTH",
        unit: "pg/mL",
        ruleKey: "intact-PTH",
        fallback: [150, 600],
        summaryHint: "調節鈣磷與骨代謝的荷爾蒙，幫助預防腎性骨病變",
      },
      {
        key: "09027C",
        label: "鹼性磷酸酶 ALP",
        unit: "U/L",
        ruleKey: "alp_target",
        fallback: [40, 130],
        summaryHint: "輔助觀察骨骼代謝活性及肝膽狀況的酵素指標",
      },
    ],
  },
  {
    id: "anemia",
    title: "造血與鐵質",
    description: "血色素與體內鐵質利用狀況",
    metrics: [
      {
        key: "08003C",
        label: "血色素 Hb",
        unit: "g/dL",
        ruleKey: "hb_target_dialysis",
        fallback: [10, 11.5],
        summaryHint: "洗腎病友黃金區間，維持適當體力與心肺負荷",
      },
      {
        key: "12116C",
        label: "鐵蛋白 Ferritin",
        unit: "ng/mL",
        ruleKey: "ferritin_target",
        fallback: [200, 800],
        summaryHint: "代表體內鐵質儲存倉庫的庫存量，造血需要充足鐵質",
      },
      {
        key: "Tsat",
        label: "鐵飽和度 TSAT",
        unit: "%",
        ruleKey: "tsat_target",
        fallback: [20, 50],
        summaryHint: "運送鐵質給骨髓造血的車隊實際載客率",
      },
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

export function getMetricDescription(metric: Metric, rules: ClinicalRule[]): string {
  const rule = rules.find((item) => item.rule_key === metric.ruleKey);
  const desc = rule?.description?.trim();
  return desc || metric.summaryHint;
}

export function pointsForMetric(data: TrendPoint[], metricKey: string): ChartPoint[] {
  const grouped = new Map<string, number[]>();
  for (const point of data) {
    if (point.nhi_code !== metricKey) continue;
    if (
      point.test_result_numeric === null ||
      point.test_result_numeric === undefined ||
      (typeof point.test_result_numeric === "string" && point.test_result_numeric.trim() === "")
    ) {
      continue;
    }
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

export function cleanSourceOrg(raw?: string | null): string {
  const text = (raw || "").trim();
  if (!text) return "";
  if (text.includes("Codex") || text.includes("本機醫令")) return "本院醫令";
  return text.replace(/\d{8,}$/, "").trim();
}

export function formatDoctorLabel(raw?: string | null): string {
  const text = (raw || "").trim();
  if (!text) return "";
  return text.endsWith("醫師") ? text : `${text} 醫師`;
}

export function filterPointsByMonths(points: ChartPoint[], months: 3 | 6 | 12): ChartPoint[] {
  if (months === 12 || points.length <= 1) return points;
  const anchor = new Date(`${points.at(-1)!.date}T00:00:00Z`);
  if (Number.isNaN(anchor.getTime())) return points;
  const cutoff = new Date(anchor);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const sliced = points.filter((point) => point.date >= cutoffIso);
  return sliced.length >= 2 ? sliced : points.slice(-Math.min(points.length, 3));
}

export function formatShortDate(isoDate: string): string {
  const parts = isoDate.slice(0, 10).split("-");
  if (parts.length !== 3) return isoDate;
  return `${Number(parts[1])}/${Number(parts[2])}`;
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
