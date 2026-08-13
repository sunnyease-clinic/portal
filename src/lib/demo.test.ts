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
});
