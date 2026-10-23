import { currentHourIndex, forecastAgeMinutes, isStale, type ActivityWindow, type HourRisk } from "@afuera/engine";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/state/settings";
import { useWeather } from "@/state/weather";

export type GuidanceKey = "lower" | "elevated" | "high" | "extremeLimited" | "extremeStop";

export function guidanceKey(hour: Pick<HourRisk, "level" | "stopOutdoor">): GuidanceKey | null {
  if (!hour.level) return null;
  if (hour.level === "extreme") return hour.stopOutdoor ? "extremeStop" : "extremeLimited";
  return hour.level;
}

/** The forecast hour for right now, plus how old the data is. */
export function useCurrentRisk() {
  const { risks, forecast, now } = useWeather();
  const { settings } = useSettings();
  const index = currentHourIndex(risks, now);
  const hour = index >= 0 ? risks[index] : null;
  const ageMinutes = forecast ? forecastAgeMinutes(forecast.fetchedAt, now) : 0;
  const stale = !!forecast && isStale(forecast.fetchedAt, now, { demo: settings.demo });
  return { hour, index, stale, ageHours: Math.floor(ageMinutes / 60) };
}

/** Formats times in the forecast's time zone, in the app's language. */
export function useTimeFormat() {
  const { forecast } = useWeather();
  const { settings } = useSettings();
  const locale = settings.language === "es" ? "es-US" : "en-US";
  const timeZone = forecast?.timezone;

  const time = (d: Date) => d.toLocaleTimeString(locale, { timeZone, hour: "numeric", minute: "2-digit" });
  const hour = (d: Date) => d.toLocaleTimeString(locale, { timeZone, hour: "numeric" });
  const weekday = (d: Date) => d.toLocaleDateString(locale, { timeZone, weekday: "short" });
  const day = (d: Date) => d.toLocaleDateString(locale, { timeZone, weekday: "long", month: "short", day: "numeric" });
  /** "7:00–9:00 PM": the AM/PM is only written once when both ends share it. */
  const range = (a: Date, b: Date) => compactRange(time(a), time(b));
  const window = (w: ActivityWindow) => `${weekday(w.start)} ${range(w.start, w.end)}`;
  return { time, hour, weekday, day, range, window };
}

export function useLevelName() {
  const { t } = useTranslation();
  return (level: HourRisk["level"]) => (level ? t(`common.levels.${level}`) : t("common.unknown"));
}

/** "7:15 PM" → { clock: "7:15", suffix: "PM" } (and "7:15 p.m." in Spanish). */
export function splitTime(formatted: string): { clock: string; suffix: string } {
  const m = formatted.match(/^(\d{1,2}:\d{2})\s*(.*)$/);
  return m ? { clock: m[1], suffix: m[2] } : { clock: formatted, suffix: "" };
}

export function compactRange(a: string, b: string): string {
  const x = splitTime(a);
  const y = splitTime(b);
  return x.suffix && x.suffix === y.suffix ? `${x.clock}–${y.clock} ${y.suffix}` : `${a}–${b}`;
}

/** FHSAA guidance for a level; the football gear rule only shows for team sports. */
export function guidanceText(tt: (key: string) => string, key: GuidanceKey, activity: string): string {
  const text = tt(`guidance.${key}`);
  return key === "high" && activity === "team" ? `${text} ${tt("guidance.highFootball")}` : text;
}
