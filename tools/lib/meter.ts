// Compares WBGT meter readings with the app's estimate for the same hour and place.

import { bandForWbgtF, currentHourIndex, type Forecast, type HourRisk, type RiskLevel } from "../../engine/src";
import { localToUtc, SAMPLE_BANNER } from "./history";

export interface Reading {
  line: number;
  /** As written in the CSV. */
  time: string;
  /** Local calendar date at the meter, YYYY-MM-DD. */
  date: string;
  wbgtF: number;
  lat: number;
  lon: number;
  notes: string;
}

export const READING_COLUMNS = ["time", "wbgtF", "lat", "lon", "notes"];

// "2026-10-17 15:20" (local clock at the meter) or a full ISO time with an offset.
const LOCAL = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})(?::\d{2})?$/;
const ABSOLUTE = /^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

export function parseReadings(rows: Record<string, string>[]): { readings: Reading[]; errors: string[] } {
  const readings: Reading[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const time = r.time ?? "";
    const wbgtF = Number(r.wbgtF);
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const problems = [
      !(LOCAL.test(time) || ABSOLUTE.test(time)) && "time must be like 2026-10-17 15:20",
      !(wbgtF >= 40 && wbgtF <= 120 && r.wbgtF !== "") && "wbgtF must be a reading in °F",
      !(Number.isFinite(lat) && Math.abs(lat) <= 90 && r.lat !== "") && "lat is missing",
      !(Number.isFinite(lon) && Math.abs(lon) <= 180 && r.lon !== "") && "lon is missing",
    ].filter(Boolean);
    if (problems.length) errors.push(`line ${line}: ${problems.join("; ")}`);
    else readings.push({ line, time, date: time.slice(0, 10), wbgtF, lat, lon, notes: r.notes ?? "" });
  });
  return { readings, errors };
}

export function readingInstant(r: Reading, timeZone: string): Date {
  const m = r.time.match(LOCAL);
  return m ? localToUtc(m[1], m[2], timeZone) : new Date(r.time);
}

export interface Comparison {
  reading: Reading;
  at: Date;
  timeZone: string;
  meterLevel: RiskLevel;
  /** null when there's no forecast hour for that time, or the model couldn't compute it. */
  afueraF: number | null;
  afueraLevel: RiskLevel | null;
  /** Afuera minus meter, °F. Positive = Afuera reads higher. */
  gap: number | null;
}

export function compareReading(reading: Reading, forecast: Forecast, risks: HourRisk[]): Comparison {
  const at = readingInstant(reading, forecast.timezone);
  const i = currentHourIndex(risks, at);
  const hour: HourRisk | null = i >= 0 && at.getTime() - risks[i].time.getTime() < 3_600_000 ? risks[i] : null;
  const afueraF = hour?.wbgtF ?? null;
  return {
    reading,
    at,
    timeZone: forecast.timezone,
    meterLevel: bandForWbgtF(reading.wbgtF).level,
    afueraF,
    afueraLevel: hour?.level ?? null,
    gap: afueraF === null ? null : round1(afueraF - reading.wbgtF),
  };
}

const RANK: Record<RiskLevel, number> = { lower: 0, elevated: 1, high: 2, extreme: 3 };

export interface MeterStats {
  /** Readings with an Afuera estimate. Every other number is out of this. */
  n: number;
  noEstimate: number;
  meanAbsGap: number;
  largest: Comparison | null;
  /** Mean of (Afuera − meter). Positive = Afuera runs high. */
  bias: number;
  rmse: number;
  levelMatches: number;
  /** Afuera showed a higher level than the meter (more cautious). */
  afueraHigherLevel: number;
  /** Afuera showed a lower level than the meter (less cautious): the case that matters most. */
  afueraLowerLevel: number;
}

export function meterStats(results: Comparison[]): MeterStats {
  const ok = results.filter((r) => r.gap !== null);
  const gaps = ok.map((r) => r.gap!);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const largest = ok.reduce<Comparison | null>((top, r) => (!top || Math.abs(r.gap!) > Math.abs(top.gap!) ? r : top), null);
  return {
    n: ok.length,
    noEstimate: results.length - ok.length,
    meanAbsGap: round1(mean(gaps.map(Math.abs))),
    largest,
    bias: round1(mean(gaps)),
    rmse: round1(Math.sqrt(mean(gaps.map((g) => g * g)))),
    levelMatches: ok.filter((r) => r.afueraLevel === r.meterLevel).length,
    afueraHigherLevel: ok.filter((r) => RANK[r.afueraLevel!] > RANK[r.meterLevel]).length,
    afueraLowerLevel: ok.filter((r) => RANK[r.afueraLevel!] < RANK[r.meterLevel]).length,
  };
}

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

