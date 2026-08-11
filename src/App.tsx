import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "./lib/api";
import {
  getTarget,
  METRIC_GROUPS,
  pointsForMetric,
  statusFor,
  trendLabel,
  type Metric,
} from "./lib/clinical";
import type {
  ClinicalRule,
  DashboardResponse,
  PatientDashboard,
  ShareDashboardResponse,
} from "./lib/types";

type Mode = "loading" | "login" | "share-verify" | "dashboard" | "share-dashboard";

const officialLineUrl = (import.meta.env.VITE_OFFICIAL_LINE_URL as string | undefined) || "https://sunnyease.tw/line";
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const TrendChart = lazy(() => import("./components/TrendChart"));
const ReportMarkdown = lazy(() => import("./components/ReportMarkdown"));

function App() {
  const shareId = new URLSearchParams(window.location.search).get("share");
  const [mode, setMode] = useState<Mode>(shareId ? "share-verify" : "loading");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [shareDashboard, setShareDashboard] = useState<ShareDashboardResponse | null>(null);
  const [selectedPatient, setSelectedPatient] = useState(0);
  const [dark, setDark] = useState(() => localStorage.getItem("portal-theme") !== "light");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("portal-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    if (shareId) return;
    api.dashboard()
      .then((payload) => {
        setDashboard(payload);
        setMode("dashboard");
      })
      .catch(() => setMode("login"));
  }, [shareId]);

  async function handleLogout() {
    await api.logout().catch(() => undefined);
    setDashboard(null);
    setShareDashboard(null);
    setMode(shareId ? "share-verify" : "login");
  }

  if (mode === "loading") return <LoadingScreen />;

  if (mode === "login") {
    return (
      <PublicShell dark={dark} onTheme={() => setDark((value) => !value)}>
        <LoginCard
          onSuccess={async () => {
            const payload = await api.dashboard();
            setDashboard(payload);
            setMode("dashboard");
          }}
        />
      </PublicShell>
    );
  }

  if (mode === "share-verify" && shareId) {
    return (
      <PublicShell dark={dark} onTheme={() => setDark((value) => !value)}>
        <ShareVerifyCard
          shareId={shareId}
          onSuccess={async () => {
            const payload = await api.shareDashboard();
            setShareDashboard(payload);
            setMode("share-dashboard");
          }}
        />
      </PublicShell>
    );
  }

  if (mode === "share-dashboard" && shareDashboard) {
    const patient = shareDashboard.patients[selectedPatient];
    return (
      <DashboardShell dark={dark} onTheme={() => setDark((value) => !value)} onLogout={handleLogout} shareMode>
        <div className="share-toolbar">
          <label htmlFor="patient-select">交班病患</label>
          <select
            id="patient-select"
            value={selectedPatient}
            onChange={(event) => setSelectedPatient(Number(event.target.value))}
          >
            {shareDashboard.patients.map((item, index) => (
              <option value={index} key={`${item.display_name}-${index}`}>{item.display_name || `病患 ${index + 1}`}</option>
            ))}
          </select>
          <span className="expiry-pill">有效至 {formatDateTime(shareDashboard.expires_at)}</span>
        </div>
        <PatientView patient={patient} rules={shareDashboard.rules} shareMode />
      </DashboardShell>
    );
  }

  if (dashboard) {
    return (
      <DashboardShell dark={dark} onTheme={() => setDark((value) => !value)} onLogout={handleLogout}>
        <PatientView patient={dashboard.patient} rules={dashboard.rules} />
      </DashboardShell>
    );
  }

  return <LoadingScreen />;
}

function PublicShell({ children, dark, onTheme }: { children: ReactNode; dark: boolean; onTheme: () => void }) {
  return (
    <main className="public-page">
      <button className="theme-button floating" onClick={onTheme} aria-label={dark ? "切換亮色模式" : "切換深色模式"}>
        {dark ? "☀" : "☾"}
      </button>
      <div className="public-brand">
        <div className="brand-mark">向</div>
        <div>
          <p>向怡診所</p>
          <span>個人健康趨勢儀表板</span>
        </div>
      </div>
      {children}
      <p className="public-footer">您的資料經加密連線傳輸，請勿在公用裝置儲存密碼。</p>
    </main>
  );
}

