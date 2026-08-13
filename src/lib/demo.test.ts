import { describe, expect, it } from "vitest";
import { getTarget, METRIC_GROUPS, pointsForMetric, statusFor } from "./clinical";
import { DEMO_PATIENT, DEMO_RULES } from "./demo";

describe("public demo clinical story", () => {
  it("shows only ALP as high and PTH as low at the latest visit", () => {
    const results = METRIC_GROUPS.flatMap((group) => group.metrics).map((metric) => {
      const latest = pointsForMetric(DEMO_PATIENT.trend_data, metric.key).at(-1)!.value;
      return [metric.key, statusFor(latest, getTarget(metric, DEMO_RULES))] as const;
    });

    expect(results.filter(([, status]) => status !== "達標")).toEqual([
      ["09122C", "偏低"],
      ["09027C", "偏高"],
    ]);
  });

  it("covers six months, with two Hb readings per month", () => {
    const metrics = METRIC_GROUPS.flatMap((group) => group.metrics);
    for (const metric of metrics.filter((item) => item.key !== "08003C")) {
      expect(pointsForMetric(DEMO_PATIENT.trend_data, metric.key)).toHaveLength(6);
    }

    const hbPoints = pointsForMetric(DEMO_PATIENT.trend_data, "08003C");
    expect(hbPoints).toHaveLength(12);
    expect(new Set(hbPoints.map((point) => point.date.slice(0, 7))).size).toBe(6);
  });
});
