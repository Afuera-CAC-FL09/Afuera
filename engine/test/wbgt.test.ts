import { describe, expect, it } from "vitest";
import { calcWbgt } from "../src/wbgt";
import oracle from "./fixtures/liljegren-oracle.json";

// Fixture made by tools/wbgt-oracle/make-fixtures.mjs from Liljegren's original C.
// The requirement is agreement within 0.5 °C (about 1 °F).
const TOLERANCE_C = 0.5;

function run(input: (typeof oracle)[number]["input"]) {
  return calcWbgt({
    time: new Date(Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute)),
    avgMinutes: input.avg,
    lat: input.lat,
    lon: input.lon,
    solar: input.solar,
    pressure: input.pressure,
    tempC: input.tempC,
    rh: input.rh,
    windSpeed: input.windSpeed,
    windHeight: input.windHeight,
    dT: input.dT,
    urban: input.urban === 1,
  });
}

describe("calcWbgt matches the original C code", () => {
  it(`agrees within ${TOLERANCE_C} °C on all ${oracle.length} oracle cases`, () => {
    let worst = { field: "", diff: 0, index: -1 };
    oracle.forEach(({ input, expected }, index) => {
      const got = run(input);
      if (expected === null) {
        expect(got, `case ${index} should not converge`).toBeNull();
        return;
      }
      expect(got, `case ${index} should converge`).not.toBeNull();
      for (const field of ["wbgt", "globe", "naturalWetBulb"] as const) {
        const diff = Math.abs(got![field] - expected[field]);
        if (diff > worst.diff) worst = { field, diff, index };
      }
    });
    console.log(`largest difference from C: ${worst.diff.toFixed(4)} °C (${worst.field}, case ${worst.index})`);
    expect(worst.diff).toBeLessThan(TOLERANCE_C);
  });
});

describe("calcWbgt physics sanity", () => {
  const base = {
    time: new Date("2026-07-15T18:00:00Z"), // 2 PM EDT
    avgMinutes: 60,
    lat: 28.29,
    lon: -81.41,
    solar: 900,
    pressure: 1015,
    tempC: 33,
    rh: 55,
    windSpeed: 3,
    windHeight: 10,
  };

  it("is higher in sun than at night with the same air", () => {
    const day = calcWbgt(base)!;
    const night = calcWbgt({ ...base, time: new Date("2026-07-16T06:00:00Z"), solar: 0 })!;
    expect(day.wbgt).toBeGreaterThan(night.wbgt + 1);
  });

  it("rises with humidity", () => {
    expect(calcWbgt({ ...base, rh: 80 })!.wbgt).toBeGreaterThan(calcWbgt({ ...base, rh: 40 })!.wbgt);
  });

  it("globe is hotter than the air in strong sun", () => {
    expect(calcWbgt(base)!.globe).toBeGreaterThan(base.tempC);
  });
});
