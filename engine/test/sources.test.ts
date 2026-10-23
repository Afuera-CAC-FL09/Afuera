import { describe, expect, it } from "vitest";
import demo from "../../data/demo/kissimmee-2026-07-15.json";
import { hourlyRisk } from "../src/forecast";
import { parseNwsAlerts } from "../src/nws";
import { parseOpenMeteo, type OpenMeteoResponse } from "../src/openmeteo";
import { findBestWindows } from "../src/window";

describe("demo day (Kissimmee, July 15 2026)", () => {
  const forecast = parseOpenMeteo(demo.forecast as unknown as OpenMeteoResponse, new Date(demo.demoNow));
  const risks = hourlyRisk(forecast);

  it("has 5 days of hourly data", () => {
    expect(forecast.hours).toHaveLength(120);
    expect(forecast.hours[0].time.toISOString()).toBe("2026-07-15T04:00:00.000Z"); // midnight EDT
  });

  it("covers all four levels on the demo day", () => {
    const day = new Set(risks.slice(0, 24).map((r) => r.level));
    expect([...day].sort()).toEqual(["elevated", "extreme", "high", "lower"]);
  });

  it("suggests an early-morning time for a 2-hour practice", () => {
    const { best } = findBestWindows(risks, {
      durationMinutes: 120,
      from: new Date(demo.demoNow),
      utcOffsetSeconds: forecast.utcOffsetSeconds,
    });
    expect(best).not.toBeNull();
    const localHour = (best!.start.getUTCHours() + 24 - 4) % 24;
    expect(localHour).toBeLessThan(9);
    expect(best!.level).toBe("lower");
  });
});

describe("parseOpenMeteo", () => {
  it("drops hours with missing values", () => {
    const json = structuredClone(demo.forecast) as unknown as OpenMeteoResponse;
    json.hourly.temperature_2m[3] = null;
    expect(parseOpenMeteo(json, new Date()).hours).toHaveLength(119);
  });
});

describe("parseNwsAlerts", () => {
  it("sorts alerts into heat, storm and other", () => {
    const feature = (event: string) => ({
      properties: { id: event, event, headline: null, severity: "Moderate", onset: null, ends: null, expires: "2026-07-15T23:00:00Z", description: null, instruction: null },
    });
    const alerts = parseNwsAlerts({ features: [feature("Heat Advisory"), feature("Severe Thunderstorm Warning"), feature("Rip Current Statement")] });
    expect(alerts.map((a) => a.kind)).toEqual(["heat", "storm", "other"]);
    expect(alerts[0].ends?.toISOString()).toBe("2026-07-15T23:00:00.000Z");
  });
});
