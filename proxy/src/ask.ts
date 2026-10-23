import Anthropic from "@anthropic-ai/sdk";
import {
  ACTIVITIES,
  getCheckins,
  ROLES,
  maxRisk,
  mergeAiCheckins,
  riskRank,
  type ActivityId,
  type Checkin,
  type RiskLevel,
  type Role,
} from "@afuera/engine";
import { riskAt, runTool, TOOLS, type AskContext, type FinalAnswer, type Language } from "./tools";

export const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 6;

export interface AskRequest {
  question: string;
  language: Language;
  place: { lat: number; lon: number };
  activity: ActivityId;
  durationMinutes: number;
  demo: boolean;
  history: { role: "user" | "assistant"; text: string }[];
  /** Who's asking; a participant is a kid or teen. Missing means organizer. */
  role?: Role;
  /** The person's own name for the activity, from "What are you running?" (40 characters max). */
  activityName?: string | null;
}

export type BasicReason = "ai_unavailable" | "rate_limited" | "budget" | "understated" | "no_answer";

export interface AskResponse {
  /** "basic" means no AI text: the app writes the answer from the numbers. */
  mode: "ai" | "basic";
  reason?: BasicReason;
  answer: string | null;
  /** max(physics, ai). This is the level the app shows. */
  level: RiskLevel | null;
  physicsLevel: RiskLevel | null;
  aiLevel: RiskLevel | null;
  /** The hour the answer is about (ISO), and its WBGT. */
  aboutTime: string;
  wbgtF: number | null;
  stopOutdoor: boolean;
  checkins: Checkin[];
}

export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Validates the JSON body. Returns an error message, or the cleaned request. */
export function parseAskRequest(body: unknown): AskRequest | string {
  if (typeof body !== "object" || body === null) return "Body must be a JSON object.";
  const b = body as Record<string, unknown>;
  const place = b.place as Record<string, unknown> | undefined;
  if (typeof b.question !== "string" || !b.question.trim()) return "question is required.";
  if (b.question.length > 1000) return "question is too long (1000 characters max).";
  if (b.language !== "en" && b.language !== "es") return "language must be en or es.";
  if (!ACTIVITIES.includes(b.activity as ActivityId)) return `activity must be one of ${ACTIVITIES.join(", ")}.`;
  if (!place || !isCoord(place.lat, 90) || !isCoord(place.lon, 180)) return "place.lat and place.lon are required.";
  const duration = typeof b.durationMinutes === "number" ? Math.round(b.durationMinutes) : NaN;
  if (!(duration >= 15 && duration <= 600)) return "durationMinutes must be 15–600.";
  const history = Array.isArray(b.history) ? b.history : [];
  return {
    question: b.question.trim(),
    language: b.language,
    place: { lat: place.lat as number, lon: place.lon as number },
    activity: b.activity as ActivityId,
    durationMinutes: duration,
    demo: b.demo === true,
    history: history
      .filter((m): m is { role: "user" | "assistant"; text: string } =>
        (m?.role === "user" || m?.role === "assistant") && typeof m?.text === "string",
      )
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) })),
    role: ROLES.includes(b.role as Role) ? (b.role as Role) : "organizer",
    activityName: typeof b.activityName === "string" ? b.activityName.replace(/[^\p{L}\p{N} ·,.'&()/-]/gu, "").trim().slice(0, 40) || null : null,
  };
}

function isCoord(v: unknown, limit: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit;
}

/** The physics-only answer, used whenever the AI can't be (or shouldn't be) trusted. */
export function basicResponse(ctx: AskContext, reason: BasicReason, aboutTime: Date = ctx.now): AskResponse {
  const r = riskAt(ctx, aboutTime) ?? riskAt(ctx, ctx.now);
  const level = r?.level ?? null;
  return {
    mode: "basic",
    reason,
    answer: null,
    level,
    physicsLevel: level,
    aiLevel: null,
    aboutTime: (r?.time ?? ctx.now).toISOString(),
    wbgtF: r?.wbgtF ?? null,
    stopOutdoor: r?.stopOutdoor ?? false,
    checkins: level ? getCheckins(ctx.activity, level) : [],
  };
}

