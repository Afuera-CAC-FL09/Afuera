// Tests for the evidence tools in tools/lib (what-if and meter-compare), run on the
// saved demo day so they never need the internet.
import { describe, expect, it } from "vitest";
import demo from "../../data/demo/kissimmee-2026-07-15.json";
import { parseCsv, toCsv } from "../../tools/lib/csv";
import { isSampleInput, localToUtc, utcOffsetSeconds } from "../../tools/lib/history";
import { compareReading, meterReport, meterStats, parseReadings, scatterSvg } from "../../tools/lib/meter";
import { analyzePractice, chartSvg, minutesByLevel, parsePractices, reportMarkdown, summarize } from "../../tools/lib/whatif";
import { hourlyRisk } from "../src/forecast";
import { parseOpenMeteo, type OpenMeteoResponse } from "../src/openmeteo";

const forecast = parseOpenMeteo(demo.forecast as unknown as OpenMeteoResponse, new Date(demo.demoNow));
const risks = hourlyRisk(forecast);
const practice = (date: string, start: string, durationMin: number) =>
  parsePractices([{ date, start, durationMin: String(durationMin), place: "Kissimmee", lat: "28.29", lon: "-81.41", activity: "band" }]).practices[0];

describe("csv", () => {
  it("reads quotes, commas and comment lines", () => {
    const rows = parseCsv('# sample\r\nplace,notes\r\n"Field 2, north","said ""hot"""\r\n');
    expect(rows).toEqual([{ place: "Field 2, north", notes: 'said "hot"' }]);
  });

  it("writes what it reads", () => {
    const rows = [{ a: "x,y", b: 'q"' }];
    expect(parseCsv(toCsv(rows, ["a", "b"]))).toEqual(rows);
  });
});

describe("local times", () => {
  it("turns a Florida wall-clock time into the right instant, summer and winter", () => {
    expect(localToUtc("2026-07-15", "13:00", "America/New_York").toISOString()).toBe(new Date(demo.demoNow).toISOString());
    expect(localToUtc("2026-12-01", "13:00", "America/New_York").toISOString()).toBe("2026-12-01T18:00:00.000Z");
    expect(utcOffsetSeconds("America/New_York", new Date("2026-07-15T12:00:00Z"))).toBe(-14400);
  });
});

describe("what-if", () => {
  it("rejects bad rows with the line number", () => {
    const { practices, errors } = parsePractices([{ date: "7/15", start: "2pm", durationMin: "0", lat: "", lon: "" }]);
    expect(practices).toEqual([]);
    expect(errors[0]).toMatch(/^line 2: date .*start .*durationMin .*lat .*lon/);
  });

  it("counts every minute of a practice exactly once", () => {
    const start = localToUtc("2026-07-15", "13:30", forecast.timezone);
    const m = minutesByLevel(risks, start, new Date(start.getTime() + 150 * 60_000));
    expect(m.lower + m.elevated + m.high + m.extreme + m.unknown).toBe(150);
  });

  it("2 PM on the demo day is Extreme, and Better time finds a lower-risk window that day", () => {
    const r = analyzePractice(practice("2026-07-15", "14:00", 120), forecast, risks);
    expect(r.peakLevel).toBe("extreme");
    expect(r.minutes.high + r.minutes.extreme).toBe(120);
    expect(r.couldMove).toBe(true);
    expect(r.afuera!.localDate).toBe("2026-07-15");
    expect(["lower", "elevated"]).toContain(r.afuera!.level);
    expect(r.minutesAvoided).toBe(120 - (r.afueraMinutes!.high + r.afueraMinutes!.extreme));
  });

  it("an early-morning practice has no High/Extreme time and nothing to move", () => {
    const r = analyzePractice(practice("2026-07-16", "07:00", 60), forecast, risks);
    expect(r.minutes.high + r.minutes.extreme).toBe(0);
    expect(r.couldMove).toBe(false);
    expect(r.minutesAvoided).toBe(0);
  });

  it("a practice outside the saved data is counted as no data, not as lower risk", () => {
    const r = analyzePractice(practice("2026-08-01", "14:00", 60), forecast, risks);
    expect(r.peakLevel).toBeNull();
    expect(r.minutes.unknown).toBe(60);
    expect(summarize([r]).practices).toBe(0);
  });

  it("report says 'time spent in High/Extreme heat', never 'prevented' or 'safe'", () => {
    const results = [analyzePractice(practice("2026-07-15", "14:00", 120), forecast, risks), analyzePractice(practice("2026-07-16", "07:00", 60), forecast, risks)];
    const md = reportMarkdown(results, { input: "x.csv", generated: new Date(), source: "test", chartFile: "x.svg", csvFile: "x.csv", skipped: [] });
    const text = md + chartSvg(results);
    expect(md).toMatch(/Time spent in High\/Extreme heat/);
    expect(text).not.toMatch(/prevent|\bsafe\b|saved lives|heatstroke/i);
    expect(md).toMatch(/Practices that reached High or Extreme heat \| 1 of 2/);
  });
});

