import type { DashboardResponse, ShareDashboardResponse } from "./types";

type ApiErrorBody = { error?: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error || "系統暫時無法處理，請稍後再試。");
  }

  return (await response.json()) as T;
}

export const api = {
  login(nationalId: string, password: string, turnstileToken?: string) {
    return request<{ ok: true }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ nationalId, password, turnstileToken }),
    });
  },
  logout() {
    return request<{ ok: true }>("/api/logout", { method: "POST", body: "{}" });
  },
  dashboard() {
    return request<DashboardResponse>("/api/dashboard");
  },
  changePassword(currentPassword: string, newPassword: string) {
    return request<{ ok: true }>("/api/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  verifyShare(shareId: string, birthYear: string, turnstileToken?: string) {
    return request<{ ok: boolean; verificationRequired?: boolean }>("/api/share/verify", {
      method: "POST",
      body: JSON.stringify({ shareId, birthYear, turnstileToken }),
    });
  },
  shareDashboard() {
    return request<ShareDashboardResponse>("/api/share/dashboard");
  },
};
