import { apiError, json, readJson } from "../../_lib/http";
import { sessionCookie, sessionTtl, signSession } from "../../_lib/session";
import { getShare, logAccess } from "../../_lib/supabase";
import { verifyTurnstile } from "../../_lib/turnstile";
import type { Env } from "../../_lib/types";

type VerifyBody = { shareId?: string; birthYear?: string; turnstileToken?: string };

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await readJson<VerifyBody>(context.request);
    const shareId = String(body.shareId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(shareId)) return apiError(404, "分享連結無效或已過期。");
    const share = await getShare(context.env, shareId);
    if (!share || new Date(share.expires_at).getTime() <= Date.now()) return apiError(404, "分享連結無效或已過期。");

    const birthYearText = String(body.birthYear || "").trim();
    if (share.require_verification !== false && !birthYearText) {
      return json({ ok: false, verificationRequired: true });
    }

    const clientIp = context.request.headers.get("CF-Connecting-IP") || "";
    if (share.require_verification !== false && !(await verifyTurnstile(context.env, body.turnstileToken, clientIp))) {
      return apiError(400, "安全驗證尚未完成，請再試一次。");
    }

    let birthYear = Number(birthYearText);
    if (birthYear > 0 && birthYear < 200) birthYear += 1911;
    if (share.require_verification !== false && (!Number.isInteger(birthYear) || !share.birth_years.includes(birthYear))) {
      return apiError(401, "驗證資料不正確，請重新輸入。");
    }

    const ttl = sessionTtl(context.env);
    const shareExpiry = Math.floor(new Date(share.expires_at).getTime() / 1000);
    const token = await signSession({ scope: "share", shareId }, context.env.PORTAL_SESSION_SECRET, ttl, shareExpiry);
    context.waitUntil(logAccess(context.env, shareId, "交班連結", "驗證成功"));
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("portal_share", token, Math.min(ttl, shareExpiry - Math.floor(Date.now() / 1000))) });
  } catch {
    return apiError(500);
  }
};