describe("meter compare", () => {
  // The 1 PM hour on the demo day: Afuera says High.
  const onePm = risks.find((h) => h.time.getTime() === Date.parse(demo.demoNow))!;
  const reading = (time: string, wbgtF: number) =>
    parseReadings([{ time, wbgtF: String(wbgtF), lat: "28.29", lon: "-81.41", notes: "test" }]).readings[0];

  it("compares with the forecast hour the app would show, in local or ISO time", () => {
    const local = compareReading(reading("2026-07-15 13:40", 86.0), forecast, risks);
    const iso = compareReading(reading("2026-07-15T17:40:00Z", 86.0), forecast, risks);
    expect(local.at.toISOString()).toBe(iso.at.toISOString());
    expect(local.afueraF).toBe(onePm.wbgtF);
    expect(local.afueraLevel).toBe("high");
    expect(local.meterLevel).toBe("elevated");
    expect(local.gap).toBeCloseTo(onePm.wbgtF! - 86.0, 5);
  });

  it("states gap, bias and level matches over the readings that have an estimate", () => {
    const afuera = onePm.wbgtF!;
    const results = [
      compareReading(reading("2026-07-15 13:10", 86.0), forecast, risks), // Afuera higher; Elevated vs High
      compareReading(reading("2026-07-15 13:20", 89.9), forecast, risks), // Afuera lower; both High
      compareReading(reading("2026-08-30 13:00", 85.0), forecast, risks), // outside the data
    ];
    const s = meterStats(results);
    expect(s.n).toBe(2);
    expect(s.noEstimate).toBe(1);
    const gaps = [afuera - 86.0, afuera - 89.9];
    expect(s.meanAbsGap).toBeCloseTo((Math.abs(gaps[0]) + Math.abs(gaps[1])) / 2, 1);
    expect(s.bias).toBeCloseTo((gaps[0] + gaps[1]) / 2, 1);
    expect(s.largest!.gap).toBeCloseTo(Math.abs(gaps[0]) > Math.abs(gaps[1]) ? gaps[0] : gaps[1], 1);
    expect(s.levelMatches).toBe(1);
    expect(s.afueraHigherLevel).toBe(1);
    const md = meterReport(results, { input: "x.csv", generated: new Date(), source: "test", chartFile: "x.svg", csvFile: "x.csv", skipped: [] });
    expect(md).toMatch(/Sample size: 2 readings/);
    expect(scatterSvg(results)).toMatch(/2 readings/);
  });

  it("rejects bad rows and flags sample files", () => {
    const { errors } = parseReadings([{ time: "3pm", wbgtF: "hot", lat: "28", lon: "-81" }]);
    expect(errors[0]).toMatch(/line 2: time .*wbgtF/);
    expect(isSampleInput("# SAMPLE READINGS, MADE UP\ntime,wbgtF")).toBe(true);
    expect(isSampleInput("time,wbgtF\n2026-10-17 10:00,80,28,-81,sample spot")).toBe(false);
  });
});
