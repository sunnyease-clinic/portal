import { useMemo } from "react";
import {
  cleanSourceOrg,
  filterPointsByMonths,
  formatDoctorLabel,
  formatShortDate,
  getTarget,
  METRIC_GROUPS,
  pointsForMetric,
  statusFor,
  trendLabel,
  type ChartPoint,
  type Metric,
} from "../lib/clinical";
import type { ClinicalRule, PatientDashboard } from "../lib/types";
import ReportMarkdown from "./ReportMarkdown";

function formatTargetRange(metric: Metric, [low, high]: [number | null, number | null]): string {
  if (metric.targetHint) return metric.targetHint;
  const suffix = metric.unit ? ` ${metric.unit}` : "";
  if (low !== null && high !== null) return `${low}–${high}${suffix}`;
  if (low !== null) return `≥ ${low}${suffix}`;
  if (high !== null) return `≤ ${high}${suffix}`;
  return "依醫囑";
}

function PrintSparkline({
  points,
  target,
  status,
}: {
  points: ChartPoint[];
  target: [number | null, number | null];
  status: "達標" | "偏高" | "偏低";
}) {
  const width = 136;
  const height = 26;
  const padX = 5;
  const padY = 4;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const values = points.map((p) => p.value);
  const finiteTargets = target.filter((v): v is number => v !== null);
  let min = Math.min(...values, ...finiteTargets);
  let max = Math.max(...values, ...finiteTargets);
  if (min === max) {
    min -= 1;
    max += 1;
  } else {
    const span = max - min;
    min -= span * 0.12;
    max += span * 0.12;
  }

  const xOf = (idx: number) =>
    points.length === 1 ? width / 2 : padX + (idx / (points.length - 1)) * plotW;
  const yOf = (val: number) => padY + ((max - val) / (max - min)) * plotH;

  const [low, high] = target;
  const bandTop = high !== null ? Math.max(padY, Math.min(padY + plotH, yOf(high))) : padY;
  const bandBottom = low !== null ? Math.max(padY, Math.min(padY + plotH, yOf(low))) : padY + plotH;

  const linePoints = points.map((p, idx) => `${xOf(idx).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(" ");
  const accent = status === "偏高" ? "#dc2626" : status === "偏低" ? "#2563eb" : "#0f766e";
  const last = points[points.length - 1];

  return (
    <svg
      className="print-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      {bandBottom > bandTop && (
        <rect
          x={padX}
          y={bandTop}
          width={plotW}
          height={bandBottom - bandTop}
          fill="#10b981"
          fillOpacity={0.16}
          rx={2}
        />
      )}
      {high !== null && (
        <line
          x1={padX}
          y1={yOf(high)}
          x2={padX + plotW}
          y2={yOf(high)}
          stroke="#10b981"
          strokeWidth={0.75}
          strokeDasharray="2.5 2"
          strokeOpacity={0.85}
        />
      )}
      {low !== null && (
        <line
          x1={padX}
          y1={yOf(low)}
          x2={padX + plotW}
          y2={yOf(low)}
          stroke="#10b981"
          strokeWidth={0.75}
          strokeDasharray="2.5 2"
          strokeOpacity={0.85}
        />
      )}
      {points.length > 1 && (
        <polyline
          fill="none"
          stroke="#0f766e"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={linePoints}
        />
      )}
      {points.map((p, idx) => (
        <circle
          key={p.date}
          cx={xOf(idx)}
          cy={yOf(p.value)}
          r={idx === points.length - 1 ? 2.6 : 1.5}
          fill={idx === points.length - 1 ? accent : "#0f766e"}
          stroke="#ffffff"
          strokeWidth={idx === points.length - 1 ? 0.8 : 0.4}
        />
      ))}
      <title>{`${last.date}: ${last.value.toFixed(1)}`}</title>
    </svg>
  );
}

export default function PrintSummary({
  patient,
  rules,
  windowMonths,
  updatedLabel,
}: {
  patient: PatientDashboard;
  rules: ClinicalRule[];
  windowMonths: 3 | 6 | 12;
  updatedLabel: string;
}) {
  const latestReport = patient.historical_reports?.[0] ?? null;
  const appointments = patient.upcoming_appointments ?? [];
  const medications = patient.active_medications ?? [];

  const groupedRows = useMemo(() => {
    let withinCount = 0;
    let attentionCount = 0;
    const groups = METRIC_GROUPS.map((group) => {
      const rows = group.metrics
        .map((metric) => {
          const allPts = pointsForMetric(patient.trend_data, metric.key);
          const pts = filterPointsByMonths(allPts, windowMonths);
          if (!pts.length) return null;
          const target = getTarget(metric, rules);
          const latest = pts.at(-1)!;
          const status = statusFor(latest.value, target);
          if (status === "達標") withinCount += 1;
          else attentionCount += 1;
          return {
            metric,
            points: pts,
            target,
            latest,
            status,
            delta: trendLabel(pts),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      return { group, rows };
    }).filter((entry) => entry.rows.length > 0);
    return { groups, withinCount, attentionCount, total: withinCount + attentionCount };
  }, [patient.trend_data, rules, windowMonths]);

  return (
    <article className="print-only print-sheet" aria-label="個人健康摘要列印版">
      <header className="print-header">
        <div className="print-brand">
          <span className="print-logo-box">
            <img src="/sunnyease-logo.png" alt="向怡診所" className="print-logo" />
          </span>
          <div>
            <div className="print-clinic-name">向怡診所 · 血液透析中心</div>
            <h1>個人健康與就醫摘要</h1>
          </div>
        </div>
        <div className="print-meta">
          <div className="print-patient-name">{patient.display_name || "病友"}</div>
          <div className="print-meta-line">資料更新：{updatedLabel || "—"}</div>
          {groupedRows.total > 0 && (
            <div className="print-meta-badges">
              <span className="print-pill print-pill-good">達標 {groupedRows.withinCount}/{groupedRows.total}</span>
              {groupedRows.attentionCount > 0 && (
                <span className="print-pill print-pill-warn">需留意 {groupedRows.attentionCount} 項</span>
              )}
            </div>
          )}
        </div>
      </header>

      {groupedRows.groups.length > 0 && (
        <section className="print-block">
          <div className="print-section-title">
            <h2>關鍵檢驗追蹤總覽</h2>
            <span>區間：近 {windowMonths === 12 ? "1 年" : `${windowMonths} 個月`}（綠底為建議目標區間）</span>
          </div>
          <table className="print-lab-table">
            <thead>
              <tr>
                <th>檢驗項目</th>
                <th className="num">最新值</th>
                <th>較前次</th>
                <th>抽血日</th>
                <th>建議區間</th>
                <th>狀態</th>
                <th className="spark-col">趨勢圖</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.groups.map(({ group, rows }) => (
                <FragmentGroup key={group.id} title={group.title} rows={rows} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      {latestReport && (
        <section className="print-block print-report-block">
          <div className="print-section-title">
            <h2>最新醫師衛教說明（{latestReport.report_month}）</h2>
            <span>醫療團隊審定</span>
          </div>
          <div className="print-report-body">
            <ReportMarkdown content={latestReport.final_output || "本月無報告內容"} />
          </div>
        </section>
      )}

      {appointments.length > 0 && (
        <section className="print-block">
          <div className="print-section-title">
            <h2>近期外院門診預約（未來 90 天）</h2>
            <span>共 {appointments.length} 筆</span>
          </div>
          <table className="print-compact-table">
            <thead>
              <tr>
                <th style={{ width: "16%" }}>日期</th>
                <th style={{ width: "28%" }}>醫院</th>
                <th style={{ width: "32%" }}>科別 / 醫師</th>
                <th style={{ width: "24%" }}>時段 / 診間 / 號次</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt, idx) => (
                <tr key={`${appt.appt_date}-${appt.hospital_name}-${idx}`}>
                  <td className="mono strong">{appt.appt_date}</td>
                  <td className="strong">{appt.hospital_name}</td>
                  <td>
                    {[appt.dept_name, formatDoctorLabel(appt.doctor_name)].filter(Boolean).join(" · ") || "一般門診"}
                  </td>
                  <td>
                    {[appt.time_slot, appt.room, appt.appt_seq ? `${appt.appt_seq} 號` : ""]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {medications.length > 0 && (
        <section className="print-block">
          <div className="print-section-title">
            <h2>目前常規用藥參考清單</h2>
            <span>共 {medications.length} 項（僅供跨院就醫參考，實際服藥請依醫囑）</span>
          </div>
          <div className="print-med-grid">
            {medications.map((med, idx) => (
              <div className="print-med-item" key={`${med.drug_name}-${med.brand_name || ""}-${idx}`}>
                <div className="print-med-main">
                  <strong>{med.brand_name || med.drug_name}</strong>
                  {med.brand_name && med.drug_name && med.brand_name !== med.drug_name && (
                    <span className="print-med-generic">{med.drug_name}</span>
                  )}
                </div>
                <div className="print-med-side">
                  {med.frequency && <span className="print-freq">{med.frequency}</span>}
                  <span className="print-med-meta">
                    {[med.prescribed_date, cleanSourceOrg(med.source_org)].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="print-footer">
        <span>向怡診所 個人健康照護摘要 · 本文件供病友與跨院門診／急診參考，治療與用藥調整請依醫師指示為準。</span>
        <span>官方 LINE：sunnyease.tw/line</span>
      </footer>
    </article>
  );
}

function FragmentGroup({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    metric: Metric;
    points: ChartPoint[];
    target: [number | null, number | null];
    latest: ChartPoint;
    status: "達標" | "偏高" | "偏低";
    delta: string;
  }>;
}) {
  return (
    <>
      <tr className="print-group-row">
        <td colSpan={7}>{title}</td>
      </tr>
      {rows.map(({ metric, points, target, latest, status, delta }) => (
        <tr key={metric.key} className={`print-row-status-${status}`}>
          <td className="strong">{metric.label}</td>
          <td className={`num strong print-val-${status}`}>
            {latest.value.toFixed(1)}
            {metric.unit ? <span className="print-unit"> {metric.unit}</span> : null}
          </td>
          <td className="muted mono">{delta || "—"}</td>
          <td className="mono">{formatShortDate(latest.date)}</td>
          <td className="mono">{formatTargetRange(metric, target)}</td>
          <td>
            <span className={`print-status-tag tag-${status}`}>
              {status === "達標" ? "✓ 達標" : status === "偏高" ? "↑ 偏高" : "↓ 偏低"}
            </span>
          </td>
          <td className="spark-col">
            <PrintSparkline points={points} target={target} status={status} />
          </td>
        </tr>
      ))}
    </>
  );
}
