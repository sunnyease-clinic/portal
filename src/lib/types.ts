export type TrendPoint = {
  nhi_code: string;
  test_result_numeric: number | string | null;
  visit_date: string;
};

export type HistoricalReport = {
  report_month: string;
  final_output: string;
};

export type ClinicalRule = {
  rule_key: string;
  rule_value: string;
  unit?: string | null;
};

export type PatientDashboard = {
  display_name: string;
  trend_data: TrendPoint[];
  historical_reports: HistoricalReport[];
  last_updated: string | null;
};

export type DashboardResponse = {
  patient: PatientDashboard;
  rules: ClinicalRule[];
};

export type ShareDashboardResponse = {
  patients: PatientDashboard[];
  rules: ClinicalRule[];
  expires_at: string;
};
