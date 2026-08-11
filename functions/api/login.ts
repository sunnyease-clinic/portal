import { apiError, json, readJson, requireEnv } from "../_lib/http";
import { sessionCookie, sessionTtl, signSession } from "../_lib/session";
import { callPortalAuth, logAccess } from "../_lib/supabase";
import { verifyTurnstile } from "../_lib/turnstile";
import type { Env } from "../_lib/types";

type LoginBody = { nationalId?: string; password?: string; turnstileToken?: string };
type LoginResult = { cloudId: string; displayName: string };

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    requireEnv(context.env.PORTAL_SESSION_SECRET, "portal_session_secret");
    const body = await readJson<LoginBody>(context.request);
    const nationalId = String(body.nationalId || "").toUpperCase().trim();
    const password = String(body.password || "");
    if (!/^[A-Z][A-Z0-9]{9}$/.test(nationalId) || password.length < 4 || password.length > 128) {
      return apiError(400, "請確認身分證字號與密碼是否完整。");
    }

    const clientIp = context.request.headers.get("CF-Connecting-IP") || "";
    if (!(await verifyTurnstile(context.env, body.turnstileToken, clientIp))) {
      return apiError(400, "安全驗證未完成，請重新操作。");
    }

    let auth: LoginResult;
    try {
      auth = await callPortalAuth<LoginResult>(context.env, { action: "login", nationalId, password }, clientIp);
    } catch {
      return apiError(401, "登入資料不正確，請重新輸入或聯絡診所官方 LINE。");
    }

    const ttl = sessionTtl(context.env);
    const token = await signSession({ scope: "patient", cloudId: auth.cloudId }, context.env.PORTAL_SESSION_SECRET, ttl);
    context.waitUntil(logAccess(context.env, auth.cloudId, auth.displayName || "", "登入成功"));
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("portal_session", token, ttl) });
  } catch {
    return apiError(500);
  }
};
