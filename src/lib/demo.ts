import type { ClinicalRule, PatientDashboard, TrendPoint } from "./types";

const dates = ["2026-05-08", "2026-06-05", "2026-07-03", "2026-08-07"];
const series: Record<string, number[]> = {
  "09038C": [3.6, 3.8, 3.9, 4.0],
  URR: [63, 66, 68, 70],
  eKtV: [1.12, 1.22, 1.28, 1.31],
  "09022C": [5.6, 5.2, 4.9, 4.7],
  "09012C": [6.2, 5.8, 5.3, 4.9],
  "09011C": [8.6, 8.8, 9.0, 9.1],
  CaP_product: [53.3, 51.0, 47.7, 44.6],
  "09122C": [520, 470, 410, 360],
  "09027C": [116, 108, 101, 96],
  "08003C": [9.7, 10.1, 10.4, 10.7],
  "12116C": [260, 310, 350, 390],
  Tsat: [18, 22, 25, 28],
};

const trendData: TrendPoint[] = Object.entries(series).flatMap(([nhi_code, values]) =>
  values.map((test_result_numeric, index) => ({ nhi_code, test_result_numeric, visit_date: dates[index] })),
);

export const DEMO_PATIENT: PatientDashboard = {
  display_name: "示範病友",
  is_demo: true,
  trend_data: trendData,
  last_updated: "2026-08-10T09:00:00+08:00",
  historical_reports: [
    {
      report_month: "2026-08",
      final_output: "## 本月健康摘要\n\n整體檢驗趨勢穩定，透析清除效率已達建議範圍。血磷持續改善，請繼續依照醫療團隊建議控制飲食與用藥。\n\n- 白蛋白與血鉀在建議範圍\n- 血色素較上月進步\n- 如有不適，請儘早與診所聯絡",
    },
    {
      report_month: "2026-07",
      final_output: "## 七月追蹤\n\n營養與透析效率大致穩定。鈣磷數值逐步接近建議區間，請維持目前的照護計畫。",
    },
  ],
};

export const DEMO_RULES: ClinicalRule[] = [
  { rule_key: "albumin_target", rule_value: "3.5-5.0", unit: "g/dL" },
  { rule_key: "urr_target", rule_value: ">65", unit: "%" },
  { rule_key: "ktv_target", rule_value: ">1.2", unit: null },
  { rule_key: "potassium_target", rule_value: "3.5-5.3", unit: "mmol/L" },
  { rule_key: "phosphorus_target", rule_value: "3.5-5.5", unit: "mg/dL" },
  { rule_key: "calcium_target", rule_value: "8.4-10.2", unit: "mg/dL" },
  { rule_key: "ca_p_product_target", rule_value: "<55", unit: null },
  { rule_key: "intact-PTH", rule_value: "150-600", unit: "pg/mL" },
  { rule_key: "alp_target", rule_value: "40-130", unit: "U/L" },
  { rule_key: "hb_target_dialysis", rule_value: "10-11.5", unit: "g/dL" },
  { rule_key: "ferritin_target", rule_value: "200-800", unit: "ng/mL" },
  { rule_key: "tsat_target", rule_value: "20-50", unit: "%" },
];
