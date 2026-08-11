import { clearCookie } from "../_lib/session";
import type { Env } from "../_lib/types";

export const onRequestPost: PagesFunction<Env> = async () => {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", clearCookie("portal_session"));
  headers.append("Set-Cookie", clearCookie("portal_share"));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
