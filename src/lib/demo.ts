import type { ClinicalRule, PatientDashboard, TrendPoint } from "./types";

const dates = ["2026-03-06", "2026-04-03", "2026-05-08", "2026-06-05", "2026-07-03", "2026-08-07"];
const hbDates = [
  "2026-03-06", "2026-03-20",
  "2026-04-03", "2026-04-17",
  "2026-05-08", "2026-05-22",
  "2026-06-05", "2026-06-19",
  "2026-07-03", "2026-07-17",
  "2026-08-07", "2026-08-21",
];
const series: Record<string, number[]> = {
  "09038C": [3.4, 3.7, 3.6, 3.9, 3.8, 4.0],
  URR: [62, 65, 64, 68, 66, 70],
  eKtV: [1.1, 1.18, 1.16, 1.25, 1.19, 1.3],
  "09022C": [5.8, 5.4, 5.6, 5.1, 5.4, 4.8],
  "09012C": [6.4, 5.9, 6.1, 5.2, 5.7, 5.0],
  "09011C": [8.0, 8.5, 8.3, 8.8, 8.5, 9.0],
  CaP_product: [51.2, 50.2, 50.6, 45.8, 48.5, 45.0],
  "09122C": [95, 115, 108, 135, 125, 140],
  "09027C": [175, 158, 165, 145, 152, 138],
  "12116C": [980, 840, 900, 720, 810, 650],
  Tsat: [16, 21, 19, 24, 21, 28],
};

const trendData: TrendPoint[] = [
  ...Object.entries(series).flatMap(([nhi_code, values]) =>
    values.map((test_result_numeric, index) => ({ nhi_code, test_result_numeric, visit_date: dates[index] })),
  ),
  ...[9.4, 9.6, 9.5, 9.8, 9.7, 10.0, 9.9, 10.3, 10.1, 10.4, 10.3, 10.6].map(
    (test_result_numeric, index) => ({ nhi_code: "08003C", test_result_numeric, visit_date: hbDates[index] }),
  ),
];

export const DEMO_PATIENT: PatientDashboard = {
  display_name: "示範病友",
  is_demo: true,
  trend_data: trendData,
  last_updated: "2026-08-10T09:00:00+08:00",
  historical_reports: [
    {
      report_month: "2026-08",
      final_output: "## 本月健康摘要\n\n整體檢驗趨勢穩定且逐步改善，營養、透析效率、電解質及造血指標皆已回到建議範圍。\n\n- 白蛋白、URR 與 eKt/V 均已達標\n- 血鉀、血磷與鈣磷乘積改善良好\n- PTH 仍稍低、ALP 仍稍高，但都比前期更接近建議區間\n- 請維持目前照護計畫，實際治療與飲食調整依醫師指示",
    },
    {
      report_month: "2026-07",
      final_output: "## 七月追蹤\n\n多項指標雖有自然波動，整體仍朝建議區間改善。請依醫療團隊建議維持用藥、飲食與透析照護。",
    },
  ],
  upcoming_appointments: [
    {
      appt_date: "2026-09-02",
      hospital_name: "台北榮民總醫院",
      dept_name: "心臟內科",
      doctor_name: "範例醫師",
      time_slot: "上午診",
      room: "診室 2103",
      appt_seq: "028",
    },
    {
      appt_date: "2026-09-14",
      hospital_name: "三軍總醫院",
      dept_name: "腎臟科",
      doctor_name: "範例醫師",
      time_slot: "下午診",
      room: "診室 139",
      appt_seq: "015",
    },
  ],
  active_medications: [
    {
      drug_name: "Calcium Acetate 667mg",
      brand_name: "CALOWLIN 磷結合劑",
      frequency: "TID 隨餐",
      prescribed_date: "2026-08-15",
      source_org: "健保雲端資訊網",
    },
    {
      drug_name: "Amlodipine 5mg",
      brand_name: "NORVASC 脈優錠",
      frequency: "QD 早",
      prescribed_date: "2026-08-15",
      source_org: "健保雲端資訊網",
    },
    {
      drug_name: "Darbepoetin Alfa",
      brand_name: "ARANESP 40MCG/ML",
      frequency: "QW 透析後",
      prescribed_date: "2026-08-18",
      source_org: "本院醫令",
    },
  ],
};

export const DEMO_RULES: ClinicalRule[] = [
  { rule_key: "albumin_target", rule_value: "3.5-5.0", unit: "g/dL", description: "白蛋白目標範圍（營養狀況指標）" },
  { rule_key: "urr_target", rule_value: ">65", unit: "%", description: "尿素清除率 (URR) 理想目標範圍" },
  { rule_key: "ktv_target", rule_value: ">1.2", unit: null, description: "透析清除率估計值 (eKt/V) 理想目標範圍" },
  { rule_key: "potassium_target", rule_value: "3.5-5.3", unit: "mmol/L", description: "鉀離子理想目標範圍" },
  { rule_key: "phosphorus_target", rule_value: "3.5-5.5", unit: "mg/dL", description: "磷離子理想目標範圍" },
  { rule_key: "calcium_target", rule_value: "8.4-10.2", unit: "mg/dL", description: "血鈣理想目標範圍" },
  { rule_key: "ca_p_product_target", rule_value: "<55", unit: null, description: "鈣磷乘積目標值" },
  { rule_key: "intact-PTH", rule_value: "150-600", unit: "pg/mL", description: "副甲狀腺素建議目標" },
  { rule_key: "alp_target", rule_value: "40-130", unit: "U/L", description: "鹼性磷酸酶參考範圍" },
  { rule_key: "hb_target_dialysis", rule_value: "10-11.5", unit: "g/dL", description: "洗腎病友黃金區間" },
  { rule_key: "ferritin_target", rule_value: "200-800", unit: "ng/mL", description: "體內的鐵質倉庫" },
  { rule_key: "tsat_target", rule_value: "20-50", unit: "%", description: "運送鐵質車隊的載客率" },
];
