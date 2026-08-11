import { describe, expect, it } from "vitest";
import { parseRule, pointsForMetric, statusFor, trendLabel } from "./clinical";

describe("clinical presentation helpers", () => {
  it("parses ranges and one-sided targets", () => {
    expect(parseRule("3.5-5.5")).toEqual([3.5, 5.5]);
    expect(parseRule(">=65")).toEqual([65, null]);
    expect(parseRule("<55")).toEqual([null, 55]);
  });

  it("groups duplicate dates and sorts them", () => {
    expect(pointsForMetric([
      { nhi_code: "K", test_result_numeric: 5, visit_date: "2026-02-02" },
      { nhi_code: "K", test_result_numeric: 3, visit_date: "2026-02-02" },
      { nhi_code: "K", test_result_numeric: 4, visit_date: "2026-01-01" },
      { nhi_code: "OTHER", test_result_numeric: 99, visit_date: "2026-01-01" },
    ], "K")).toEqual([
      { date: "2026-01-01", value: 4 },
      { date: "2026-02-02", value: 4 },
    ]);
  });

  it("classifies target status and trend", () => {
    expect(statusFor(4, [3.5, 5.5])).toBe("達標");
    expect(statusFor(6, [3.5, 5.5])).toBe("偏高");
    expect(statusFor(3, [3.5, 5.5])).toBe("偏低");
    expect(trendLabel([{ date: "a", value: 3 }, { date: "b", value: 4 }])).toBe("↑ +1.0");
  });
});