const LEVEL_NAME: Record<RiskLevel, string> = { lower: "Lower", elevated: "Elevated", high: "High", extreme: "Extreme" };
const when = (c: Comparison) =>
  c.at.toLocaleString("en-US", { timeZone: c.timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(1)} °F`;
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");

export const COMPARISON_COLUMNS = ["time", "notes", "meterWbgtF", "meterLevel", "afueraWbgtF", "afueraLevel", "gapF", "levelMatch"];

export function comparisonRows(results: Comparison[]): Record<string, unknown>[] {
  return results.map((c) => ({
    time: c.reading.time,
    notes: c.reading.notes,
    meterWbgtF: c.reading.wbgtF,
    meterLevel: c.meterLevel,
    afueraWbgtF: c.afueraF ?? "",
    afueraLevel: c.afueraLevel ?? "no estimate",
    gapF: c.gap ?? "",
    levelMatch: c.gap === null ? "" : c.afueraLevel === c.meterLevel ? "yes" : "no",
  }));
}

export function meterReport(
  results: Comparison[],
  meta: { input: string; generated: Date; source: string; chartFile: string; csvFile: string; skipped: string[]; sample?: boolean },
): string {
  const s = meterStats(results);
  const direction = s.bias > 0.2 ? "Afuera runs high (more cautious than the meter) on average." : s.bias < -0.2 ? "Afuera runs low (less cautious than the meter) on average." : "No clear lean either way.";
  const lines = [
    "# Afuera vs. a WBGT meter",
    "",
    `Readings: \`${meta.input}\` · Generated ${meta.generated.toISOString().slice(0, 10)} · Weather: ${meta.source}`,
    "",
    meta.sample ? `${SAMPLE_BANNER}\n` : "",
    `**Sample size: ${s.n} reading${s.n === 1 ? "" : "s"}.**${s.n < 30 ? " That's a small sample: treat these numbers as a first look, not a measured accuracy." : ""}`,
    s.noEstimate ? `${s.noEstimate} more reading(s) had no Afuera estimate (no forecast for that hour) and are left out.` : "",
    "",
    "## Summary",
    "",
    "| | |",
    "|---|---|",
    `| Average gap | ${s.meanAbsGap.toFixed(1)} °F |`,
    `| Largest gap | ${s.largest ? `${signed(s.largest.gap!)} (${when(s.largest)}${s.largest.reading.notes ? `, ${s.largest.reading.notes}` : ""})` : "—"} |`,
    `| Bias (Afuera − meter) | ${signed(s.bias)}. ${direction} |`,
    `| Root-mean-square gap | ${s.rmse.toFixed(1)} °F |`,
    `| Same heat level as the meter | ${s.levelMatches} of ${s.n} (${pct(s.levelMatches, s.n)}) |`,
    `| Afuera one or more levels higher | ${s.afueraHigherLevel} of ${s.n} |`,
    `| Afuera one or more levels lower | ${s.afueraLowerLevel} of ${s.n} |`,
    "",
    "## Every reading",
    "",
    `![Scatter chart: each dot is one reading, meter WBGT across, Afuera's estimate up. Dots above the diagonal are where Afuera read higher than the meter](${meta.chartFile})`,
    "",
    "| Time | Notes | Meter (°F) | Level | Afuera (°F) | Level | Gap |",
    "|---|---|---|---|---|---|---|",
    ...results.map((c) =>
      `| ${when(c)} | ${c.reading.notes} | ${c.reading.wbgtF.toFixed(1)} | ${LEVEL_NAME[c.meterLevel]} | ${c.afueraF?.toFixed(1) ?? "—"} | ${c.afueraLevel ? LEVEL_NAME[c.afueraLevel] : "no estimate"} | ${c.gap === null ? "—" : signed(c.gap)} |`,
    ),
    "",
    `The same table is in \`${meta.csvFile}\`.`,
    meta.skipped.length ? `\nSkipped rows:\n\n${meta.skipped.map((e) => `- ${e}`).join("\n")}` : "",
    "",
    "## How this was worked out",
    "",
    "- Afuera's number for each reading is what the app would have shown at that time: the WBGT of the forecast hour covering it, from the same engine (Liljegren model), rounded up to 0.1 °F like the app.",
    "- Levels for both use the FHSAA table (Policy 41.8.3), so a meter reading of 87.0 °F is Elevated and 87.1 °F is High.",
    "- Weather is from Open-Meteo for the meter's location (forecast data for a grid square about 1–10 km wide), not measured on the field.",
    "",
    "## Limits",
    "",
    "- A forecast can't see the exact spot: turf, asphalt, shade, a building blocking the wind. The meter does.",
    "- Meters differ too. Note the meter model, and whether it was in the sun at chest height, in the notes column.",
    "- Calm wind is the known weak spot: the model can read high when forecast wind is near zero.",
    "",
  ];
  return lines.filter((l, i, all) => !(l === "" && all[i - 1] === "")).join("\n");
}

