import { cToF } from "./wbgt";

// FHSAA Policy 41.8.3, 2025-26 Handbook p. 107. The top two rows are both Extreme; stopOutdoor tells them apart.

export type RiskLevel = "lower" | "elevated" | "high" | "extreme";

export const RISK_LEVELS: readonly RiskLevel[] = ["lower", "elevated", "high", "extreme"];

export interface HeatBand {
  level: RiskLevel;
  /** Highest WBGT (°F, one decimal) in this band. */
  maxF: number;
  /** null means FHSAA sets no limit. 0 means no outdoor activity. */
  maxActivityMinutes: number | null;
  restBreaksPerHour: number;
  restBreakMinutes: number;
  stopOutdoor: boolean;
}

export const HEAT_BANDS: readonly HeatBand[] = [
  { level: "lower", maxF: 81.9, maxActivityMinutes: null, restBreaksPerHour: 0, restBreakMinutes: 0, stopOutdoor: false },
  { level: "elevated", maxF: 87.0, maxActivityMinutes: null, restBreaksPerHour: 3, restBreakMinutes: 4, stopOutdoor: false },
  { level: "high", maxF: 90.0, maxActivityMinutes: 120, restBreaksPerHour: 4, restBreakMinutes: 4, stopOutdoor: false },
  { level: "extreme", maxF: 92.0, maxActivityMinutes: 60, restBreaksPerHour: 5, restBreakMinutes: 4, stopOutdoor: false },
  { level: "extreme", maxF: Infinity, maxActivityMinutes: 0, restBreaksPerHour: 0, restBreakMinutes: 0, stopOutdoor: true },
];

/** Weather older than this gets a warning banner. */
export const STALE_AFTER_MINUTES = 120;

export interface RiskAssessment {
  level: RiskLevel;
  band: HeatBand;
  /** WBGT in °F, rounded up to one decimal. */
  wbgtF: number;
  /** Minutes between when the weather data was issued and now. */
  dataAgeMinutes: number;
  stale: boolean;
}

// Rounds up to 0.1 °F, so 81.91 counts as 82.0 (Elevated). Gaps in the table go to the higher band.
export function bandForWbgtF(wbgtF: number): HeatBand {
  const rounded = ceilTenth(wbgtF);
  return HEAT_BANDS.find((b) => rounded <= b.maxF)!;
}

export function assessRisk(wbgtC: number, dataTime: Date, now: Date = new Date()): RiskAssessment {
  const wbgtF = ceilTenth(cToF(wbgtC));
  const band = bandForWbgtF(wbgtF);
  const dataAgeMinutes = Math.max(0, (now.getTime() - dataTime.getTime()) / 60000);
  return {
    level: band.level,
    band,
    wbgtF,
    dataAgeMinutes,
    stale: dataAgeMinutes > STALE_AFTER_MINUTES,
  };
}

export function riskRank(level: RiskLevel): number {
  return RISK_LEVELS.indexOf(level);
}

/** The more cautious of two levels. */
export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return riskRank(a) >= riskRank(b) ? a : b;
}

// Float noise: 81.9 * 10 is 818.9999999999999, which must stay 81.9, not 82.0.
function ceilTenth(x: number): number {
  return Math.ceil(Math.round(x * 1e6) / 1e5) / 10;
}
