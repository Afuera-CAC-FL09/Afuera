// Past forecasts from Open-Meteo's Historical Forecast API (what the app would have shown that day).

import { HOURLY, parseOpenMeteo, type Forecast, type OpenMeteoResponse } from "../../engine/src";

export const HISTORY_SOURCE = "Open-Meteo Historical Forecast API (CC BY 4.0)";

/** Input files whose comment lines say SAMPLE or MADE UP get a banner, so a test report is never mistaken for evidence. */
export const isSampleInput = (csvText: string) => /^\s*#.*\b(SAMPLE|MADE UP)\b/m.test(csvText);
export const SAMPLE_BANNER =
  "> **Sample input.** This report was made from made-up test data to check the tool works. It is not evidence. Run the tool again on the real data.";

export function historyUrl(lat: number, lon: number, startDate: string, endDate: string, api: "historical" | "forecast" = "historical"): string {
  const host = api === "historical" ? "https://historical-forecast-api.open-meteo.com" : "https://api.open-meteo.com";
  const params = [
    `latitude=${lat.toFixed(4)}`,
    `longitude=${lon.toFixed(4)}`,
    `start_date=${startDate}`,
    `end_date=${endDate}`,
    `hourly=${HOURLY.join(",")}`,
    "wind_speed_unit=ms",
    "timezone=auto",
    "timeformat=unixtime",
  ];
  return `${host}/v1/forecast?${params.join("&")}`;
}

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** Hourly weather for whole local days startDate..endDate (YYYY-MM-DD). Missing hours are left out. */
export async function fetchHistory(lat: number, lon: number, startDate: string, endDate: string, fetchFn: Fetch = fetch): Promise<Forecast> {
  const get = async (api: "historical" | "forecast") => {
    const res = await fetchFn(historyUrl(lat, lon, startDate, endDate, api));
    if (!res.ok) throw new Error(`Open-Meteo ${api} ${res.status}`);
    return parseOpenMeteo((await res.json()) as OpenMeteoResponse, new Date());
  };

  const archived = await get("historical");
  const expected = (Date.parse(endDate) - Date.parse(startDate)) / 3_600_000 + 24;
  if (archived.hours.length >= expected) return archived;

  // Fill the gaps (usually the most recent days) from the forecast API.
  const recent = await get("forecast").catch(() => null);
  if (!recent) return archived;
  const byTime = new Map(recent.hours.map((h) => [h.time.getTime(), h]));
  for (const h of archived.hours) byTime.set(h.time.getTime(), h);
  return { ...archived, hours: [...byTime.values()].sort((a, b) => a.time.getTime() - b.time.getTime()) };
}

/** UTC offset of a time zone at an instant, in seconds (−14400 for EDT). */
export function utcOffsetSeconds(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 1000);
}

/** "2026-07-15" + "16:30" on the wall clock in `timeZone` → the instant. */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes so a time near a DST change lands on the right offset.
  let guess = wall - utcOffsetSeconds(timeZone, new Date(wall)) * 1000;
  guess = wall - utcOffsetSeconds(timeZone, new Date(guess)) * 1000;
  return new Date(guess);
}

/** Groups items by place (to 2 decimals, about 1 km) so each place is one download. */
export function groupByPlace<T extends { lat: number; lon: number; date: string }>(items: T[]) {
  const groups = new Map<string, { lat: number; lon: number; startDate: string; endDate: string; items: T[] }>();
  for (const item of items) {
    const key = `${item.lat.toFixed(2)},${item.lon.toFixed(2)}`;
    const g = groups.get(key) ?? { lat: item.lat, lon: item.lon, startDate: item.date, endDate: item.date, items: [] };
    if (item.date < g.startDate) g.startDate = item.date;
    if (item.date > g.endDate) g.endDate = item.date;
    g.items.push(item);
    groups.set(key, g);
  }
  return [...groups.values()];
}
