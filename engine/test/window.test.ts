import { describe, expect, it } from "vitest";
import type { HourRisk } from "../src/forecast";
import type { RiskLevel } from "../src/risk";
import { findBestWindows } from "../src/window";

const EDT = -4 * 3600;
// Local hour h on day d (July 15 + d), EDT.
const at = (d: number, h: number) => new Date(Date.UTC(2026, 6, 15 + d, h + 4));

const LEVEL_F: Record<RiskLevel, number> = { lower: 78, elevated: 84, high: 88, extreme: 91 };

/** 5 days of hours. `levelAt` gives the level for local day/hour. */
function hours(levelAt: (d: number, h: number) => RiskLevel, extra: Partial<HourRisk> = {}): HourRisk[] {
  const out: HourRisk[] = [];
  for (let d = 0; d < 6; d++)
    for (let h = 0; h < 24; h++) {
      const level = levelAt(d, h);
      out.push({ time: at(d, h), wbgtF: LEVEL_F[level] + h / 100, level, stopOutdoor: false, precipChance: 10, thunder: false, ...extra });
    }
  return out;
}

const summer = (d: number, h: number): RiskLevel =>
  h < 9 || h >= 19 ? "elevated" : h < 11 || h >= 17 ? "high" : "extreme";

describe("findBestWindows", () => {
  const base = { durationMinutes: 120, from: at(0, 6), utcOffsetSeconds: EDT };

  it("picks the coolest daylight window", () => {
    const { best } = findBestWindows(hours(summer), base);
    expect(best!.level).toBe("elevated");
    expect(best!.start).toEqual(at(0, 6)); // earliest of the elevated ones with the lowest peak
  });

  it("never starts before 6 AM or ends after 9 PM", () => {
    const { byDay } = findBestWindows(hours(() => "lower"), base);
    for (const w of byDay) {
      const startLocal = (w.start.getUTCHours() + 24 - 4) % 24;
      expect(startLocal).toBeGreaterThanOrEqual(6);
      expect(startLocal + 2).toBeLessThanOrEqual(21);
    }
  });

  it("skips windows with storms", () => {
    const h = hours(summer).map((x) => {
      const local = (x.time.getUTCHours() + 20) % 24;
      return local < 9 ? { ...x, thunder: true } : x;
    });
    const { best } = findBestWindows(h, base);
    const startLocal = (best!.start.getUTCHours() + 20) % 24;
    expect(startLocal).toBeGreaterThanOrEqual(9);
  });

  it("skips windows with a high rain chance", () => {
    const h = hours(() => "lower", { precipChance: 70 });
    expect(findBestWindows(h, base).best).toBeNull();
    expect(findBestWindows(h, { ...base, maxPrecipChance: 80 }).best).not.toBeNull();
  });

  it("skips hours where outdoor activity is off", () => {
    const h = hours(() => "extreme", { stopOutdoor: true });
    expect(findBestWindows(h, base).best).toBeNull();
  });

  it("judges a window by its worst hour", () => {
    // 6–7 is lower but 7–8 is extreme; a 2-hour window starting at 6 is extreme.
    const levels = (d: number, h: number): RiskLevel => (h === 6 ? "lower" : h === 7 ? "extreme" : "high");
    const { best } = findBestWindows(hours(levels), base);
    expect(best!.level).toBe("high");
  });

  it("gives one best window per day, in order", () => {
    const { byDay } = findBestWindows(hours(summer), base);
    expect(byDay.map((w) => w.localDate)).toEqual(["2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19"]);
  });

  it("doesn't look past the search horizon", () => {
    const { byDay } = findBestWindows(hours(summer), { ...base, days: 2 });
    expect(byDay).toHaveLength(2);
  });

  it("still offers the hour that's under way", () => {
    const { best } = findBestWindows(hours(summer), { ...base, from: new Date(at(0, 6).getTime() + 20 * 60_000) });
    expect(best!.start).toEqual(at(0, 6));
  });
});
