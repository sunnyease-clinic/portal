import { apiError, json } from "../../_lib/http";
import { shareSession } from "../../_lib/session";
import { getClinicalRules, getPatients, getShare, publicPatient } from "../../_lib/supabase";
import type { Env } from "../../_lib/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const session = await shareSession(context.request, context.env);
    if (!session) return apiError(401, "請重新驗證分享連結。");
    const share = await getShare(context.env, session.shareId);
    if (!share || new Date(share.expires_at).getTime() <= Date.now()) return apiError(410, "分享連結已過期或被撤銷。");
    const [patients, rules] = await Promise.all([
      getPatients(context.env, share.patient_ids),
      getClinicalRules(context.env),
    ]);
    if (!patients.length) return apiError(404, "分享資料尚未同步，請聯絡診所。");
    return json({ patients: patients.map(publicPatient), rules, expires_at: share.expires_at });
  } catch {
    return apiError(500);
  }
};
