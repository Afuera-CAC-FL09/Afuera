import type { Forecast } from "./forecast";

/** The hourly fields every Afuera request asks for (also used by tools/ for past days). */
export const HOURLY = [
  "temperature_2m",
  "relative_humidity_2m",
  "wind_speed_10m",
  "surface_pressure",
  "shortwave_radiation",
  "cloud_cover",
  "precipitation_probability",
  "weather_code",
] as const;

/** 6 days so the best-time search always has 5 full days ahead. */
export function openMeteoUrl(lat: number, lon: number, days = 6): string {
  // Built by hand: React Native's URLSearchParams is incomplete on some versions.
  const params = [
    `latitude=${lat.toFixed(4)}`,
    `longitude=${lon.toFixed(4)}`,
    `hourly=${HOURLY.join(",")}`,
    "wind_speed_unit=ms",
    "timezone=auto",
    "timeformat=unixtime",
    `forecast_days=${days}`,
    "past_days=1",
  ];
  return `https://api.open-meteo.com/v1/forecast?${params.join("&")}`;
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  utc_offset_seconds: number;
  hourly: Record<(typeof HOURLY)[number], (number | null)[]> & { time: number[] };
}

// Hours with missing values are dropped, not guessed.
export function parseOpenMeteo(json: OpenMeteoResponse, fetchedAt: Date): Forecast {
  const h = json.hourly;
  const hours: Forecast["hours"] = [];
  h.time.forEach((t, i) => {
    const values = HOURLY.map((k) => h[k][i]);
    if (values.some((v) => v === null || v === undefined)) return;
    const [tempC, rh, windSpeed, pressure, solar, cloudCover, precipChance, code] = values as number[];
    hours.push({
      time: new Date(t * 1000),
      tempC,
      rh,
      windSpeed,
      pressure,
      solar,
      cloudCover,
      precipChance,
      thunder: code >= 95,
    });
  });
  return {
    lat: json.latitude,
    lon: json.longitude,
    timezone: json.timezone,
    utcOffsetSeconds: json.utc_offset_seconds,
    fetchedAt,
    hours,
  };
}
