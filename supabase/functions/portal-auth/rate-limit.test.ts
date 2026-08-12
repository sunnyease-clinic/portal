import { describe, expect, it } from "vitest";
import { nextFailure } from "./rate-limit";

describe("rate limiting", () => {
  const now = new Date("2026-08-12T00:15:00.000Z");

  it("increments failures within the current window", () => {
    const result = nextFailure({ failed_count: 3, window_start: "2026-08-12T00:10:00.000Z" }, now, 5);
    expect(result.failedCount).toBe(4);
    expect(result.lockedUntil).toBeNull();
  });

  it("locks when the limit is reached", () => {
    const result = nextFailure({ failed_count: 19, window_start: "2026-08-12T00:10:00.000Z" }, now, 20);
    expect(result.failedCount).toBe(20);
    expect(result.lockedUntil).toBe("2026-08-12T00:30:00.000Z");
  });

  it("starts a new count after the window expires", () => {
    const result = nextFailure({ failed_count: 99, window_start: "2026-08-11T23:00:00.000Z" }, now, 20);
    expect(result.failedCount).toBe(1);
    expect(result.windowStart).toBe(now.toISOString());
  });
});
