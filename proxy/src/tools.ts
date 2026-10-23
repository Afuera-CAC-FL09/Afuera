import type Anthropic from "@anthropic-ai/sdk";
import {
  activityTemplate,
  bandForWbgtF,
  cToF,
  currentHourIndex,
  findBestWindows,
  getCheckins,
  planActivity,
  RISK_LEVELS,
  STALE_AFTER_MINUTES,
  type ActivityId,
  type Forecast,
  type HourRisk,
  type RiskLevel,
  type WeatherAlert,
} from "@afuera/engine";

export type Language = "en" | "es";

/** Everything the tools can see. Built once per request on the server. */
export interface AskContext {
  forecast: Forecast;
  risks: HourRisk[];
  alerts: WeatherAlert[];
  now: Date;
  activity: ActivityId;
  durationMinutes: number;
  language: Language;
}

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_risk",
    description:
      "Heat level and WBGT (°F) from Afuera's physics model for one hour, plus that hour's air temperature, humidity and rain/storm chance. Defaults to right now. Use `hours` to get a run of consecutive hours starting at `time` (for example the length of a practice).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        time: { type: ["string", "null"], description: "ISO 8601 time to check, or null for now." },
        hours: { type: ["integer", "null"], description: "How many consecutive hours to return, 1–24. Null means 1." },
      },
      required: ["time", "hours"],
      additionalProperties: false,
    },
  },
  {
    name: "find_best_window",
    description:
      "Finds the lowest-risk time in the next few days for an activity of the given length, between 6 AM and 9 PM local time, skipping thunderstorms and hours with a high rain chance. Returns the best overall and the best for each day.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        duration_minutes: { type: ["integer", "null"], description: "Activity length. Null uses the length the person set in the app." },
        days: { type: ["integer", "null"], description: "How many days ahead to search, 1–5. Null means 5." },
      },
      required: ["duration_minutes", "days"],
      additionalProperties: false,
    },
  },
  {
    name: "get_checkins",
    description:
      "The check-ins (water breaks, heat re-checks, cooling zone, head counts...) for this person's kind of activity at a heat level, the FHSAA time limit, and when each check-in falls during the activity.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        // anyOf, not type: ["string", "null"] with an enum: the API rejects that combination.
        level: {
          anyOf: [{ type: "string", enum: [...RISK_LEVELS] }, { type: "null" }],
          description: "Heat level. Null uses the level right now.",
        },
      },
      required: ["level"],
      additionalProperties: false,
    },
  },
  {
    name: "get_alerts",
    description: "Active National Weather Service alerts (heat, thunderstorms, tornadoes, floods...) for the person's location.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "final_answer",
    description: "Send your answer to the person. Call this exactly once, as your last step.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        answer: { type: "string", description: "The message shown to the person." },
        level: { type: "string", enum: [...RISK_LEVELS], description: "The heat level your answer is based on." },
        about_time: { type: ["string", "null"], description: "ISO 8601 start of the time the answer is about, or null for now." },
        extra_checkins: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Existing check-in id to tighten, or a new short id." },
              every_minutes: { type: "integer", description: "How often. 0 means once at the start." },
              required: { type: "boolean" },
              title: { type: "string", description: "Short title in the person's language (needed for new check-ins)." },
              detail: { type: "string", description: "One sentence in the person's language." },
            },
            required: ["id", "every_minutes", "required", "title", "detail"],
            additionalProperties: false,
          },
        },
      },
      required: ["answer", "level", "about_time", "extra_checkins"],
      additionalProperties: false,
    },
  },
];

export interface FinalAnswer {
  answer: string;
  level: RiskLevel;
  about_time: string | null;
  extra_checkins: { id: string; every_minutes: number; required: boolean; title: string; detail: string }[];
}

/** Runs one data tool. Returns JSON for the model. Never throws on bad input. */
export function runTool(name: string, input: Record<string, unknown>, ctx: AskContext): unknown {
  switch (name) {
    case "get_risk":
      return getRisk(ctx, parseTime(input.time), clampInt(input.hours, 1, 24, 1));
    case "find_best_window":
      return bestWindow(ctx, clampInt(input.duration_minutes, 15, 600, ctx.durationMinutes), clampInt(input.days, 1, 5, 5));
    case "get_checkins": {
      const level = RISK_LEVELS.includes(input.level as RiskLevel) ? (input.level as RiskLevel) : riskAt(ctx, ctx.now)?.level;
      return level ? checkinsFor(ctx, level) : { error: "No forecast for right now." };
    }
    case "get_alerts":
      return ctx.alerts.map((a) => ({
        event: a.event,
        kind: a.kind,
        headline: a.headline,
        severity: a.severity,
        until: a.ends ? localTime(ctx, a.ends) : null,
        instruction: a.instruction,
      }));
    default:
      return { error: `Unknown tool ${name}` };
  }
}

