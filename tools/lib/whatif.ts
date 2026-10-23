// Reports time spent in High/Extreme heat. Never claim illness was prevented.

import {
  findBestWindows,
  riskRank,
  type ActivityWindow,
  type Forecast,
  type HourRisk,
  type RiskLevel,
} from "../../engine/src";
import { localToUtc, SAMPLE_BANNER, utcOffsetSeconds } from "./history";

export interface Practice {
  /** Line in the CSV (header is line 1), for error messages. */
  line: number;
  date: string;
  start: string;
  durationMin: number;
  place: string;
  lat: number;
  lon: number;
  activity: string;
}

export const PRACTICE_COLUMNS = ["date", "start", "durationMin", "place", "lat", "lon", "activity"];

export function parsePractices(rows: Record<string, string>[]): { practices: Practice[]; errors: string[] } {
  const practices: Practice[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const durationMin = Number(r.durationMin);
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const problems = [
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "") && "date must be YYYY-MM-DD",
      !/^\d{1,2}:\d{2}$/.test(r.start ?? "") && "start must be HH:MM (24-hour)",
      !(durationMin >= 5 && durationMin <= 720) && "durationMin must be 5–720",
      !(Number.isFinite(lat) && Math.abs(lat) <= 90 && r.lat !== "") && "lat is missing",
      !(Number.isFinite(lon) && Math.abs(lon) <= 180 && r.lon !== "") && "lon is missing",
    ].filter(Boolean);
    if (problems.length) errors.push(`line ${line}: ${problems.join("; ")}`);
    else practices.push({ line, date: r.date, start: r.start, durationMin, place: r.place || "", lat, lon, activity: r.activity || "" });
  });
  return { practices, errors };
}

export interface Minutes {
  lower: number;
  elevated: number;
  high: number;
  extreme: number;
  /** No forecast hour, or the model couldn't compute it. */
  unknown: number;
  /** Part of `extreme` that was at 92.1 °F WBGT or above (FHSAA: no outdoor activity). */
  noOutdoor: number;
}

export const highOrExtreme = (m: Minutes) => m.high + m.extreme;

/** Minute by minute, the level of the forecast hour covering it (as the app does). */
export function minutesByLevel(risks: HourRisk[], start: Date, end: Date): Minutes {
  const m: Minutes = { lower: 0, elevated: 0, high: 0, extreme: 0, unknown: 0, noOutdoor: 0 };
  let i = 0;
  for (let t = start.getTime(); t < end.getTime(); t += 60_000) {
    while (i + 1 < risks.length && risks[i + 1].time.getTime() <= t) i++;
    const h = risks[i];
    if (!h || h.time.getTime() > t || t - h.time.getTime() >= 3_600_000 || !h.level) m.unknown++;
    else {
      m[h.level]++;
      if (h.stopOutdoor) m.noOutdoor++;
    }
  }
  return m;
}

/** Worst level and highest WBGT of the hours a time span touches. */
export function peakOf(risks: HourRisk[], start: Date, end: Date): { level: RiskLevel | null; wbgtF: number | null } {
  const first = Math.floor(start.getTime() / 3_600_000) * 3_600_000;
  const hours = risks.filter((h) => h.time.getTime() >= first && h.time < end && h.level);
  if (hours.length === 0) return { level: null, wbgtF: null };
  const worst = hours.reduce((a, b) => (riskRank(b.level!) > riskRank(a.level!) ? b : a));
  return { level: worst.level, wbgtF: Math.max(...hours.map((h) => h.wbgtF!)) };
}

export interface PracticeResult {
  practice: Practice;
  timeZone: string;
  start: Date;
  end: Date;
  peakLevel: RiskLevel | null;
  peakWbgtF: number | null;
  minutes: Minutes;
  /** Better time's pick for that day, or null if every window was ruled out. */
  afuera: ActivityWindow | null;
  afueraMinutes: Minutes | null;
  /** The practice had High/Extreme time and Better time found a lower-risk window that day. */
  couldMove: boolean;
  /** High/Extreme minutes the move would have avoided (0 unless couldMove). */
  minutesAvoided: number;
  /** The day's hours, for the chart. */
  dayHours: HourRisk[];
}

