import { describe, it, expect } from "vitest";
import {
  withinFrequencyCap,
  passesBucketDedup,
  isInQuietHours,
  isStale,
  frequencyCapForPlan,
} from "./gatekeepers";

describe("withinFrequencyCap", () => {
  it("allows 5th nudge of the day", () => {
    expect(withinFrequencyCap(4, 5)).toBe(true);
  });
  it("blocks 6th nudge of the day", () => {
    expect(withinFrequencyCap(5, 5)).toBe(false);
  });
  it("allows when count is 0", () => {
    expect(withinFrequencyCap(0, 5)).toBe(true);
  });
});

describe("frequencyCapForPlan", () => {
  it("free plan → 1 nudge/day", () => {
    expect(frequencyCapForPlan("free")).toBe(1);
  });
  it("lifetime plan → 5 nudges/day", () => {
    expect(frequencyCapForPlan("lifetime")).toBe(5);
  });
  it("undefined plan defaults to free (1/day)", () => {
    expect(frequencyCapForPlan(undefined)).toBe(1);
  });
});

describe("passesBucketDedup", () => {
  const now = Date.now();
  it("blocks when same bucket fired 6h ago", () => {
    expect(passesBucketDedup(now - 6 * 3600 * 1000, now)).toBe(false);
  });
  it("allows when same bucket fired 13h ago", () => {
    expect(passesBucketDedup(now - 13 * 3600 * 1000, now)).toBe(true);
  });
  it("allows when bucket has never fired", () => {
    expect(passesBucketDedup(undefined, now)).toBe(true);
  });
  it("blocks at exactly 12h boundary", () => {
    expect(passesBucketDedup(now - 11.99 * 3600 * 1000, now)).toBe(false);
  });
});

describe("isInQuietHours (IST)", () => {
  it("returns true at 00:00 IST", () => {
    expect(isInQuietHours(0)).toBe(true);
  });
  it("returns true at 06:00 IST", () => {
    expect(isInQuietHours(6)).toBe(true);
  });
  it("returns false at 07:00 IST", () => {
    expect(isInQuietHours(7)).toBe(false);
  });
  it("returns false at 23:00 IST", () => {
    expect(isInQuietHours(23)).toBe(false);
  });
});

describe("isStale", () => {
  const now = Date.now();
  it("returns true for events older than 4h", () => {
    expect(isStale(now - 5 * 3600 * 1000, now)).toBe(true);
  });
  it("returns false for events 3h old", () => {
    expect(isStale(now - 3 * 3600 * 1000, now)).toBe(false);
  });
});
