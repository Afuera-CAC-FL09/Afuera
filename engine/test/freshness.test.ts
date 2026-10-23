import { describe, expect, it } from "vitest";
import demo from "../../data/demo/kissimmee-2026-07-15.json";
import { demoClock, forecastAgeMinutes, isStale } from "../src/freshness";

const fetchedAt = new Date("2026-07-15T17:00:00Z");
const minutes = (m: number) => new Date(fetchedAt.getTime() + m * 60_000);

describe("old-forecast warning", () => {
  it("shows after 2 hours on a live forecast", () => {
    expect(isStale(fetchedAt, minutes(120))).toBe(false);
    expect(isStale(fetchedAt, minutes(121))).toBe(true);
  });

  it("never goes negative", () => {
    expect(forecastAgeMinutes(fetchedAt, minutes(-30))).toBe(0);
  });

  it("never shows in demo mode, through 6 hours of a demo", () => {
    // The app saves the demo forecast as downloaded at demoNow, then runs the demo clock from there.
    const demoStart = new Date(demo.demoNow);
    const turnedOnAt = Date.parse("2026-10-23T14:00:00Z");
    for (let m = 0; m <= 6 * 60; m += 5) {
      const now = demoClock(demoStart, turnedOnAt + m * 60_000, turnedOnAt);
      expect(isStale(demoStart, now, { demo: true })).toBe(false);
    }
  });

  it("demo clock starts at the saved time and loops every 4 hours", () => {
    const demoStart = new Date(demo.demoNow);
    const on = 1_000_000;
    expect(demoClock(demoStart, on, on)).toEqual(demoStart);
    expect(demoClock(demoStart, on + 90 * 60_000, on).getTime() - demoStart.getTime()).toBe(90 * 60_000);
    expect(demoClock(demoStart, on + 4 * 3_600_000, on)).toEqual(demoStart);
  });
});