export function analyzePractice(practice: Practice, forecast: Forecast, risks: HourRisk[]): PracticeResult {
  const tz = forecast.timezone;
  const start = localToUtc(practice.date, practice.start, tz);
  const end = new Date(start.getTime() + practice.durationMin * 60_000);
  const minutes = minutesByLevel(risks, start, end);
  const peak = peakOf(risks, start, end);

  // Same search as the Better time screen, over the whole day of the practice.
  const dayStart = localToUtc(practice.date, "00:00", tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
  const { byDay } = findBestWindows(risks, {
    durationMinutes: practice.durationMin,
    from: dayStart,
    utcOffsetSeconds: utcOffsetSeconds(tz, start),
    days: 1,
  });
  const afuera = byDay.find((w) => w.localDate === practice.date) ?? null;
  const afueraMinutes = afuera ? minutesByLevel(risks, afuera.start, afuera.end) : null;

  // Only a move to a lower level counts, the same rule the app uses before it suggests one.
  const couldMove = highOrExtreme(minutes) > 0 && !!afuera && !!peak.level && riskRank(afuera.level) < riskRank(peak.level);
  const minutesAvoided = couldMove ? Math.max(0, highOrExtreme(minutes) - highOrExtreme(afueraMinutes!)) : 0;

  return {
    practice,
    timeZone: tz,
    start,
    end,
    peakLevel: peak.level,
    peakWbgtF: peak.wbgtF,
    minutes,
    afuera,
    afueraMinutes,
    couldMove,
    minutesAvoided,
    dayHours: risks.filter((h) => h.time >= dayStart && h.time < dayEnd),
  };
}

export interface WhatIfSummary {
  practices: number;
  /** Practices with no weather data at all (left out of every other number). */
  noData: number;
  inHighOrExtreme: number;
  minutesHighOrExtreme: number;
  minutesNoOutdoor: number;
  couldMove: number;
  minutesAvoided: number;
}

export function summarize(results: PracticeResult[]): WhatIfSummary {
  const withData = results.filter((r) => r.peakLevel !== null);
  const hot = withData.filter((r) => highOrExtreme(r.minutes) > 0);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    practices: withData.length,
    noData: results.length - withData.length,
    inHighOrExtreme: hot.length,
    minutesHighOrExtreme: sum(hot.map((r) => highOrExtreme(r.minutes))),
    minutesNoOutdoor: sum(withData.map((r) => r.minutes.noOutdoor)),
    couldMove: hot.filter((r) => r.couldMove).length,
    minutesAvoided: sum(hot.map((r) => r.minutesAvoided)),
  };
}

const LEVEL_NAME: Record<RiskLevel, string> = { lower: "Lower", elevated: "Elevated", high: "High", extreme: "Extreme" };

function fmtTime(d: Date, tz: string) {
  return d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}
