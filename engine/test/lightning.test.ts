import { describe, expect, it } from "vitest";
import { LIGHTNING_WAIT_MINUTES, lightningWait } from "../src/lightning";

const t0 = Date.parse("2026-07-15T20:00:00Z");
const min = 60_000;

describe("lightningWait", () => {
  it("waits the full 30 minutes after thunder", () => {
    expect(LIGHTNING_WAIT_MINUTES).toBe(30);
    expect(lightningWait(t0, t0)).toEqual({ remainingMs: 30 * min, done: false });
    expect(lightningWait(t0, t0 + 29 * min + 59_000)).toMatchObject({ remainingMs: 1000, done: false });
  });

  it("is done at exactly 30 minutes and stays done", () => {
    expect(lightningWait(t0, t0 + 30 * min)).toEqual({ remainingMs: 0, done: true });
    expect(lightningWait(t0, t0 + 90 * min)).toEqual({ remainingMs: 0, done: true });
  });

  it("restarts from the latest thunder", () => {
    const again = t0 + 20 * min;
    expect(lightningWait(again, t0 + 30 * min)).toMatchObject({ remainingMs: 20 * min, done: false });
  });
});