function LoginCard({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.login(nationalId, password, turnstileToken || undefined);
      await onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登入失敗，請稍後再試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-icon">安心查看</div>
      <h1 id="login-title">登入您的健康報告</h1>
      <p className="auth-intro">預設密碼為手機末四碼；若已設定個人密碼，請使用個人密碼登入。</p>
      <form onSubmit={submit}>
        <label>
          身分證字號
          <input
            value={nationalId}
            onChange={(event) => setNationalId(event.target.value.toUpperCase())}
            autoComplete="username"
            inputMode="text"
            maxLength={10}
            placeholder="例如 A123456789"
            required
          />
        </label>
        <label>
          密碼
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="預設為手機末四碼"
            required
          />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />}
        <button className="primary-button" disabled={busy}>{busy ? "安全驗證中…" : "登入並查看報告"}</button>
      </form>
      <div className="auth-help">
        <span>忘記密碼？</span>
        {officialLineUrl ? (
          <a href={officialLineUrl} target="_blank" rel="noreferrer">聯絡診所官方 LINE</a>
        ) : (
          <strong>請聯絡診所官方 LINE</strong>
        )}
      </div>
    </section>
  );
}

function ShareVerifyCard({ shareId, onSuccess }: { shareId: string; onSuccess: () => Promise<void> }) {
  const [birthYear, setBirthYear] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    let cancelled = false;
    api.verifyShare(shareId, "")
      .then(async (result) => {
        if (cancelled) return;
        if (result.ok) await onSuccessRef.current();
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "連結無效或已過期。");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, [shareId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.verifyShare(shareId, birthYear, turnstileToken || undefined);
      await onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "驗證失敗，請稍後再試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="share-title">
      <div className="auth-icon">交班檢視</div>
      <h1 id="share-title">安全驗證</h1>
      <p className="auth-intro">請輸入交班名單中任一病患的出生年份。民國或西元皆可。</p>
      <form onSubmit={submit}>
        <label>
          出生年份
          <input
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="例如 54 或 1965"
            required
          />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />}
        <button className="primary-button" disabled={busy}>{busy ? "驗證中…" : "驗證並開啟"}</button>
      </form>
    </section>
  );
}

function DashboardShell({ children, dark, onTheme, onLogout, shareMode = false }: {
  children: ReactNode;
  dark: boolean;
  onTheme: () => void;
  onLogout: () => void;
  shareMode?: boolean;
}) {
  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark small">向</div>
          <div><strong>向怡診所</strong><span>個人健康趨勢儀表板</span></div>
        </div>
        <div className="topbar-actions">
          <button className="theme-button" onClick={onTheme} aria-label={dark ? "切換亮色模式" : "切換深色模式"}>{dark ? "☀" : "☾"}</button>
          <button className="secondary-button" onClick={onLogout}>{shareMode ? "結束檢視" : "登出"}</button>
        </div>
      </header>
      <div className="dashboard-content">{children}</div>
    </main>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container) return;
    let widgetId = "";
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || widgetId) return;
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        theme: "auto",
        language: "zh-tw",
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-portal-turnstile="true"]');
    if (existing) {
      if (window.turnstile) render(); else existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.portalTurnstile = "true";
      script.addEventListener("load", render, { once: true });
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [container, onToken, siteKey]);

  return <div className="turnstile-wrap" ref={setContainer} aria-label="安全驗證" />;
}

function PatientView({ patient, rules, shareMode = false }: { patient: PatientDashboard; rules: ClinicalRule[]; shareMode?: boolean }) {
  return (
    <>
      <section className="welcome-block">
        <div>
          <span className="eyebrow">{shareMode ? "交班安全檢視" : "個人報告"}</span>
          <h1>{patient.display_name ? `${patient.display_name}您好` : "您好"}</h1>
          <p>一起看看最近的檢驗趨勢。數值若有疑問，請依醫師說明為準。</p>
        </div>
        {patient.last_updated && <span className="update-pill">資料更新 {formatDateTime(patient.last_updated)}</span>}
      </section>

      {METRIC_GROUPS.map((group, index) => (
        <section className="health-section" key={group.id}>
          <div className="section-heading">
            <span className="section-number">{String(index + 1).padStart(2, "0")}</span>
            <h2>{group.title}</h2>
          </div>
          <div className="metric-grid">
            {group.metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} patient={patient} rules={rules} />
            ))}
          </div>
        </section>
      ))}

      <ReportSection reports={patient.historical_reports} />
      {!shareMode && <PasswordPanel />}
      <footer className="dashboard-footer">此儀表板供個人照護參考，治療與飲食調整請依醫師指示。</footer>
    </>
  );
}

