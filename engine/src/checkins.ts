import type { HeatBand, RiskLevel } from "./risk";
import templates from "./templates.json";

export type ActivityId = "band" | "team" | "camp" | "event";
export const ACTIVITIES: readonly ActivityId[] = ["band", "team", "camp", "event"];

export interface Localized {
  en: string;
  es: string;
}

/** A check-in as written in ai/templates/*.yaml. */
export interface CheckinRule {
  id: string;
  required: boolean;
  /** Per level; missing means not used at that level, 0 means once at the start. */
  everyMinutes: Partial<Record<RiskLevel, number>>;
  title: Localized;
  detail: Localized;
}

/** A check-in resolved for one heat level. */
export interface Checkin {
  id: string;
  required: boolean;
  /** 0 means once, at the start. */
  everyMinutes: number;
  title: Localized;
  detail: Localized;
  source: "template" | "ai";
}

/** What the AI may send back. Text is in the user's language, so it fills both slots. */
export interface ProposedCheckin {
  id: string;
  everyMinutes: number;
  required?: boolean;
  title?: string;
  detail?: string;
}

interface ActivityTemplate {
  id: ActivityId;
  name: Localized;
  defaultMinutes: number;
  checkins: CheckinRule[];
}

const TEMPLATES = templates as Record<ActivityId, ActivityTemplate>;

/** No check-in, from a template or the AI, can repeat more often than this. */
export const MIN_INTERVAL_MINUTES = 5;

export function activityTemplate(activity: ActivityId): ActivityTemplate {
  return TEMPLATES[activity];
}

export function getCheckins(activity: ActivityId, level: RiskLevel): Checkin[] {
  return TEMPLATES[activity].checkins
    .filter((rule) => rule.everyMinutes[level] !== undefined)
    .map((rule) => ({
      id: rule.id,
      required: rule.required,
      everyMinutes: rule.everyMinutes[level]!,
      title: rule.title,
      detail: rule.detail,
      source: "template" as const,
    }));
}

// The AI can add or tighten check-ins, never remove or loosen them.
export function mergeAiCheckins(base: Checkin[], proposed: ProposedCheckin[]): Checkin[] {
  const merged = new Map(base.map((c) => [c.id, { ...c }]));
  for (const p of proposed) {
    if (!Number.isFinite(p.everyMinutes) || p.everyMinutes < 0) continue;
    const every = p.everyMinutes === 0 ? 0 : Math.max(MIN_INTERVAL_MINUTES, Math.round(p.everyMinutes));
    const existing = merged.get(p.id);
    if (existing) {
      existing.everyMinutes = moreFrequent(existing.everyMinutes, every);
      existing.required = existing.required || p.required === true;
    } else if (p.title) {
      const title = { en: p.title, es: p.title };
      const detail = { en: p.detail ?? "", es: p.detail ?? "" };
      merged.set(p.id, { id: p.id, required: p.required === true, everyMinutes: every, title, detail, source: "ai" });
    }
  }
  return [...merged.values()];
}

/** 0 (once at start) is a different kind of check-in, so a repeating one never becomes one-time. */
function moreFrequent(current: number, proposed: number): number {
  if (current === 0) return proposed;
  if (proposed === 0) return current;
  return Math.min(current, proposed);
}

export interface ScheduledCheckin {
  at: Date;
  checkin: Checkin;
}

export interface ActivityPlan {
  /** Minutes the activity can actually run, after the FHSAA time cap. */
  minutes: number;
  /** True when the requested length was cut down to the FHSAA limit. */
  capped: boolean;
  /** WBGT is in the "no outdoor activities" band. */
  cancelled: boolean;
  schedule: ScheduledCheckin[];
}

export function planActivity(
  checkins: Checkin[],
  band: HeatBand,
  start: Date,
  requestedMinutes: number,
): ActivityPlan {
  if (band.stopOutdoor) return { minutes: 0, capped: true, cancelled: true, schedule: [] };

  const limit = band.maxActivityMinutes ?? Infinity;
  const minutes = Math.min(requestedMinutes, limit);
  const schedule: ScheduledCheckin[] = [];
  for (const checkin of checkins) {
    if (checkin.everyMinutes === 0) {
      schedule.push({ at: start, checkin });
      continue;
    }
    for (let m = checkin.everyMinutes; m < minutes; m += checkin.everyMinutes) {
      schedule.push({ at: new Date(start.getTime() + m * 60_000), checkin });
    }
  }
  schedule.sort((a, b) => a.at.getTime() - b.at.getTime() || Number(b.checkin.required) - Number(a.checkin.required));
  return { minutes, capped: minutes < requestedMinutes, cancelled: false, schedule };
}
