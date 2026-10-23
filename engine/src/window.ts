import type { HourRisk } from "./forecast";
import { riskRank, type RiskLevel } from "./risk";

export interface WindowOptions {
  durationMinutes: number;
  /** Windows start at or after this time. */
  from: Date;
  utcOffsetSeconds: number;
  days?: number;
  /** Earliest local start hour (default 6 AM). */
  earliestHour?: number;
  /** Latest local end hour (default 9 PM). */
  latestHour?: number;
  /** Skip any window with an hour above this chance of rain/storms, % (default 40). */
  maxPrecipChance?: number;
}

export interface ActivityWindow {
  start: Date;
  end: Date;
  /** Worst level of any hour in the window. */
  level: RiskLevel;
  peakWbgtF: number;
  maxPrecipChance: number;
  /** Local calendar date, YYYY-MM-DD. */
  localDate: string;
}

export interface WindowSearch {
  /** Lowest-risk window in the whole search, or null if every window was ruled out. */
  best: ActivityWindow | null;
  /** Best window for each local day that has one, in date order (for the day chips). */
  byDay: ActivityWindow[];
}

const HOUR_MS = 3_600_000;

// Skips windows with storms, missing data or no-outdoor hours. Ties go to lower peak WBGT, then earlier.
export function findBestWindows(hours: HourRisk[], options: WindowOptions): WindowSearch {
  const {
    durationMinutes,
    from,
    utcOffsetSeconds,
    days = 5,
    earliestHour = 6,
    latestHour = 21,
    maxPrecipChance = 40,
  } = options;
  const span = Math.max(1, Math.ceil(durationMinutes / 60));
  // The hour already under way still counts, so "now" can be the answer.
  const first = Math.floor(from.getTime() / HOUR_MS) * HOUR_MS;
  const until = from.getTime() + days * 24 * HOUR_MS;

  const candidates: ActivityWindow[] = [];
  for (let i = 0; i + span <= hours.length; i++) {
    const start = hours[i].time;
    if (start.getTime() < first || start.getTime() >= until) continue;

    const localStart = localHour(start, utcOffsetSeconds);
    const localEnd = localStart + durationMinutes / 60;
    if (localStart < earliestHour || localEnd > latestHour) continue;

    const slice = hours.slice(i, i + span);
    // Hours must be consecutive; a gap in the data means we can't vouch for it.
    if (slice[span - 1].time.getTime() - start.getTime() !== (span - 1) * HOUR_MS) continue;
    if (slice.some((h) => h.level === null || h.stopOutdoor || h.thunder || h.precipChance > maxPrecipChance)) {
      continue;
    }

    const worst = slice.reduce((a, b) => (riskRank(b.level!) > riskRank(a.level!) ? b : a));
    candidates.push({
      start,
      end: new Date(start.getTime() + durationMinutes * 60_000),
      level: worst.level!,
      peakWbgtF: Math.max(...slice.map((h) => h.wbgtF!)),
      maxPrecipChance: Math.max(...slice.map((h) => h.precipChance)),
      localDate: localDate(start, utcOffsetSeconds),
    });
  }

  const ranked = [...candidates].sort(compareWindows);
  const byDay = new Map<string, ActivityWindow>();
  for (const w of ranked) if (!byDay.has(w.localDate)) byDay.set(w.localDate, w);

  return {
    best: ranked[0] ?? null,
    byDay: [...byDay.values()].sort((a, b) => a.start.getTime() - b.start.getTime()),
  };
}

function compareWindows(a: ActivityWindow, b: ActivityWindow): number {
  return (
    riskRank(a.level) - riskRank(b.level) ||
    a.peakWbgtF - b.peakWbgtF ||
    a.start.getTime() - b.start.getTime()
  );
}

function shifted(time: Date, utcOffsetSeconds: number): Date {
  return new Date(time.getTime() + utcOffsetSeconds * 1000);
}

function localHour(time: Date, utcOffsetSeconds: number): number {
  const t = shifted(time, utcOffsetSeconds);
  return t.getUTCHours() + t.getUTCMinutes() / 60;
}

function localDate(time: Date, utcOffsetSeconds: number): string {
  return shifted(time, utcOffsetSeconds).toISOString().slice(0, 10);
}