function fmtDay(d: Date, tz: string) {
  return d.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
}
const hm = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`);
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");

export const RESULT_COLUMNS = [
  "date",
  "start",
  "durationMin",
  "place",
  "activity",
  "peakLevel",
  "peakWbgtF",
  "minutesLower",
  "minutesElevated",
  "minutesHigh",
  "minutesExtreme",
  "minutesNoOutdoorBand",
  "minutesUnknown",
  "afueraStart",
  "afueraEnd",
  "afueraLevel",
  "afueraPeakWbgtF",
  "afueraMinutesHighOrExtreme",
  "couldMove",
  "minutesAvoided",
];

export function resultRows(results: PracticeResult[]): Record<string, unknown>[] {
  return results.map((r) => {
    const p = r.practice;
    const local = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: r.timeZone, hour: "2-digit", minute: "2-digit" });
    return {
      date: p.date,
      start: p.start,
      durationMin: p.durationMin,
      place: p.place,
      activity: p.activity,
      peakLevel: r.peakLevel ?? "no data",
      peakWbgtF: r.peakWbgtF ?? "",
      minutesLower: r.minutes.lower,
      minutesElevated: r.minutes.elevated,
      minutesHigh: r.minutes.high,
      minutesExtreme: r.minutes.extreme,
      minutesNoOutdoorBand: r.minutes.noOutdoor,
      minutesUnknown: r.minutes.unknown,
      afueraStart: r.afuera ? local(r.afuera.start) : "",
      afueraEnd: r.afuera ? local(r.afuera.end) : "",
      afueraLevel: r.afuera?.level ?? "",
      afueraPeakWbgtF: r.afuera?.peakWbgtF ?? "",
      afueraMinutesHighOrExtreme: r.afueraMinutes ? highOrExtreme(r.afueraMinutes) : "",
      couldMove: r.couldMove ? "yes" : "no",
      minutesAvoided: r.minutesAvoided,
    };
  });
}

export function reportMarkdown(
  results: PracticeResult[],
  meta: { input: string; generated: Date; source: string; chartFile: string; csvFile: string; skipped: string[]; sample?: boolean },
): string {
  const s = summarize(results);
  const hot = results.filter((r) => r.peakLevel && highOrExtreme(r.minutes) > 0);
  const lines = [
    "# What if they had used Afuera?",
    "",
    `Schedule: \`${meta.input}\` · Generated ${meta.generated.toISOString().slice(0, 10)} · Weather: ${meta.source}`,
    "",
    meta.sample ? `${SAMPLE_BANNER}\n` : "",
    "## Summary",
    "",
    `| | |`,
    `|---|---|`,
    `| Practices checked | ${s.practices} |`,
    `| Practices that reached High or Extreme heat | ${s.inHighOrExtreme} of ${s.practices} (${pct(s.inHighOrExtreme, s.practices)}) |`,
    `| Time spent in High/Extreme heat | ${hm(s.minutesHighOrExtreme)} of practice time |`,
    `| …of that, at 92.1 °F WBGT or above (FHSAA: no outdoor activity) | ${hm(s.minutesNoOutdoor)} |`,
    `| Practices that could have moved to a lower-risk time the same day | ${s.couldMove} of ${s.inHighOrExtreme} |`,
    `| Time in High/Extreme heat that moving would have avoided | ${hm(s.minutesAvoided)} (${pct(s.minutesAvoided, s.minutesHighOrExtreme)} of it) |`,
    "",
    "Minutes are practice minutes (clock time), not multiplied by the number of kids.",
    s.noData ? `\n${s.noData} practice(s) had no weather data and are left out of these numbers.` : "",
    meta.skipped.length ? `\nSkipped rows in the schedule:\n\n${meta.skipped.map((e) => `- ${e}`).join("\n")}` : "",
    "",
    "## Actual time vs. the Afuera time",
    "",
    `![Each practice that reached High or Extreme heat, on that day's hour-by-hour heat levels, with the lower-risk time Afuera's Better time screen would have suggested](${meta.chartFile})`,
    "",
    "## Practices that reached High or Extreme",
    "",
    "| Date | Actual time | Peak level (WBGT °F) | High/Extreme time | Afuera time | Level there | High/Extreme time there |",
    "|---|---|---|---|---|---|---|",
    ...hot.map((r) => {
      const a = r.afuera;
      const moveCells =
        r.couldMove && a && r.afueraMinutes
          ? [`${fmtTime(a.start, r.timeZone)}–${fmtTime(a.end, r.timeZone)}`, LEVEL_NAME[a.level], hm(highOrExtreme(r.afueraMinutes))]
          : ["no lower-risk time that day", "", ""];
      return `| ${fmtDay(r.start, r.timeZone)} | ${fmtTime(r.start, r.timeZone)}–${fmtTime(r.end, r.timeZone)} | ${LEVEL_NAME[r.peakLevel!]} (${r.peakWbgtF}) | ${hm(highOrExtreme(r.minutes))} | ${moveCells.join(" | ")} |`;
    }),
    hot.length === 0 ? "\n_None of the practices reached High or Extreme._" : "",
    "",
    `Every practice, minute by minute, is in \`${meta.csvFile}\`.`,
    "",
    "## How this was worked out",
    "",
    "- For each practice, the tool downloads that day's hourly weather for the practice location from Open-Meteo's archive of past forecasts: the same kind of data the app uses.",
    "- Afuera's engine turns each hour into WBGT (Liljegren model) and a heat level (FHSAA Policy 41.8.3), exactly as in the app. Each minute of the practice gets the level of the forecast hour it falls in.",
    "- The \"Afuera time\" is what the Better time screen would have picked for that day: the lowest-risk window of the same length between 6 AM and 9 PM, skipping thunderstorms and hours with more than 40% rain chance. A move only counts if that window is at a lower level than the practice's worst hour.",
    "",
    "## Limits",
    "",
    "- These are estimates from forecast data, not readings taken on the field. Shade, turf, asphalt and uniforms change the real heat stress.",
    "- It assumes the program could have moved to any time that day. School hours, field bookings and buses may rule some times out.",
    "- It counts time spent in High/Extreme heat. It does not, and can't, say how many kids would or wouldn't have gotten sick.",
    "",
  ];
  return lines.filter((l, i, all) => !(l === "" && all[i - 1] === "")).join("\n");
}

