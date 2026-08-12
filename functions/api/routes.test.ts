import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost as login } from "./login";
import { onRequestPost as changePassword } from "./password";
import { onRequestPost as verifyShare } from "./share/verify";
import { signSession } from "../_lib/session";
import type { Env } from "../_lib/types";

const env: Env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_example-only",
  SUPABASE_ANON_KEY: "sb_publishable_example-only",
  PORTAL_SESSION_SECRET: "session-secret-at-least-32-characters-long",
  PORTAL_BFF_SECRET: "bff-secret-at-least-32-characters-long",
  TURNSTILE_SECRET_KEY: "turnstile-test-secret",
  PORTAL_SESSION_TTL_SECONDS: "3600",
};

function contextFor<T extends PagesFunction<Env>>(handler: T, body: unknown, url = "https://portal.example/api") {
  const pending: Promise<unknown>[] = [];
  const context = {
    request: new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10" },
      body: JSON.stringify(body),
    }),
    env,
    params: {},
    data: {},
    functionPath: "",
    next: () => Promise.resolve(new Response()),
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => undefined,
  } as unknown as Parameters<T>[0];
  return { context, pending, handler };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("patient-facing API routes", () => {
  it("logs in through the BFF without sending a publishable key as a bearer JWT", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("challenges.cloudflare.com/turnstile")) return Response.json({ success: true });
      if (url.endsWith("/functions/v1/portal-auth")) {
        expect(new Headers(init?.headers).get("apikey")).toBe(env.SUPABASE_ANON_KEY);
        expect(new Headers(init?.headers).has("Authorization")).toBe(false);
        return Response.json({ cloudId: "a".repeat(64), displayName: "測試病人" });
      }
      if (url.endsWith("/rest/v1/cloud_access_logs")) return new Response(null, { status: 201 });
      throw new Error(`unexpected_fetch:${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { context, pending } = contextFor(login, { nationalId: "A123456789", password: "1234", turnstileToken: "test-token" });
    const response = await login(context);
    await Promise.all(pending);

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("portal_session=");
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Set-Cookie")).toContain("SameSite=Strict");
  });

  it("maps the public demo alias without relaxing patient identifier validation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("challenges.cloudflare.com/turnstile")) return Response.json({ success: true });
      if (url.endsWith("/functions/v1/portal-auth")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({ nationalId: "DEMO000001", password: "demo" });
        return Response.json({ cloudId: "d".repeat(64), displayName: "示範病友" });
      }
      if (url.endsWith("/rest/v1/cloud_access_logs")) return new Response(null, { status: 201 });
      throw new Error(`unexpected_fetch:${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { context, pending } = contextFor(login, { nationalId: "demo", password: "demo", turnstileToken: "test-token" });
    const response = await login(context);
    await Promise.all(pending);

    expect(response.status).toBe(200);
  });

  it("rejects password changes for the demo account before calling portal-auth", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rest/v1/cloud_patients?")) {
        return Response.json([{
          cloud_id: "d".repeat(64), display_name: "示範病友", is_demo: true,
          trend_data: [], historical_reports: [], last_updated: null,
        }]);
      }
      throw new Error(`unexpected_fetch:${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const token = await signSession({ scope: "patient", cloudId: "d".repeat(64) }, env.PORTAL_SESSION_SECRET, 3600);
    const { context } = contextFor(changePassword, { currentPassword: "demo", newPassword: "changed" });
    Object.assign(context, {
      request: new Request(context.request, { headers: { ...Object.fromEntries(context.request.headers), Cookie: `portal_session=${token}` } }),
    });
    const response = await changePassword(context);
    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("opens an unverified share directly and caps the cookie at the share expiry", async () => {
    const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rest/v1/cloud_shares?")) {
        return Response.json([{
          share_id: "12345678-1234-1234-1234-123456789abc",
          patient_ids: ["a".repeat(64)],
          birth_years: [1954],
          require_verification: false,
          expires_at: expiry,
        }]);
      }
      if (url.endsWith("/rest/v1/cloud_access_logs")) return new Response(null, { status: 201 });
      throw new Error(`unexpected_fetch:${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { context, pending } = contextFor(verifyShare, {
      shareId: "12345678-1234-1234-1234-123456789abc",
      birthYear: "",
    });
    const response = await verifyShare(context);
    await Promise.all(pending);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("Set-Cookie")).toContain("portal_share=");
    const maxAge = Number(response.headers.get("Set-Cookie")?.match(/Max-Age=(\d+)/)?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(1800);
  });

  it("asks for a birth year without issuing a share cookie when verification is required", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{
      share_id: "12345678-1234-1234-1234-123456789abc",
      patient_ids: ["a".repeat(64)],
      birth_years: [1954],
      require_verification: true,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }])));

    const { context } = contextFor(verifyShare, {
      shareId: "12345678-1234-1234-1234-123456789abc",
      birthYear: "",
    });
    const response = await verifyShare(context);

    expect(await response.json()).toEqual({ ok: false, verificationRequired: true });
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });

  it("rejects expired shares", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{
      share_id: "12345678-1234-1234-1234-123456789abc",
      patient_ids: ["a".repeat(64)],
      birth_years: [1954],
      require_verification: false,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    }])));

    const { context } = contextFor(verifyShare, {
      shareId: "12345678-1234-1234-1234-123456789abc",
      birthYear: "",
    });
    const response = await verifyShare(context);
    expect(response.status).toBe(404);
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });
});
