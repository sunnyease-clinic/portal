import type { Env, PortalSession } from "./types";

type UnsignedSession =
  | { scope: "patient"; cloudId: string }
  | { scope: "share"; shareId: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(
  claims: UnsignedSession,
  secret: string,
  ttlSeconds: number,
  maxExpiresAt?: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: PortalSession = {
    ...claims,
    iat: now,
    exp: Math.min(now + ttlSeconds, maxExpiresAt ?? Number.MAX_SAFE_INTEGER),
    jti: crypto.randomUUID(),
  } as PortalSession;
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const input = `${header}.${body}`;
  const signature = await crypto.subtle.sign("HMAC", await importKey(secret), encoder.encode(input));
  return `${input}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySession(token: string, secret: string): Promise<PortalSession | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    if (!header || !body || !signature) return null;
    const metadata = JSON.parse(decoder.decode(base64UrlDecode(header))) as { alg?: string; typ?: string };
    if (metadata.alg !== "HS256" || metadata.typ !== "JWT") return null;
    const signatureBytes = base64UrlDecode(signature);
    const signatureBuffer = signatureBytes.buffer.slice(
      signatureBytes.byteOffset,
      signatureBytes.byteOffset + signatureBytes.byteLength,
    ) as ArrayBuffer;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await importKey(secret),
      signatureBuffer,
      encoder.encode(`${header}.${body}`),
    );
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(base64UrlDecode(body))) as PortalSession;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.scope === "patient" && /^[a-f0-9]{64}$/.test(payload.cloudId)) return payload;
    if (payload.scope === "share" && /^[0-9a-f-]{36}$/i.test(payload.shareId)) return payload;
    return null;
  } catch {
    return null;
  }
}

export function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
}

export function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function sessionTtl(env: Env): number {
  const parsed = Number(env.PORTAL_SESSION_TTL_SECONDS || "28800");
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 900), 43_200) : 28_800;
}

export async function patientSession(request: Request, env: Env) {
  const token = cookieValue(request, "portal_session");
  if (!token) return null;
  const session = await verifySession(token, env.PORTAL_SESSION_SECRET);
  return session?.scope === "patient" ? session : null;
}

export async function shareSession(request: Request, env: Env) {
  const token = cookieValue(request, "portal_share");
  if (!token) return null;
  const session = await verifySession(token, env.PORTAL_SESSION_SECRET);
  return session?.scope === "share" ? session : null;
}
