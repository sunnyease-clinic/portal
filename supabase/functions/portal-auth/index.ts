import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashPassword, sha256Hex, verifyLegacyPassword, verifyPbkdf2, verifyTempPassword } from "./passwords.ts";

type PatientAuthRow = {
  cloud_id: string;
  display_name: string | null;
  password_hash: string | null;
  salt: string | null;
  temp_pw_hash: string | null;
};

type AuthRequest =
  | { action: "login"; nationalId: string; password: string }
  | { action: "change-password"; cloudId: string; currentPassword: string; newPassword: string };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

function fixedTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

async function validPassword(row: PatientAuthRow, password: string, clinicSecret: string) {
  if (row.password_hash?.startsWith("pbkdf2_sha256$")) {
    return { valid: await verifyPbkdf2(password, row.password_hash), legacyCustom: false };
  }
  if (row.password_hash && row.salt) {
    return { valid: await verifyLegacyPassword(password, row.password_hash, row.salt), legacyCustom: true };
  }
  if (row.temp_pw_hash) {
    return { valid: await verifyTempPassword(password, row.temp_pw_hash, clinicSecret), legacyCustom: false };
  }
  return { valid: false, legacyCustom: false };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "not_found" }, 404);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const clinicSecret = Deno.env.get("CLINIC_SECRET") || "";
  const bffSecret = Deno.env.get("PORTAL_BFF_SECRET") || "";
  const rateSecret = Deno.env.get("PORTAL_RATE_LIMIT_SECRET") || bffSecret;
  const suppliedSecret = request.headers.get("x-portal-bff-secret") || "";
  if (!bffSecret || !fixedTimeEqual(bffSecret, suppliedSecret)) return json({ error: "unauthorized" }, 401);
  if (!supabaseUrl || !serviceKey || !clinicSecret) return json({ error: "server_configuration" }, 500);

  let body: AuthRequest;
  try {
    body = await request.json() as AuthRequest;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const clientIp = request.headers.get("x-client-ip") || "unknown";

  if (body.action === "login") {
    const nationalId = String(body.nationalId || "").toUpperCase().trim();
    const password = String(body.password || "");
    if (!/^[A-Z][A-Z0-9]{9}$/.test(nationalId) || password.length < 4 || password.length > 128) return json({ error: "invalid_credentials" }, 401);
    const cloudId = await sha256Hex(`${nationalId}_${clinicSecret}`);
    const ipHash = await sha256Hex(`${clientIp}_${rateSecret}`);
    const now = new Date();
    const { data: attempt } = await supabase
      .from("portal_auth_attempts")
      .select("failed_count,window_start,locked_until")
      .eq("identifier_hash", cloudId)
      .eq("ip_hash", ipHash)
      .maybeSingle();
    if (attempt?.locked_until && new Date(attempt.locked_until) > now) return json({ error: "invalid_credentials" }, 429);

    const { data, error } = await supabase
      .from("cloud_patients")
      .select("cloud_id,display_name,password_hash,salt,temp_pw_hash")
      .eq("cloud_id", cloudId)
      .maybeSingle();
    const row = data as PatientAuthRow | null;
    const result = row ? await validPassword(row, password, clinicSecret) : { valid: false, legacyCustom: false };
    if (error || !row || !result.valid) {
      const windowStart = attempt?.window_start ? new Date(attempt.window_start) : now;
      const withinWindow = now.getTime() - windowStart.getTime() < 15 * 60 * 1000;
      const failedCount = withinWindow ? Number(attempt?.failed_count || 0) + 1 : 1;
      const lockedUntil = failedCount >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
      await supabase.from("portal_auth_attempts").upsert({
        identifier_hash: cloudId,
        ip_hash: ipHash,
        failed_count: failedCount,
        window_start: withinWindow ? windowStart.toISOString() : now.toISOString(),
        locked_until: lockedUntil,
        updated_at: now.toISOString(),
      });
      return json({ error: "invalid_credentials" }, 401);
    }

    await supabase.from("portal_auth_attempts").delete().eq("identifier_hash", cloudId).eq("ip_hash", ipHash);
    if (result.legacyCustom) {
      await supabase.from("cloud_patients").update({ password_hash: await hashPassword(password), salt: null }).eq("cloud_id", cloudId);
    }
    return json({ cloudId, displayName: row.display_name || "" });
  }

  if (body.action === "change-password") {
    const cloudId = String(body.cloudId || "");
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!/^[a-f0-9]{64}$/.test(cloudId) || currentPassword.length < 4 || newPassword.length < 6 || newPassword.length > 128) {
      return json({ error: "invalid_request" }, 400);
    }
    const { data } = await supabase
      .from("cloud_patients")
      .select("cloud_id,display_name,password_hash,salt,temp_pw_hash")
      .eq("cloud_id", cloudId)
      .maybeSingle();
    const row = data as PatientAuthRow | null;
    if (!row || !(await validPassword(row, currentPassword, clinicSecret)).valid) return json({ error: "invalid_credentials" }, 401);
    const { error } = await supabase
      .from("cloud_patients")
      .update({ password_hash: await hashPassword(newPassword), salt: null })
      .eq("cloud_id", cloudId);
    if (error) return json({ error: "update_failed" }, 500);
    return json({ ok: true });
  }

  return json({ error: "invalid_action" }, 400);
});
