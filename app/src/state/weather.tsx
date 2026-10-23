import {
  demoClock,
  hourlyRisk,
  nwsAlertsUrl,
  nwsHeaders,
  openMeteoUrl,
  parseNwsAlerts,
  parseOpenMeteo,
  type Forecast,
  type HourRisk,
  type OpenMeteoResponse,
  type WeatherAlert,
} from "@afuera/engine";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import demo from "../../../data/demo/kissimmee-2026-07-15.json";
import { useSettings, type Place } from "./settings";

type NwsJson = Parameters<typeof parseNwsAlerts>[0];

interface Cached {
  weather: OpenMeteoResponse;
  alerts: NwsJson;
  fetchedAt: string;
}

interface WeatherContext {
  forecast: Forecast | null;
  risks: HourRisk[];
  alerts: WeatherAlert[];
  /** The current time; in demo mode, the saved demo day moving forward from 1 PM. */
  now: Date;
  status: "loading" | "ready" | "error";
  /** The last refresh failed, so the forecast on screen is the saved one. */
  offline: boolean;
  refresh: () => Promise<void>;
}

const Context = createContext<WeatherContext | null>(null);
const REFRESH_AFTER_MS = 30 * 60_000;
const nwsContact: string = Constants.expoConfig?.extra?.nwsContact ?? "Afuera app";

const cacheKey = (p: Place) => `afuera.weather.${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

async function download(place: Place): Promise<Cached> {
  const [weather, alerts] = await Promise.all([
    fetch(openMeteoUrl(place.lat, place.lon)).then((r) => {
      if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
      return r.json() as Promise<OpenMeteoResponse>;
    }),
    // Alerts are extra: if NWS is down, still show the heat level.
    fetch(nwsAlertsUrl(place.lat, place.lon), { headers: nwsHeaders(nwsContact) })
      .then((r) => (r.ok ? (r.json() as Promise<NwsJson>) : { features: [] }))
      .catch(() => ({ features: [] })),
  ]);
  return { weather, alerts, fetchedAt: new Date().toISOString() };
}

export function WeatherProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const place = settings.place;
  const key = place ? cacheKey(place) : null;
  // Results are tagged with the place they're for, so switching places shows "loading", not the old town.
  const [live, setLive] = useState<{ key: string; data: Cached | null; failed: boolean } | null>(null);
  const [tick, setTick] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    if (!place || !key || settings.demo) return;
    try {
      const fresh = await download(place);
      setLive({ key, data: fresh, failed: false });
      await AsyncStorage.setItem(key, JSON.stringify(fresh));
    } catch (err) {
      console.warn("forecast refresh failed", err);
      setLive((prev) => ({ key, data: prev?.key === key ? prev.data : null, failed: true }));
    }
  }, [place, key, settings.demo]);

  // Show the saved forecast at once (Today has to load in under a second), then refresh.
  useEffect(() => {
    if (settings.demo || !key) return;
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!cancelled && raw) setLive((prev) => (prev?.key === key && prev.data ? prev : { key, data: JSON.parse(raw), failed: false }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) refresh();
      });
    return () => {
      cancelled = true;
    };
  }, [key, settings.demo, refresh]);

  const data: Cached | null = settings.demo ? DEMO : live?.key === key ? live.data : null;
  const failed = !settings.demo && live?.key === key && live.failed;
  const status: WeatherContext["status"] = data ? "ready" : failed ? "error" : "loading";

  // Keep "now" moving, and refresh when the app comes back after a while.
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setTick(Date.now());
      if (data && Date.now() - Date.parse(data.fetchedAt) > REFRESH_AFTER_MS) refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [data, refresh]);

  // The WBGT model runs once per download, not on every clock tick.
  const parsed = useMemo(() => {
    if (!data) return null;
    const forecast = parseOpenMeteo(data.weather, new Date(data.fetchedAt));
    return { forecast, risks: hourlyRisk(forecast), alerts: parseNwsAlerts(data.alerts) };
  }, [data]);

  const value = useMemo<WeatherContext>(() => {
    const now = settings.demo ? demoNow(tick, settings.demoStartedAt) : new Date(tick);
    return {
      forecast: parsed?.forecast ?? null,
      risks: parsed?.risks ?? [],
      alerts: (parsed?.alerts ?? []).filter((a) => !a.ends || a.ends > now),
      now,
      status,
      offline: failed && !!data,
      refresh,
    };
  }, [parsed, tick, settings.demo, settings.demoStartedAt, status, failed, data, refresh]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

const DEMO: Cached = { weather: demo.forecast as unknown as OpenMeteoResponse, alerts: { features: [] }, fetchedAt: demo.demoNow };

/** Demo time starts at 1 PM on the saved day when demo mode is turned on, and loops every 4 hours. */
function demoNow(tick: number, startedAt: number): Date {
  return demoClock(new Date(demo.demoNow), tick, startedAt);
}

export function useWeather(): WeatherContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useWeather must be inside WeatherProvider");
  return ctx;
}
