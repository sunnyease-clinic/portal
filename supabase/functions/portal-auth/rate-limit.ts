export type AttemptState = {
  failed_count?: number | null;
  window_start?: string | null;
};

export function nextFailure(
  attempt: AttemptState | null,
  now: Date,
  limit: number,
  windowMs = 15 * 60 * 1000,
) {
  const previousStart = attempt?.window_start ? new Date(attempt.window_start) : now;
  const validStart = Number.isFinite(previousStart.getTime()) ? previousStart : now;
  const withinWindow = now.getTime() - validStart.getTime() < windowMs;
  const failedCount = withinWindow ? Number(attempt?.failed_count || 0) + 1 : 1;
  return {
    failedCount,
    windowStart: (withinWindow ? validStart : now).toISOString(),
    lockedUntil: failedCount >= limit ? new Date(now.getTime() + windowMs).toISOString() : null,
  };
}
