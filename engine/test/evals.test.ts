import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
// @ts-expect-error plain JS script
import { checkProfile } from "../../tools/run-evals.mjs";
import { ACTIVITIES } from "../src/checkins";
import { EFFORTS, GEARS, guessProfile, ROLES, SHADES, SURFACES, type Role } from "../src/profile";

const scenarios = parse(readFileSync(new URL("../../ai/evals/scenarios.yaml", import.meta.url), "utf8")) as any[];
const profiles = scenarios.filter((s) => s.endpoint === "profile");
const VALID: Record<string, readonly string[]> = { baseTemplate: ACTIVITIES, gear: GEARS, surface: SURFACES, shade: SHADES, effort: EFFORTS, role: ROLES };

describe("AI test scenarios", () => {
  it("ids are unique, and there are at least 15 profile scenarios", () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(profiles.length).toBeGreaterThanOrEqual(15);
  });

  it.each(profiles.map((s) => [s.id, s]))("%s only checks values the schema allows", (_id, s) => {
    expect(["en", "es"]).toContain(s.language);
    expect(s.text.length).toBeLessThanOrEqual(300);
    for (const [key, allowed] of Object.entries(VALID)) for (const v of [s.checks?.[key] ?? []].flat()) expect(allowed).toContain(v);
  });

  it("the checker passes a good profile and catches a bad one", () => {
    const s = profiles.find((p) => p.id === "profile-band-parking-es");
    const good = { mode: "ai", profile: guessProfile(s.text, s.role as Role, "es") };
    expect(checkProfile(s, good)).toEqual([]);
    const bad = { mode: "basic", reason: "budget", profile: { ...good.profile, gear: "none", displayName: "Totalmente seguro" } };
    expect(checkProfile(s, bad).join("; ")).toMatch(/basic mode.*gear none.*displayName.*safe/);
  });
});
