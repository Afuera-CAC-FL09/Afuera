import Anthropic from "@anthropic-ai/sdk";
import { cleanProfile, PROFILE_SCHEMA, PROFILE_TEXT_MAX, ROLES, guessProfile, type ActivityProfile, type Role } from "@afuera/engine";
import { MODEL, type BasicReason, type Usage } from "./ask";
import type { Language } from "./tools";

export interface ProfileRequest {
  text: string;
  role: Role;
  language: Language;
}

export interface ProfileResponse {
  /** "basic" means the profile came from keywords, not the AI. */
  mode: "ai" | "basic";
  reason?: BasicReason;
  profile: ActivityProfile;
}

export function parseProfileRequest(body: unknown): ProfileRequest | string {
  if (typeof body !== "object" || body === null) return "Body must be a JSON object.";
  const b = body as Record<string, unknown>;
  if (typeof b.text !== "string" || !b.text.trim()) return "text is required.";
  if (b.text.length > PROFILE_TEXT_MAX) return `text is too long (${PROFILE_TEXT_MAX} characters max).`;
  if (!ROLES.includes(b.role as Role)) return `role must be one of ${ROLES.join(", ")}.`;
  if (b.language !== "en" && b.language !== "es") return "language must be en or es.";
  return { text: b.text.trim(), role: b.role as Role, language: b.language };
}

export function basicProfile(req: ProfileRequest, reason: BasicReason): ProfileResponse {
  return { mode: "basic", reason, profile: guessProfile(req.text, req.role, req.language) };
}

export async function askProfile(req: ProfileRequest, client: Anthropic, systemPrompt: string): Promise<{ response: ProfileResponse; usage: Usage[] }> {
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: PROFILE_SCHEMA as unknown as Record<string, unknown> } },
    system: systemPrompt,
    messages: [
      { role: "user", content: `<activity>${req.text.replace(/</g, "‹")}</activity>` },
      { role: "system", content: `The person picked the role "${req.role}" and the app language ${req.language === "es" ? "Spanish" : "English"}.` },
    ],
  });
  const usage: Usage[] = [{ model: msg.model, ...msg.usage }];
  if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") return { response: basicProfile(req, "no_answer"), usage };

  const text = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
  let raw: unknown = null;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = null;
  }
  if (raw === null) return { response: basicProfile(req, "no_answer"), usage };
  return { response: { mode: "ai", profile: cleanProfile(raw, req.text, req.role, req.language) }, usage };
}
