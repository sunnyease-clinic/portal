import { apiError, json } from "../_lib/http";
import { patientSession } from "../_lib/session";
import { getClinicalRules, getPatient, publicPatient } from "../_lib/supabase";
import type { Env } from "../_lib/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const session = await patientSession(context.request, context.env);
    if (!session) return apiError(401, "請重新登入。");
    const [patient, rules] = await Promise.all([
      getPatient(context.env, session.cloudId),
      getClinicalRules(context.env),
    ]);
    if (!patient) return apiError(404, "目前找不到可顯示的資料，請聯絡診所。");
    return json({ patient: publicPatient(patient), rules });
  } catch {
    return apiError(500);
  }
};
