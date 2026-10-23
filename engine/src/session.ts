import type { ActivityPlan } from "./checkins";
import type { HourRisk } from "./forecast";
import { riskRank } from "./risk";

export interface SessionStats {
  /** Minutes the activity actually ran (ending early counts; the FHSAA cap still applies). */
  minutes: number;
  /** Worst forecast hour the activity ran through. */
  highest: HourRisk;
  /** Water breaks that had come due by the end. */
  breaksDue: number;
}

export function sessionStats(risks: HourRisk[], plan: ActivityPlan, start: Date, startHour: HourRisk, elapsedMinutes: number): SessionStats {
  const minutes = Math.max(0, Math.min(Math.floor(elapsedMinutes), plan.minutes));
  const end = start.getTime() + minutes * 60_000;
  let highest = startHour;
  for (const h of risks) {
    if (h.time <= start || h.time.getTime() >= end || !h.level || !highest.level) continue;
    if (riskRank(h.level) > riskRank(highest.level) || (h.level === highest.level && (h.wbgtF ?? 0) > (highest.wbgtF ?? 0))) highest = h;
  }
  const breaksDue = plan.schedule.filter((s) => s.checkin.id === "water-break" && s.at.getTime() > start.getTime() && s.at.getTime() <= end).length;
  return { minutes, highest, breaksDue };
}