const INK = "#2B2F36";
const MUTED = "#555D68";
const GRID = "#E6F1FA";
const FILL: Record<RiskLevel, { fill: string; border?: string }> = {
  lower: { fill: "#CFE3F3", border: "#9DBFDC" },
  elevated: { fill: "#FDEBC8", border: "#E8C88A" },
  high: { fill: "#F5A623" },
  extreme: { fill: "#2B2F36" },
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function chartSvg(results: PracticeResult[]): string {
  const rows = results.filter((r) => r.peakLevel && highOrExtreme(r.minutes) > 0).sort((a, b) => a.start.getTime() - b.start.getTime());
  const W = 820;
  const left = 150;
  const right = 140;
  const top = 112;
  const rowH = 40;
  const H = top + Math.max(1, rows.length) * rowH + 24;

  // Local hours of the day on the x axis: 6 AM–9 PM, wider if a practice falls outside.
  const localHour = (r: PracticeResult, d: Date) => (d.getTime() - localToUtc(r.practice.date, "00:00", r.timeZone).getTime()) / 3_600_000;
  let h0 = 6;
  let h1 = 21;
  for (const r of rows) {
    h0 = Math.min(h0, Math.floor(localHour(r, r.start)));
    h1 = Math.max(h1, Math.ceil(localHour(r, r.end)));
  }
  const x = (h: number) => left + ((h - h0) / (h1 - h0)) * (W - left - right);
  const label = (h: number) => `${((h + 11) % 12) + 1}${h < 12 || h === 24 ? "a" : "p"}`;

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-labelledby="t d">`,
    `<title id="t">Actual practice time vs. the Afuera time</title>`,
    `<desc id="d">For each practice that reached High or Extreme heat: the day's heat level by hour, the actual practice, and the lower-risk time Afuera would have suggested.</desc>`,
    `<rect width="${W}" height="${H}" fill="#FFFFFF"/>`,
    `<text x="16" y="28" font-size="17" font-weight="600" fill="${INK}">Actual practice time vs. the Afuera time</text>`,
    `<text x="16" y="48" font-size="12" fill="${MUTED}">Each row is one practice that reached High or Extreme heat. Cells are that day's heat level, hour by hour.</text>`,
  ];

  // Legend: levels, then the two marks. Identity is never color alone: each swatch has its word.
  let lx = 16;
  const ly = 62;
  for (const level of ["lower", "elevated", "high", "extreme"] as RiskLevel[]) {
    const f = FILL[level];
    out.push(`<rect x="${lx}" y="${ly}" width="14" height="10" rx="2" fill="${f.fill}"${f.border ? ` stroke="${f.border}"` : ""}/>`);
    out.push(`<text x="${lx + 19}" y="${ly + 9}" font-size="12" fill="${INK}">${LEVEL_NAME[level]}</text>`);
    lx += 19 + LEVEL_NAME[level].length * 7 + 16;
  }
  out.push(`<rect x="${lx}" y="${ly - 3}" width="26" height="16" rx="4" fill="none" stroke="${INK}" stroke-width="2"/>`);
  out.push(`<text x="${lx + 32}" y="${ly + 9}" font-size="12" fill="${INK}">Actual practice</text>`);
  lx += 32 + 100;
  out.push(`<rect x="${lx}" y="${ly + 3}" width="26" height="4" rx="2" fill="${INK}"/>`);
  out.push(`<text x="${lx + 32}" y="${ly + 9}" font-size="12" fill="${INK}">Afuera time</text>`);

  // Hour axis and recessive grid.
  for (let h = h0; h <= h1; h++) {
    if (h % 3 !== 0) continue;
    out.push(`<line x1="${x(h)}" x2="${x(h)}" y1="${top - 6}" y2="${H - 20}" stroke="${GRID}"/>`);
    out.push(`<text x="${x(h)}" y="${top - 10}" font-size="11" fill="${MUTED}" text-anchor="middle">${label(h)}</text>`);
  }
  out.push(`<text x="${W - right + 28}" y="${top - 10}" font-size="11" fill="${MUTED}">High/Extreme time</text>`);

  if (rows.length === 0) {
    out.push(`<text x="${left}" y="${top + 24}" font-size="13" fill="${MUTED}">None of the practices reached High or Extreme.</text>`);
  }

  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const tz = r.timeZone;
    const he = highOrExtreme(r.minutes);
    const after = r.couldMove && r.afueraMinutes ? highOrExtreme(r.afueraMinutes) : he;
    const tip = r.couldMove && r.afuera
      ? `${fmtDay(r.start, tz)}: practice ${fmtTime(r.start, tz)}–${fmtTime(r.end, tz)} peaked at ${LEVEL_NAME[r.peakLevel!]} (${r.peakWbgtF} °F WBGT), ${he} min in High/Extreme. Afuera time ${fmtTime(r.afuera.start, tz)}–${fmtTime(r.afuera.end, tz)}: ${LEVEL_NAME[r.afuera.level]}, ${after} min in High/Extreme.`
      : `${fmtDay(r.start, tz)}: practice ${fmtTime(r.start, tz)}–${fmtTime(r.end, tz)} peaked at ${LEVEL_NAME[r.peakLevel!]} (${r.peakWbgtF} °F WBGT), ${he} min in High/Extreme. No lower-risk time that day.`;
    out.push(`<g><title>${esc(tip)}</title>`);
    out.push(`<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="#FFFFFF" fill-opacity="0"/>`);
    out.push(`<text x="16" y="${y + 18}" font-size="12" fill="${INK}">${esc(fmtDay(r.start, tz))}</text>`);
    out.push(`<text x="16" y="${y + 32}" font-size="11" fill="${MUTED}">${esc(r.practice.place || fmtTime(r.start, tz))}</text>`);

    for (const h of r.dayHours) {
      if (!h.level) continue;
      const lh = localHour(r, h.time);
      if (lh < h0 || lh >= h1) continue;
      const f = FILL[h.level];
      out.push(`<rect x="${x(lh) + 1}" y="${y + 9}" width="${x(lh + 1) - x(lh) - 2}" height="12" rx="2" fill="${f.fill}"${f.border ? ` stroke="${f.border}" stroke-width="1"` : ""}/>`);
    }
    out.push(`<rect x="${x(localHour(r, r.start))}" y="${y + 5}" width="${x(localHour(r, r.end)) - x(localHour(r, r.start))}" height="20" rx="4" fill="none" stroke="${INK}" stroke-width="2"/>`);
    if (r.couldMove && r.afuera) {
      out.push(`<rect x="${x(localHour(r, r.afuera.start))}" y="${y + 29}" width="${x(localHour(r, r.afuera.end)) - x(localHour(r, r.afuera.start))}" height="4" rx="2" fill="${INK}"/>`);
    }
    out.push(
      `<text x="${W - right + 28}" y="${y + 20}" font-size="12" fill="${INK}">${r.couldMove ? `${he} → ${after} min` : `${he} min`}</text>`,
    );
    if (!r.couldMove) out.push(`<text x="${W - right + 28}" y="${y + 33}" font-size="11" fill="${MUTED}">no lower-risk time</text>`);
    out.push(`</g>`);
  });

  out.push(`</svg>`);
  return out.join("\n") + "\n";
}