// Level is max(physics, AI). If the AI went lower, its text is dropped for the physics-only answer.
export async function askClaude(
  req: AskRequest,
  ctx: AskContext,
  client: Anthropic,
  systemPrompt: string,
): Promise<{ response: AskResponse; usage: Usage[] }> {
  const usage: Usage[] = [];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...req.history.map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: req.question },
    {
      role: "system",
      content: `App settings: language ${req.language === "es" ? "Spanish" : "English"}; role ${req.role ?? "organizer"}; activity "${req.activity}"${req.activityName ? ` (they call it "${req.activityName}")` : ""}; planned length ${req.durationMinutes} minutes; current time ${ctx.now.toISOString()} (time zone ${ctx.forecast.timezone}).`,
    },
  ];

  let final: FinalAnswer | null = null;
  for (let round = 0; round < MAX_TOOL_ROUNDS && !final; round++) {
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });
    usage.push({ model: msg.model, ...msg.usage });

    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") break;
    messages.push({ role: "assistant", content: msg.content });

    const calls = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (calls.length === 0) break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = calls.map((call) => {
      const input = (call.input ?? {}) as Record<string, unknown>;
      if (call.name === "final_answer") {
        final = input as unknown as FinalAnswer;
        return { type: "tool_result", tool_use_id: call.id, content: "Sent." };
      }
      return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(runTool(call.name, input, ctx)) };
    });
    messages.push({ role: "user", content: results });
  }

  return { response: applySafetyRule(ctx, final), usage };
}

export function applySafetyRule(ctx: AskContext, final: FinalAnswer | null): AskResponse {
  if (!final || typeof final.answer !== "string" || !final.answer.trim()) return basicResponse(ctx, "no_answer");

  const requested = final.about_time ? new Date(final.about_time) : ctx.now;
  const aboutTime = Number.isNaN(requested.getTime()) ? ctx.now : requested;
  const physics = riskAt(ctx, aboutTime) ?? riskAt(ctx, ctx.now);
  const physicsLevel = physics?.level ?? null;
  const aiLevel = final.level;

  if (physicsLevel && riskRank(aiLevel) < riskRank(physicsLevel)) return basicResponse(ctx, "understated", aboutTime);

  const level = physicsLevel ? maxRisk(physicsLevel, aiLevel) : aiLevel;
  const checkins = mergeAiCheckins(
    getCheckins(ctx.activity, level),
    (final.extra_checkins ?? []).map((c) => ({
      id: c.id,
      everyMinutes: c.every_minutes,
      required: c.required,
      title: c.title,
      detail: c.detail,
    })),
  );
  return {
    mode: "ai",
    answer: final.answer.trim(),
    level,
    physicsLevel,
    aiLevel,
    aboutTime: (physics?.time ?? aboutTime).toISOString(),
    wbgtF: physics?.wbgtF ?? null,
    stopOutdoor: physics?.stopOutdoor ?? false,
    checkins,
  };
}

// USD per million tokens: [input, output]. Fallback models can cost more than
// Opus 5.5, so anything unlisted is billed at the higher Opus 5 price.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
};
const DEFAULT_PRICE: [number, number] = [5, 25];

export function costUsd(usage: Usage[]): number {
  return usage.reduce((sum, u) => {
    const [inP, outP] = PRICES[u.model] ?? DEFAULT_PRICE;
    const input =
      u.input_tokens * inP +
      (u.cache_creation_input_tokens ?? 0) * inP * 1.25 +
      (u.cache_read_input_tokens ?? 0) * inP * 0.1;
    return sum + (input + u.output_tokens * outP) / 1e6;
  }, 0);
}
