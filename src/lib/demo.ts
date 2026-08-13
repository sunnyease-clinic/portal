import type { ClinicalRule, PatientDashboard, TrendPoint } from "./types";

const dates = ["2026-05-08", "2026-06-05", "2026-07-03", "2026-08-07"];
const series: Record<string, number[]> = {
  "09038C": [3.7, 3.6, 3.4, 3.3],
  URR: [63, 65, 67, 68],
  eKtV: [1.12, 1.18, 1.22, 1.25],
  "09022C": [5.1, 5.3, 5.5, 5.7],
  "09012C": [5.1, 5.4, 5.8, 6.1],
  "09011C": [8.8, 8.6, 8.4, 8.2],
  CaP_product: [44.9, 46.4, 48.7, 50.0],
  "09122C": [510, 560, 620, 680],
  "09027C": [116, 108, 101, 96],
  "08003C": [10.4, 10.2, 9.9, 9.6],
  "12116C": [620, 710, 820, 900],
  Tsat: [25, 23, 20, 18],
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
      final_output: "## 本月健康摘要\n\n透析清除效率已達建議範圍；部分營養、電解質與造血指標需要持續追蹤。這組展示數值刻意包含達標、偏高與偏低狀態，以呈現儀表板的判讀方式。\n\n- URR、eKt/V 與鈣磷乘積在建議範圍\n- 白蛋白與血色素偏低，請留意營養及造血狀態\n- 血鉀、血磷與副甲狀腺素偏高\n- 實際治療與飲食調整請依醫師指示",
    },
    {
      report_month: "2026-07",
      final_output: "## 七月追蹤\n\n透析效率逐步改善；營養、血磷與造血相關數值仍需追蹤。請依醫療團隊建議維持用藥與飲食管理。",
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