function MetricCard({ metric, patient, rules }: { metric: Metric; patient: PatientDashboard; rules: ClinicalRule[] }) {
  const points = useMemo(() => pointsForMetric(patient.trend_data, metric.key), [patient.trend_data, metric.key]);
  const target = getTarget(metric, rules);
  if (!points.length) return null;
  const latest = points.at(-1)!.value;
  const status = statusFor(latest, target);
  const values = points.map((point) => point.value);
  const finiteTarget = target.filter((value): value is number => value !== null);
  const min = Math.min(...values, ...finiteTarget);
  const max = Math.max(...values, ...finiteTarget);
  const padding = Math.max((max - min) * 0.3, 1);

  return (
    <article className="metric-card">
      <div className="metric-topline">
        <div><h3>{metric.label}</h3><span>{metric.unit}</span></div>
        <span className={`status status-${status}`}>{status}</span>
      </div>
      <div className="latest-row">
        <strong>{latest.toFixed(1)}</strong>
        <span>{trendLabel(points)}</span>
      </div>
      <div className="chart-wrap" aria-label={`${metric.label}趨勢圖`}>
        <Suspense fallback={<div className="chart-loading">趨勢圖載入中…</div>}>
          <TrendChart points={points} target={target} metric={metric} min={min} max={max} padding={padding} />
        </Suspense>
      </div>
      <p className="target-label">目標 {formatTarget(target)} {metric.unit}</p>
    </article>
  );
}

function ReportSection({ reports }: { reports: PatientDashboard["historical_reports"] }) {
  if (!reports?.length) return null;
  return (
    <section className="health-section reports-section">
      <div className="section-heading"><span className="section-number">報</span><h2>歷史衛教報告</h2></div>
      <p className="section-description">展開月份即可查看過往的追蹤說明。</p>
      <div className="report-list">
        {reports.map((report) => (
          <details key={report.report_month}>
            <summary>{report.report_month}</summary>
            <div className="markdown-body">
              <Suspense fallback={<p>報告載入中…</p>}>
                <ReportMarkdown content={report.final_output || "本月無報告內容"} />
              </Suspense>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function PasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 6) return setMessage("新密碼至少需要 6 碼。");
    if (newPassword !== confirmPassword) return setMessage("兩次輸入的新密碼不一致。");
    setBusy(true);
    setMessage("");
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("密碼已更新。下次請使用新密碼登入。");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "密碼更新失敗。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="password-panel">
      <summary>帳號與密碼設定 <span>選用</span></summary>
      <div className="password-content">
        <div>
          <h3>設定個人密碼</h3>
          <p>若不想更改，您可以繼續使用手機末四碼。設定個人密碼後，下次請改用新密碼登入。</p>
        </div>
        <form onSubmit={submit}>
          <label>目前密碼<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <label>新密碼<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} required /></label>
          <label>再次輸入新密碼<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required /></label>
          {message && <div className="form-message" role="status">{message}</div>}
          <button className="primary-button compact" disabled={busy}>{busy ? "更新中…" : "更新密碼"}</button>
        </form>
      </div>
    </details>
  );
}

function LoadingScreen() {
  return <main className="loading-screen"><div className="brand-mark">向</div><span>正在安全載入…</span></main>;
}

function formatTarget([low, high]: [number | null, number | null]) {
  if (low !== null && high !== null) return `${low}–${high}`;
  if (low !== null) return `≥ ${low}`;
  if (high !== null) return `≤ ${high}`;
  return "依醫囑";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei" }).format(date);
}

export default App;
