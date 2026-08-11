export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function apiError(status: number, message = "系統暫時無法處理，請稍後再試。"): Response {
  return json({ error: message }, status);
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("invalid_content_type");
  return (await request.json()) as T;
}

export function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing_${name}`);
  return value;
}
