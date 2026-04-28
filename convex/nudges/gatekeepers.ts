const FREQ_CAP_PER_DAY_LIFETIME = 5;
const FREQ_CAP_PER_DAY_FREE = 1;
const BUCKET_DEDUP_HOURS = 12;
const QUIET_HOUR_START = 0;
const QUIET_HOUR_END = 7;
const STALE_HOURS = 4;

/**
 * Free users get one nudge per 24h — premium signal stays scarce. Lifetime
 * (paid) users get the full 5/day allowance. Unknown plan is treated as free.
 */
export function frequencyCapForPlan(plan: string | undefined): number {
  return plan === "lifetime" ? FREQ_CAP_PER_DAY_LIFETIME : FREQ_CAP_PER_DAY_FREE;
}

export function withinFrequencyCap(
  notificationsLast24h: number,
  cap = FREQ_CAP_PER_DAY_LIFETIME,
): boolean {
  return notificationsLast24h < cap;
}

export function passesBucketDedup(
  lastBucketTimestamp: number | undefined,
  now: number,
): boolean {
  if (lastBucketTimestamp === undefined) return true;
  const diffHours = (now - lastBucketTimestamp) / (3600 * 1000);
  return diffHours >= BUCKET_DEDUP_HOURS;
}

export function isInQuietHours(hourIST: number): boolean {
  if (QUIET_HOUR_START < QUIET_HOUR_END) {
    return hourIST >= QUIET_HOUR_START && hourIST < QUIET_HOUR_END;
  }
  return hourIST >= QUIET_HOUR_START || hourIST < QUIET_HOUR_END;
}

export function isStale(eventCreatedAt: number, now: number): boolean {
  const diffHours = (now - eventCreatedAt) / (3600 * 1000);
  return diffHours > STALE_HOURS;
}

export function getISTHour(now = new Date()): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).format(now);
  return parseInt(hourStr, 10) % 24;
}
