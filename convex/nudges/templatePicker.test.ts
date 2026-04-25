import { describe, it, expect } from "vitest";
import { pickTemplate } from "./templatePicker";
import { mockTemplate } from "../__fixtures__/nudges";

describe("pickTemplate", () => {
  it("returns null when no templates provided", () => {
    expect(pickTemplate([])).toBeNull();
  });

  it("returns the only template when there's one", () => {
    const t = mockTemplate();
    expect(pickTemplate([t])).toBe(t);
  });

  it("respects weighted selection — heavy weight wins majority of trials", () => {
    const heavy = mockTemplate({ variant: "heavy", weight: 9 });
    const light = mockTemplate({ variant: "light", weight: 1 });
    const trials = 1000;
    let heavyCount = 0;
    for (let i = 0; i < trials; i++) {
      const pick = pickTemplate([heavy, light]);
      if (pick?.variant === "heavy") heavyCount++;
    }
    expect(heavyCount).toBeGreaterThan(850);
    expect(heavyCount).toBeLessThan(950);
  });

  it("treats missing weight as 1.0", () => {
    const a = mockTemplate({ variant: "a", weight: undefined as never });
    const b = mockTemplate({ variant: "b", weight: 1 });
    const trials = 1000;
    let aCount = 0;
    for (let i = 0; i < trials; i++) {
      const pick = pickTemplate([a, b]);
      if (pick?.variant === "a") aCount++;
    }
    expect(aCount).toBeGreaterThan(400);
    expect(aCount).toBeLessThan(600);
  });
});