const INK = "#2B2F36";
const MUTED = "#555D68";
const GRID = "#E6F1FA";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Meter across, Afuera up, one dot per reading, with the "same reading" diagonal and the FHSAA thresholds. */
export function scatterSvg(results: Comparison[]): string {
  const pts = results.filter((c) => c.afueraF !== null);
  const vals = pts.flatMap((c) => [c.reading.wbgtF, c.afueraF!]);
  const lo = Math.floor(Math.min(78, ...vals) / 2) * 2;
  const hi = Math.ceil(Math.max(94, ...vals) / 2) * 2;
  const W = 560;
  const H = 560;
  const m = { l: 64, r: 24, t: 70, b: 56 };
  const x = (v: number) => m.l + ((v - lo) / (hi - lo)) * (W - m.l - m.r);
  const y = (v: number) => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);

  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-labelledby="t d">`,
    `<title id="t">Afuera's WBGT estimate vs. a WBGT meter</title>`,
    `<desc id="d">${pts.length} readings. Dots above the diagonal are where Afuera read higher than the meter.</desc>`,
    `<rect width="${W}" height="${H}" fill="#FFFFFF"/>`,
    `<text x="16" y="28" font-size="17" font-weight="600" fill="${INK}">Afuera's estimate vs. the meter (WBGT °F)</text>`,
    `<text x="16" y="48" font-size="12" fill="${MUTED}">${pts.length} reading${pts.length === 1 ? "" : "s"}. Dashed lines are the FHSAA level thresholds.</text>`,
  ];
  for (let v = lo; v <= hi; v += 2) {
    out.push(`<line x1="${x(v)}" x2="${x(v)}" y1="${y(lo)}" y2="${y(hi)}" stroke="${GRID}"/>`);
    out.push(`<line x1="${x(lo)}" x2="${x(hi)}" y1="${y(v)}" y2="${y(v)}" stroke="${GRID}"/>`);
    out.push(`<text x="${x(v)}" y="${H - m.b + 18}" font-size="11" fill="${MUTED}" text-anchor="middle">${v}</text>`);
    out.push(`<text x="${m.l - 8}" y="${y(v) + 4}" font-size="11" fill="${MUTED}" text-anchor="end">${v}</text>`);
  }
  // FHSAA thresholds (upper edge of Lower, Elevated, High, and the 92.0 no-outdoor line).
  for (const t of [82, 87, 90, 92]) {
    if (t <= lo || t >= hi) continue;
    out.push(`<line x1="${x(t)}" x2="${x(t)}" y1="${y(lo)}" y2="${y(hi)}" stroke="#C9DDEE" stroke-dasharray="4 4"/>`);
    out.push(`<line x1="${x(lo)}" x2="${x(hi)}" y1="${y(t)}" y2="${y(t)}" stroke="#C9DDEE" stroke-dasharray="4 4"/>`);
  }
  out.push(`<line x1="${x(lo)}" y1="${y(lo)}" x2="${x(hi)}" y2="${y(hi)}" stroke="${MUTED}" stroke-width="1.5"/>`);
  const tag = hi - (hi - lo) * 0.12;
  out.push(`<text x="${x(tag) - 8}" y="${y(tag) - 4}" font-size="11" fill="${MUTED}" text-anchor="end">same reading</text>`);
  out.push(`<text x="${x(lo) + 8}" y="${y(hi) + 16}" font-size="11" fill="${MUTED}">Afuera higher ↑</text>`);
  out.push(`<text x="${x(hi) - 8}" y="${y(lo) - 8}" font-size="11" fill="${MUTED}" text-anchor="end">Afuera lower ↓</text>`);
  out.push(`<text x="${(x(lo) + x(hi)) / 2}" y="${H - 14}" font-size="12" fill="${INK}" text-anchor="middle">Meter WBGT (°F)</text>`);
  out.push(`<text transform="translate(18 ${(y(lo) + y(hi)) / 2}) rotate(-90)" font-size="12" fill="${INK}" text-anchor="middle">Afuera WBGT (°F)</text>`);
  for (const c of pts) {
    const tip = `${when(c)}${c.reading.notes ? ` (${c.reading.notes})` : ""}: meter ${c.reading.wbgtF.toFixed(1)} °F ${LEVEL_NAME[c.meterLevel]}, Afuera ${c.afueraF!.toFixed(1)} °F ${LEVEL_NAME[c.afueraLevel!]}, gap ${signed(c.gap!)}`;
    out.push(`<g><title>${esc(tip)}</title><circle cx="${x(c.reading.wbgtF)}" cy="${y(c.afueraF!)}" r="10" fill="#FFFFFF" fill-opacity="0"/><circle cx="${x(c.reading.wbgtF)}" cy="${y(c.afueraF!)}" r="5" fill="${INK}" stroke="#FFFFFF" stroke-width="2"/></g>`);
  }
  out.push(`</svg>`);
  return out.join("\n") + "\n";
}
