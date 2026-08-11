import { describe, expect, it } from "vitest";
import { niceAxis } from "./TrendChart";

describe("niceAxis", () => {
  it("uses readable integer or half-unit ticks for small clinical values", () => {
    const axis = niceAxis(1.2, 1.67, 0.2);
    expect(axis.step).toBe(0.5);
    expect(axis.ticks.every((tick) => Number.isInteger(tick * 2))).toBe(true);
  });

  it("scales cleanly for large clinical values", () => {
    const axis = niceAxis(150, 756.6, 100);
    expect(axis.ticks.every((tick) => Number.isInteger(tick))).toBe(true);
    expect(axis.domain[0]).toBeGreaterThanOrEqual(0);
  });
});
