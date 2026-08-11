import type { CloudPatientRow, CloudShareRow, Env } from "./types";

function baseHeaders(env: Env): HeadersInit {
  const headers: Record<string, string> = {
    apikey: env.SUPABASE_SECRET_KEY,
    "Content-Type": "application/json",
  };

  // Legacy service_role keys are JWTs. New sb_secret_ keys belong only in apikey.
  if (env.SUPABASE_SECRET_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${env.SUPABASE_SECRET_KEY}`;
  }

  return headers;
}

async function selectRows<T>(env: Env, path: string): Promise<T[]> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { headers: baseHeaders(env) });
  if (!response.ok) throw new Error(`supabase_select_${response.status}`);
  return (await response.json()) as T[];
}

export async function getPatient(env: Env, cloudId: string): Promise<CloudPatientRow | null> {
  const select = "cloud_id,display_name,trend_data,historical_reports,last_updated";
  const rows = await selectRows<CloudPatientRow>(env, `cloud_patients?select=${select}&cloud_id=eq.${encodeURIComponent(cloudId)}&limit=1`);
  return rows[0] ?? null;
}

export async function getPatients(env: Env, cloudIds: string[]): Promise<CloudPatientRow[]> {
  const rows = await Promise.all(cloudIds.map((cloudId) => getPatient(env, cloudId)));
  return rows.filter((row): row is CloudPatientRow => row !== null);
}

export async function getClinicalRules(env: Env) {
  return selectRows<{ rule_key: string; rule_value: string; unit: string | null }>(
    env,
    "cloud_clinical_rules?select=rule_key,rule_value,unit&order=rule_key.asc",
  );
}

export async function getShare(env: Env, shareId: string): Promise<CloudShareRow | null> {
  const select = "share_id,patient_ids,birth_years,require_verification,expires_at";
  const rows = await selectRows<CloudShareRow>(env, `cloud_shares?select=${select}&share_id=eq.${encodeURIComponent(shareId)}&limit=1`);
  return rows[0] ?? null;
}

export async function logAccess(env: Env, cloudId: string, displayName: string, action: string) {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/cloud_access_logs`, {
      method: "POST",
      headers: { ...baseHeaders(env), Prefer: "return=minimal" },
      body: JSON.stringify({ cloud_id: cloudId, display_name: displayName, action }),
    });
  } catch {
    // Audit logging must not prevent the patient from using the portal.
  }
}

export async function callPortalAuth<T>(env: Env, body: unknown, clientIp: string): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL}/functions/v1/portal-auth`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "x-portal-bff-secret": env.PORTAL_BFF_SECRET,
      "x-client-ip": clientIp,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `portal_auth_${response.status}`);
  return payload;
}

export function publicPatient(row: CloudPatientRow) {
  return {
    display_name: row.display_name || "",
    trend_data: Array.isArray(row.trend_data) ? row.trend_data : [],
    historical_reports: Array.isArray(row.historical_reports) ? row.historical_reports : [],
    last_updated: row.last_updated,
  };
}
