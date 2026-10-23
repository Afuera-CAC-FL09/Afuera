import { assessRisk, type RiskLevel } from "./risk";
import { calcWbgt } from "./wbgt";

/** One hour of weather, in the units the app requests from Open-Meteo. */
export interface WeatherHour {
  /** The hour's timestamp. Temperature, humidity and wind are at this instant;
   *  solar radiation is the mean over the hour before it. */
  time: Date;
  tempC: number;
  /** Relative humidity, %. */
  rh: number;
  /** Wind speed at 10 m, m/s. */
  windSpeed: number;
  /** Surface pressure, hPa. */
  pressure: number;
  /** Shortwave (global horizontal) radiation, W/m². */
  solar: number;
  /** Cloud cover, %. */
  cloudCover: number;
  /** Chance of precipitation, %. */
  precipChance: number;
  /** Weather code says thunderstorm (WMO codes 95–99). */
  thunder: boolean;
}

export interface Forecast {
  lat: number;
  lon: number;
  /** IANA name, e.g. America/New_York. */
  timezone: string;
  utcOffsetSeconds: number;
  /** When the forecast was downloaded. Drives the old-data warning. */
  fetchedAt: Date;
  hours: WeatherHour[];
}

export interface HourRisk {
  time: Date;
  /** null when the WBGT model couldn't converge for this hour's inputs. */
  wbgtF: number | null;
  level: RiskLevel | null;
  stopOutdoor: boolean;
  precipChance: number;
  thunder: boolean;
}

export function hourlyRisk(forecast: Forecast): HourRisk[] {
  return forecast.hours.map((h) => {
    const result = calcWbgt({
      time: h.time,
      avgMinutes: 60,
      lat: forecast.lat,
      lon: forecast.lon,
      solar: h.solar,
      pressure: h.pressure,
      tempC: h.tempC,
      rh: h.rh,
      windSpeed: h.windSpeed,
      windHeight: 10,
    });
    const risk = result && assessRisk(result.wbgt, h.time, h.time);
    return {
      time: h.time,
      wbgtF: risk ? risk.wbgtF : null,
      level: risk ? risk.level : null,
      stopOutdoor: risk ? risk.band.stopOutdoor : false,
      precipChance: h.precipChance,
      thunder: h.thunder,
    };
  });
}

/** The forecast hour that covers `now` (the latest hour at or before it). */
export function currentHourIndex(hours: { time: Date }[], now: Date): number {
  let index = -1;
  for (let i = 0; i < hours.length; i++) {
    if (hours[i].time.getTime() <= now.getTime()) index = i;
    else break;
  }
  return index;
}
