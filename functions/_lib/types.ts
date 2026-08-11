export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_ANON_KEY: string;
  PORTAL_SESSION_SECRET: string;
  PORTAL_BFF_SECRET: string;
  TURNSTILE_SECRET_KEY?: string;
  PORTAL_SESSION_TTL_SECONDS?: string;
}

export type PatientSession = {
  scope: "patient";
  cloudId: string;
  iat: number;
  exp: number;
  jti: string;
};

export type ShareSession = {
  scope: "share";
  shareId: string;
  iat: number;
  exp: number;
  jti: string;
};

export type PortalSession = PatientSession | ShareSession;

export type CloudPatientRow = {
  cloud_id: string;
  display_name: string | null;
  trend_data: unknown[] | null;
  historical_reports: unknown[] | null;
  last_updated: string | null;
};

export type CloudShareRow = {
  share_id: string;
  patient_ids: string[];
  birth_years: number[];
  require_verification: boolean | null;
  expires_at: string;
};
