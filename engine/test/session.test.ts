import { describe, expect, it } from "vitest";
import demo from "../../data/demo/kissimmee-2026-07-15.json";
import { getCheckins, planActivity } from "../src/checkins";
import { currentHourIndex, hourlyRisk } from "../src/forecast";
import { parseOpenMeteo, type OpenMeteoResponse } from "../src/openmeteo";
import { bandForWbgtF } from "../src/risk";
import { sessionStats } from "../src/session";

// Demo day: 1 PM is High, 2 PM is Extreme.
const start = new Date(demo.demoNow);
const forecast = parseOpenMeteo(demo.forecast as unknown as OpenMeteoResponse, start);
const risks = hourlyRisk(forecast);
const startHour = risks[currentHourIndex(risks, start)];
const plan = planActivity(getCheckins("band", "high"), bandForWbgtF(startHour.wbgtF!), start, 120);

describe("session summary numbers", () => {
  it("a full session counts every water break and the hottest hour it ran into", () => {
    const s = sessionStats(risks, plan, start, startHour, 500);
    expect(s.minutes).toBe(120); // FHSAA cap at High
    expect(s.breaksDue).toBe(7); // every 15 min, not counting the start or the end
    expect(s.highest.level).toBe("extreme");
  });

  it("ending early only counts what had come due", () => {
    const s = sessionStats(risks, plan, start, startHour, 40);
    expect(s.minutes).toBe(40);
    expect(s.breaksDue).toBe(2);
    expect(s.highest.level).toBe("high");
  });

  it("ending right away has nothing due", () => {
    expect(sessionStats(risks, plan, start, startHour, 0)).toMatchObject({ minutes: 0, breaksDue: 0 });
  });
});
