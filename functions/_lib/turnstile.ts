import type { Env } from "./types";

export async function verifyTurnstile(env: Env, token: string | undefined, remoteIp: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return false;
  if (!token) return false;
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
