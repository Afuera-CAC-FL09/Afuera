import { STALE_AFTER_MINUTES } from "./risk";

/** Minutes since the forecast was downloaded (never negative). */
export function forecastAgeMinutes(fetchedAt: Date, now: Date): number {
  return Math.max(0, (now.getTime() - fetchedAt.getTime()) / 60_000);
}

// Off in demo mode: the saved demo day has no real age.
export function isStale(fetchedAt: Date, now: Date, { demo = false }: { demo?: boolean } = {}): boolean {
  return !demo && forecastAgeMinutes(fetchedAt, now) > STALE_AFTER_MINUTES;
}

/** The demo clock loops so a presentation never runs off the end of the saved day. */
export const DEMO_LOOP_MS = 4 * 3_600_000;

/** Demo time: starts at `demoStart` when demo mode is turned on, and loops every 4 hours. */
export function demoClock(demoStart: Date, deviceNowMs: number, startedAtMs: number): Date {
  return new Date(demoStart.getTime() + (Math.max(0, deviceNowMs - startedAtMs) % DEMO_LOOP_MS));
}
