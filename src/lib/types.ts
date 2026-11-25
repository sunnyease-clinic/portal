export type TrendPoint = {
  nhi_code: string;
  test_result_numeric: number | string | null;
  visit_date: string;
};

export type HistoricalReport = {
  report_month: string;
  final_output: string;
};

export type UpcomingAppointment = {
  appt_date: string;
  hospital_name: string;
  dept_name?: string | null;
  doctor_name?: string | null;
  time_slot?: string | null;
  room?: string | null;
  appt_seq?: string | null;
};

export type ActiveMedication = {
  drug_name: string;
  brand_name?: string | null;
  frequency?: string | null;
  prescribed_date?: string | null;
  source_org?: string | null;
};

export type ClinicalRule = {
  rule_key: string;
  rule_value: string;
  unit?: string | null;
  description?: string | null;
};

export type PatientDashboard = {
  display_name: string;
  is_demo?: boolean;
  trend_data: TrendPoint[];
  historical_reports: HistoricalReport[];
  upcoming_appointments?: UpcomingAppointment[];
  active_medications?: ActiveMedication[];
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
