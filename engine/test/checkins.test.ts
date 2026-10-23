import { describe, expect, it } from "vitest";
import { ACTIVITIES, getCheckins, mergeAiCheckins, planActivity } from "../src/checkins";
import { bandForWbgtF, RISK_LEVELS } from "../src/risk";
import templates from "../src/templates.json";
// @ts-expect-error plain JS build script
import { buildTemplates } from "../../tools/build-templates.mjs";

describe("templates", () => {
  it("templates.json is up to date with ai/templates/*.yaml (run `npm run templates`)", () => {
    expect(templates).toEqual(buildTemplates());
  });

  it.each(ACTIVITIES)("%s has a required water break at every level, as often as FHSAA asks", (activity) => {
    const fhsaaEvery = { lower: 30, elevated: 20, high: 15, extreme: 12 };
    for (const level of RISK_LEVELS) {
      const water = getCheckins(activity, level).find((c) => c.id === "water-break");
      expect(water?.required).toBe(true);
      expect(water!.everyMinutes).toBeLessThanOrEqual(fhsaaEvery[level]);
    }
  });

  it.each(ACTIVITIES)("%s has Spanish for every check-in", (activity) => {
    for (const level of RISK_LEVELS)
      for (const c of getCheckins(activity, level)) {
        expect(c.title.es.length).toBeGreaterThan(0);
        expect(c.detail.es.length).toBeGreaterThan(0);
      }
  });
});

describe("mergeAiCheckins", () => {
  const base = getCheckins("team", "high");
  const water = () => base.find((c) => c.id === "water-break")!;

  it("lets the AI make a check-in more frequent", () => {
    const merged = mergeAiCheckins(base, [{ id: "water-break", everyMinutes: 10 }]);
    expect(merged.find((c) => c.id === "water-break")!.everyMinutes).toBe(10);
  });

  it("never lets the AI space a check-in out", () => {
    const merged = mergeAiCheckins(base, [{ id: "water-break", everyMinutes: 60 }]);
    expect(merged.find((c) => c.id === "water-break")!.everyMinutes).toBe(water().everyMinutes);
  });

  it("never lets the AI drop or downgrade a required check-in", () => {
    const merged = mergeAiCheckins(base, [{ id: "water-break", everyMinutes: 15, required: false }]);
    expect(merged.find((c) => c.id === "water-break")!.required).toBe(true);
    expect(merged.map((c) => c.id)).toEqual(expect.arrayContaining(base.map((c) => c.id)));
  });

  it("lets the AI make an optional check-in required", () => {
    const merged = mergeAiCheckins(base, [{ id: "symptom-check", everyMinutes: 20, required: true }]);
    expect(merged.find((c) => c.id === "symptom-check")!.required).toBe(true);
  });

  it("adds new check-ins from the AI", () => {
    const merged = mergeAiCheckins(base, [{ id: "inhaler", everyMinutes: 30, title: "Check on Sam's inhaler" }]);
    expect(merged.find((c) => c.id === "inhaler")).toMatchObject({ source: "ai", everyMinutes: 30, required: false });
  });

  it("doesn't let a repeating check-in become one-time, or repeat faster than every 5 minutes", () => {
    const merged = mergeAiCheckins(base, [
      { id: "water-break", everyMinutes: 0 },
      { id: "symptom-check", everyMinutes: 1 },
    ]);
    expect(merged.find((c) => c.id === "water-break")!.everyMinutes).toBe(water().everyMinutes);
    expect(merged.find((c) => c.id === "symptom-check")!.everyMinutes).toBe(5);
  });

  it("ignores junk", () => {
    const merged = mergeAiCheckins(base, [
      { id: "water-break", everyMinutes: NaN },
      { id: "water-break", everyMinutes: -5 },
      { id: "no-title", everyMinutes: 10 },
    ]);
    expect(merged).toEqual(base);
  });
});

describe("planActivity", () => {
  const start = new Date("2026-07-15T22:00:00Z");

  it("caps time at the FHSAA limit", () => {
    const band = bandForWbgtF(88);
    const plan = planActivity(getCheckins("team", "high"), band, start, 180);
    expect(plan.minutes).toBe(120);
    expect(plan.capped).toBe(true);
  });

  it("cancels at 92.1 °F and above", () => {
    const plan = planActivity(getCheckins("team", "extreme"), bandForWbgtF(93), start, 60);
    expect(plan.cancelled).toBe(true);
    expect(plan.schedule).toEqual([]);
  });

  it("schedules breaks through the activity, in time order", () => {
    const plan = planActivity(getCheckins("band", "elevated"), bandForWbgtF(84), start, 60);
    const water = plan.schedule.filter((s) => s.checkin.id === "water-break").map((s) => (s.at.getTime() - start.getTime()) / 60000);
    expect(water).toEqual([20, 40]);
    const times = plan.schedule.map((s) => s.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(plan.schedule[0].checkin.id).toBe("cooling-zone"); // once, at the start
  });
});
