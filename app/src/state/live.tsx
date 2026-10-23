import {
  bandForWbgtF,
  planActivity,
  riskRank,
  sessionStats,
  type ActivityId,
  type ActivityPlan,
  type HourRisk,
  LIGHTNING_WAIT_MINUTES,
} from "@afuera/engine";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { guidanceKey, guidanceText, useCurrentRisk, useLevelName } from "@/lib/heat";
import { cancelAlert, cancelAlerts, prepareNotifications, scheduleAlert } from "@/lib/notifications";
import { checkinsFor } from "@/lib/profile";
import { startedInMovedWindow, type SessionSummary } from "@/lib/summary";
import { useSettings } from "./settings";
import { useWeather } from "./weather";

export interface LiveSession {
  /** Device clock when the activity started; timers count from here. */
  startedAtMs: number;
  /** Forecast time at the start (the demo day's clock in demo mode). */
  forecastStart: Date;
  hour: HourRisk;
  plan: ActivityPlan;
  /** Hours during the activity where heat climbs past the starting level. */
  rises: HourRisk[];
  /** Schedule items marked done, by index. */
  done: number[];
  /** Device clock of the last logged water break. */
  lastBreakMs: number;
  /** Every tap on "Log water break", for the summary. */
  breaksLogged: number;
  /** Activity and place at the start, so changing settings mid-session doesn't change the summary. */
  activity: ActivityId;
  placeName: string;
  moved: boolean;
  notificationsOn: boolean;
  /** Device clock of the last "Heard thunder" tap; null when no lightning wait is running. */
  thunderAtMs: number | null;
}

interface LiveContext {
  session: LiveSession | null;
  /** Shown on the Live tab after End, until dismissed or a new session starts. */
  summary: SessionSummary | null;
  start: () => Promise<void>;
  end: () => void;
  dismissSummary: () => void;
  logWaterBreak: () => void;
  /** Starts (or restarts) the 30-minute lightning wait. */
  heardThunder: () => void;
  /** Closes the lightning card once the wait is over. */
  clearThunder: () => void;
}

const Context = createContext<LiveContext | null>(null);

/** The running activity lives above the tabs, so it keeps going while you look at Today. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { risks, now } = useWeather();
  const { hour } = useCurrentRisk();
  const levelName = useLevelName();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const thunderAlert = useRef<string | null>(null);
  const lang = settings.language;

  const start = async () => {
    if (!hour?.level || hour.wbgtF === null) return;
    const plan = planActivity(checkinsFor(settings, hour.level), bandForWbgtF(hour.wbgtF), now, settings.durationMinutes);
    const end = now.getTime() + plan.minutes * 60_000;
    let worst = riskRank(hour.level);
    const rises: HourRisk[] = [];
    for (const r of risks) {
      if (r.time <= now || r.time.getTime() >= end || !r.level) continue;
      if (riskRank(r.level) > worst) {
        worst = riskRank(r.level);
        rises.push(r);
      }
    }
    const startedAtMs = Date.now();
    setSummary(null);
    setSession({
      startedAtMs,
      forecastStart: now,
      hour,
      plan,
      rises,
      done: [],
      lastBreakMs: startedAtMs,
      breaksLogged: 0,
      activity: settings.activity,
      placeName: settings.place?.name ?? "",
      moved: startedInMovedWindow(settings.movedTo, now),
      notificationsOn: true,
      thunderAtMs: null,
    });
    if (plan.cancelled) return;

    // Lock-screen alerts for every check-in, every heat increase, and the end.
    try {
      const allowed = await prepareNotifications(t("live.notifChannel"));
      if (!allowed) {
        setSession((s) => s && { ...s, notificationsOn: false });
        return;
      }
      const offset = (d: Date) => (d.getTime() - now.getTime()) / 1000;
      for (const item of plan.schedule) {
        if (offset(item.at) > 0) await scheduleAlert(item.checkin.title[lang], item.checkin.detail[lang], offset(item.at));
      }
      for (const r of rises) {
        const g = guidanceKey(r);
        await scheduleAlert(t("live.notifLevelUpTitle"), t("notifications.levelUp", { level: levelName(r.level), guidance: g ? guidanceText(t, g, settings.activity) : "" }), offset(r.time));
      }
      await scheduleAlert(t("live.title"), t("live.ended"), plan.minutes * 60);
    } catch (err) {
      console.warn("couldn't schedule check-ins", err);
    }
  };

  const end = () => {
    cancelAlerts();
    thunderAlert.current = null;
    if (session) {
      const stats = sessionStats(risks, session.plan, session.forecastStart, session.hour, (Date.now() - session.startedAtMs) / 60_000);
      setSummary({
        start: session.forecastStart,
        end: new Date(session.forecastStart.getTime() + stats.minutes * 60_000),
        minutes: stats.minutes,
        activity: session.activity,
        place: session.placeName,
        highest: stats.highest,
        breaksDue: stats.breaksDue,
        breaksLogged: session.breaksLogged,
        moved: session.moved,
        cancelled: session.plan.cancelled,
      });
    }
    setSession(null);
  };

  /** Marks the next due (or upcoming) water break done and restarts the break clock. */
  const logWaterBreak = () =>
    setSession((s) => {
      if (!s) return s;
      const elapsed = Date.now() - s.startedAtMs;
      const idx = s.plan.schedule.findIndex(
        (item, i) => item.checkin.id === "water-break" && !s.done.includes(i) && item.at.getTime() - s.forecastStart.getTime() <= elapsed + 5 * 60_000,
      );
      return { ...s, done: idx >= 0 ? [...s.done, idx] : s.done, lastBreakMs: Date.now(), breaksLogged: s.breaksLogged + 1 };
    });

  const dismissSummary = () => setSummary(null);

  /** Each tap restarts the 30 minutes and moves the "all clear" alert to the new end. */
  const heardThunder = async () => {
    if (!session) return;
    setSession((s) => s && { ...s, thunderAtMs: Date.now() });
    if (thunderAlert.current) await cancelAlert(thunderAlert.current).catch(() => {});
    thunderAlert.current = null;
    if (!session.notificationsOn || Platform.OS === "web") return;
    try {
      thunderAlert.current = await scheduleAlert(t("lightning.doneTitle"), t("lightning.doneBody"), LIGHTNING_WAIT_MINUTES * 60);
    } catch (err) {
      console.warn("couldn't schedule the lightning alert", err);
    }
  };

  const clearThunder = () => {
    if (thunderAlert.current) cancelAlert(thunderAlert.current).catch(() => {});
    thunderAlert.current = null;
    setSession((s) => s && { ...s, thunderAtMs: null });
  };

  return <Context.Provider value={{ session, summary, start, end, dismissSummary, logWaterBreak, heardThunder, clearThunder }}>{children}</Context.Provider>;
}

export function useLive(): LiveContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useLive must be inside LiveProvider");
  return ctx;
}
