/** National Weather Service active alerts (https://www.weather.gov/documentation/services-web-api). */

export function nwsAlertsUrl(lat: number, lon: number): string {
  return `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
}

/** NWS rejects requests without a User-Agent that says who you are. */
export function nwsHeaders(contact: string): Record<string, string> {
  return { "User-Agent": `Afuera heat planner (${contact})`, Accept: "application/geo+json" };
}

export type AlertKind = "heat" | "storm" | "other";

export interface WeatherAlert {
  id: string;
  /** e.g. "Severe Thunderstorm Warning". English; NWS doesn't translate it. */
  event: string;
  kind: AlertKind;
  headline: string;
  severity: string;
  onset: Date | null;
  ends: Date | null;
  description: string;
  instruction: string;
}

interface NwsFeature {
  properties: {
    id: string;
    event: string;
    headline: string | null;
    severity: string;
    onset: string | null;
    ends: string | null;
    expires: string | null;
    description: string | null;
    instruction: string | null;
  };
}

export function parseNwsAlerts(json: { features: NwsFeature[] }): WeatherAlert[] {
  return json.features.map(({ properties: p }) => ({
    id: p.id,
    event: p.event,
    kind: alertKind(p.event),
    headline: p.headline ?? p.event,
    severity: p.severity,
    onset: p.onset ? new Date(p.onset) : null,
    ends: p.ends ? new Date(p.ends) : p.expires ? new Date(p.expires) : null,
    description: p.description ?? "",
    instruction: p.instruction ?? "",
  }));
}

function alertKind(event: string): AlertKind {
  if (/heat/i.test(event)) return "heat";
  if (/thunderstorm|tornado|lightning|hurricane|tropical|storm|flood|wind/i.test(event)) return "storm";
  return "other";
}
