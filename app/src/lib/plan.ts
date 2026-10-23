import { findBestWindows, RISK_LEVELS, riskRank, type ActivityWindow, type HourRisk, type RiskLevel } from "@afuera/engine";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useSettings, type Settings } from "@/state/settings";
import { useWeather } from "@/state/weather";
import { useCurrentRisk, useTimeFormat } from "./heat";
import { waterEveryFor } from "./profile";

/** How often the water break comes at this level: the activity's template, tightened by the profile. */
export function waterEvery(settings: Pick<Settings, "activity" | "profile">, level: RiskLevel): number {
  return waterEveryFor(settings, level);
}

const STORMY = (h: HourRisk) => h.thunder || h.precipChance >= 40;

/** A window as route params (they must be strings), so the share card shows exactly the window that was picked. */
export type WindowParams = { start: string; end: string; level: string; peak: string; rain: string };

export function windowParams(w: ActivityWindow): WindowParams {
  return { start: w.start.toISOString(), end: w.end.toISOString(), level: w.level, peak: String(w.peakWbgtF), rain: String(w.maxPrecipChance) };
}

export function parseWindowParams(p: Partial<WindowParams>, localDate: (d: Date) => string): ActivityWindow | null {
  if (!p.start || !p.end || !RISK_LEVELS.includes(p.level as RiskLevel)) return null;
  const start = new Date(p.start);
  const end = new Date(p.end);
  if (Number.isNaN(start.getTime()) || !(end > start)) return null;
  return { start, end, level: p.level as RiskLevel, peakWbgtF: Number(p.peak) || 0, maxPrecipChance: Number(p.rain) || 0, localDate: localDate(start) };
}

/** Everything Today, Better time and Share need, computed once from the forecast. */
export function usePlan() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { risks, forecast, now } = useWeather();
  const { hour, index } = useCurrentRisk();
  const fmt = useTimeFormat();
  const offset = forecast?.utcOffsetSeconds ?? 0;
  const localDate = (d: Date) => new Date(d.getTime() + offset * 1000).toISOString().slice(0, 10);
  const localHour = (d: Date) => new Date(d.getTime() + offset * 1000).getUTCHours();

  const search = findBestWindows(risks, { durationMinutes: settings.durationMinutes, from: now, utcOffsetSeconds: offset });
  const today = localDate(now);
  const bestToday = search.byDay.find((w) => w.localDate === today) ?? null;

  // Only suggest moving if it actually lowers the risk.
  const beats = (w: ActivityWindow | null) => !!w && !!hour?.level && riskRank(w.level) < riskRank(hour.level);
  const better: ActivityWindow | null = beats(bestToday) ? bestToday : beats(search.best) ? search.best : null;

  const upcoming = index >= 0 ? risks.slice(index, index + 6) : [];
  const stormHour = upcoming.reduce<HourRisk | null>((top, h) => (!top || h.precipChance > top.precipChance ? h : top), null);

  /** Why the window is better. Pass `tt` to write it in another language (the share card). */
  const reason = (w: ActivityWindow, tt: TFunction = t, hourLabel: (d: Date) => string = fmt.hour) => {
    const storm = risks.find((h) => h.time >= now && h.time < w.start && STORMY(h));
    const evening = localHour(w.start) >= 16;
    const morning = localHour(w.start) < 11;
    if (storm && evening) return tt("plan.reasonStormsEvening", { time: hourLabel(storm.time) });
    if (storm) return tt("plan.reasonStorms", { time: hourLabel(storm.time) });
    if (evening) return tt("plan.reasonEvening");
    if (morning) return tt("plan.reasonMorning");
    return tt("plan.reasonCooler");
  };

  /** "Today", or the weekday. */
  const dayLabel = (w: ActivityWindow) => (w.localDate === today ? t("better.today") : fmt.weekday(w.start));

  return { hour, search, bestToday, better, stormHour, upcoming, reason, dayLabel, localDate, localHour, today };
}

/** The big instruction on Today: what to do, not just the level. */
export function useHeadline() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  return (hour: HourRisk | null) => {
    if (!hour?.level) return t("today.cantCompute");
    if (hour.stopOutdoor) return t("headline.stop");
    if (hour.level === "lower") return t("headline.lower");
    return t("headline.breaks", { count: waterEvery(settings, hour.level) });
  };
}
