const FREQ_CAP_PER_DAY = 5;
const BUCKET_DEDUP_HOURS = 12;
const QUIET_HOUR_START = 23;
const QUIET_HOUR_END = 7;
const STALE_HOURS = 4;

export function withinFrequencyCap(
  notificationsLast24h: number,
  cap = FREQ_CAP_PER_DAY,
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