/** The forecast hour covering `time`, or null if it's outside the forecast. */
export function riskAt(ctx: AskContext, time: Date): HourRisk | null {
  const i = currentHourIndex(ctx.risks, time);
  if (i < 0 || time.getTime() - ctx.risks[i].time.getTime() >= 3_600_000) return null;
  return ctx.risks[i];
}

function getRisk(ctx: AskContext, time: Date | null, hours: number) {
  const start = time ?? ctx.now;
  const dataAgeMinutes = (ctx.now.getTime() - ctx.forecast.fetchedAt.getTime()) / 60000;
  const out = [];
  for (let h = 0; h < hours; h++) {
    const r = riskAt(ctx, new Date(start.getTime() + h * 3_600_000));
    if (!r) break;
    const band = r.wbgtF === null ? null : bandForWbgtF(r.wbgtF);
    const weather = ctx.forecast.hours[currentHourIndex(ctx.forecast.hours, r.time)];
    out.push({
      time: r.time.toISOString(),
      local_time: localTime(ctx, r.time),
      level: r.level ?? "unknown (model could not compute; use a WBGT meter)",
      wbgt_f: r.wbgtF,
      air_temp_f: weather ? Math.round(cToF(weather.tempC) * 10) / 10 : null,
      humidity_percent: weather ? Math.round(weather.rh) : null,
      no_outdoor_activity: r.stopOutdoor,
      max_activity_minutes: band?.maxActivityMinutes ?? null,
      rest_breaks_per_hour: band?.restBreaksPerHour ?? null,
      rain_chance_percent: r.precipChance,
      thunderstorm: r.thunder,
    });
  }
  if (out.length === 0) return { error: "That time is outside the 5-day forecast." };
  return { stale: dataAgeMinutes > STALE_AFTER_MINUTES, data_age_minutes: Math.round(dataAgeMinutes), hours: out };
}

function bestWindow(ctx: AskContext, durationMinutes: number, days: number) {
  const { best, byDay } = findBestWindows(ctx.risks, {
    durationMinutes,
    from: ctx.now,
    days,
    utcOffsetSeconds: ctx.forecast.utcOffsetSeconds,
  });
  const show = (w: NonNullable<typeof best>) => ({
    start: w.start.toISOString(),
    local: `${localTime(ctx, w.start)} – ${localTime(ctx, w.end, { timeOnly: true })}`,
    level: w.level,
    peak_wbgt_f: w.peakWbgtF,
    max_rain_chance_percent: w.maxPrecipChance,
  });
  return {
    duration_minutes: durationMinutes,
    best: best ? show(best) : null,
    best_each_day: byDay.map(show),
    note: best ? undefined : "No usable time: every window had storms, too much rain chance, or heat above 92 °F WBGT.",
  };
}

function checkinsFor(ctx: AskContext, level: RiskLevel) {
  const lang = ctx.language;
  const checkins = getCheckins(ctx.activity, level);
  // Representative band for the level (the lowest WBGT in it), for the time limit.
  const band = bandForWbgtF({ lower: 70, elevated: 82, high: 87.1, extreme: 90.1 }[level]);
  const plan = planActivity(checkins, band, ctx.now, ctx.durationMinutes);
  return {
    activity: activityTemplate(ctx.activity).name[lang],
    level,
    max_activity_minutes: band.maxActivityMinutes,
    note: level === "extreme" ? "At 92.1 °F WBGT and above there is no outdoor activity at all." : undefined,
    checkins: checkins.map((c) => ({
      id: c.id,
      required: c.required,
      every_minutes: c.everyMinutes,
      title: c.title[lang],
      detail: c.detail[lang],
    })),
    planned_minutes: plan.minutes,
  };
}

export function localTime(ctx: AskContext, time: Date, { timeOnly = false } = {}): string {
  const locale = ctx.language === "es" ? "es-US" : "en-US";
  return time.toLocaleString(locale, {
    timeZone: ctx.forecast.timezone,
    ...(timeOnly ? {} : { weekday: "short", month: "short", day: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

export function parseTime(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? null : t;
}

function clampInt(value: unknown, lo: number, hi: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(value)));
}
