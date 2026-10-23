import { describe, expect, it } from "vitest";
import { assessRisk, bandForWbgtF, maxRisk } from "../src/risk";
import { fToC } from "../src/wbgt";

describe("FHSAA bands", () => {
  it.each([
    [70, "lower", false],
    [81.9, "lower", false],
    [82.0, "elevated", false], // table says "< 82.0" is normal, so 82.0 is not
    [82.1, "elevated", false],
    [87.0, "elevated", false],
    [87.1, "high", false],
    [90.0, "high", false],
    [90.1, "extreme", false],
    [92.0, "extreme", false],
    [92.1, "extreme", true],
    [100, "extreme", true],
  ])("%s °F → %s (stop outdoor: %s)", (f, level, stop) => {
    const band = bandForWbgtF(f);
    expect(band.level).toBe(level);
    expect(band.stopOutdoor).toBe(stop);
  });

  it("rounds up toward caution", () => {
    expect(bandForWbgtF(81.91).level).toBe("elevated");
    expect(bandForWbgtF(87.01).level).toBe("high");
    expect(bandForWbgtF(90.01).level).toBe("extreme");
    expect(bandForWbgtF(92.01).stopOutdoor).toBe(true);
  });

  it("matches the FHSAA limits", () => {
    expect(bandForWbgtF(85).restBreaksPerHour).toBe(3);
    expect(bandForWbgtF(88).maxActivityMinutes).toBe(120);
    expect(bandForWbgtF(88).restBreaksPerHour).toBe(4);
    expect(bandForWbgtF(91).maxActivityMinutes).toBe(60);
    expect(bandForWbgtF(91).restBreaksPerHour).toBe(5);
    expect(bandForWbgtF(93).maxActivityMinutes).toBe(0);
  });
});

describe("assessRisk", () => {
  const now = new Date("2026-07-15T18:00:00Z");

  it("converts °C and rounds the reading up", () => {
    const r = assessRisk(fToC(81.95), now, now);
    expect(r.wbgtF).toBe(82.0);
    expect(r.level).toBe("elevated");
  });

  it("flags data older than 2 hours", () => {
    expect(assessRisk(25, new Date("2026-07-15T16:00:00Z"), now).stale).toBe(false);
    expect(assessRisk(25, new Date("2026-07-15T15:59:00Z"), now).stale).toBe(true);
  });
});

describe("maxRisk", () => {
  it("keeps the more cautious level", () => {
    expect(maxRisk("lower", "high")).toBe("high");
    expect(maxRisk("extreme", "elevated")).toBe("extreme");
    expect(maxRisk("elevated", "elevated")).toBe("elevated");
  });
});
