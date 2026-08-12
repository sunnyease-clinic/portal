import { apiError, json, readJson } from "../_lib/http";
import { patientSession } from "../_lib/session";
import { callPortalAuth, getPatient, logAccess } from "../_lib/supabase";
import type { Env } from "../_lib/types";

type PasswordBody = { currentPassword?: string; newPassword?: string };

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const session = await patientSession(context.request, context.env);
    if (!session) return apiError(401, "請重新登入。");
    const patient = await getPatient(context.env, session.cloudId);
    if (!patient) return apiError(401, "請重新登入。");
    if (patient.is_demo) return apiError(403, "示範帳號不可變更密碼。");
    const body = await readJson<PasswordBody>(context.request);
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (currentPassword.length < 4 || newPassword.length < 6 || newPassword.length > 128) {
      return apiError(400, "請確認目前密碼，且新密碼至少為 6 碼。");
    }
    const clientIp = context.request.headers.get("CF-Connecting-IP") || "";
    try {
      await callPortalAuth(context.env, { action: "change-password", cloudId: session.cloudId, currentPassword, newPassword }, clientIp);
    } catch {
      return apiError(400, "目前密碼不正確，請重新輸入。");
    }
    context.waitUntil(logAccess(context.env, session.cloudId, "", "修改密碼成功"));
    return json({ ok: true });
  } catch {
    return apiError(500);
  }
};
