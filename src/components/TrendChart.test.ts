import { describe, expect, it } from "vitest";
import { niceAxis, targetAreaBounds } from "./TrendChart";

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

describe("targetAreaBounds", () => {
  it("fills an open upper target to the visible chart top", () => {
    expect(targetAreaBounds([1.2, null], [0, 2])).toEqual([1.2, 2]);
  });

  it("fills an open lower target to the visible chart bottom", () => {
    expect(targetAreaBounds([null, 55], [0, 60])).toEqual([0, 55]);
  });
});
