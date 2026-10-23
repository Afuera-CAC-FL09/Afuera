import Anthropic from "@anthropic-ai/sdk";
import {
  hourlyRisk,
  nwsAlertsUrl,
  nwsHeaders,
  openMeteoUrl,
  parseNwsAlerts,
  parseOpenMeteo,
  type OpenMeteoResponse,
} from "@afuera/engine";
import demo from "../../data/demo/kissimmee-2026-07-15.json";
import profilePrompt from "../../ai/prompts/profile.md";
import systemPrompt from "../../ai/prompts/system.md";
import { askClaude, basicResponse, costUsd, parseAskRequest, type AskRequest } from "./ask";
import { askProfile, basicProfile, parseProfileRequest } from "./profile";
import type { Limiter } from "./limiter";
import type { AskContext } from "./tools";

export { Limiter } from "./limiter";

export interface Env {
  ANTHROPIC_API_KEY?: string;
  /** Set with `wrangler secret put NWS_CONTACT` (or in .dev.vars); see the README. */
  NWS_CONTACT?: string;
  LIMITER: DurableObjectNamespace<Limiter>;
  PER_IP_PER_MINUTE: string;
  PER_IP_PER_DAY: string;
  DAILY_BUDGET_USD: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (url.pathname === "/health") return json({ ok: true });
    if (url.pathname === "/profile" && request.method === "POST") return handleProfile(request, env);
    if (url.pathname !== "/ask" || request.method !== "POST") return json({ error: "Not found" }, 404);

    const parsed = parseAskRequest(await request.json().catch(() => null));
    if (typeof parsed === "string") return json({ error: parsed }, 400);

    let ctx: AskContext;
    try {
      ctx = await loadContext(parsed, env);
    } catch (err) {
      console.error("weather fetch failed", err);
      return json({ error: "Couldn't get the forecast. Try again in a minute." }, 502);
    }

    const limiter = env.LIMITER.get(env.LIMITER.idFromName("global"));
    const admission = await limiter.admit(request.headers.get("CF-Connecting-IP") ?? "unknown");
    if (admission !== "ok") return json(basicResponse(ctx, admission));
    if (!env.ANTHROPIC_API_KEY) return json(basicResponse(ctx, "ai_unavailable"));

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 25_000, maxRetries: 1 });
    try {
      const { response, usage } = await askClaude(parsed, ctx, client, systemPrompt);
      await limiter.charge(costUsd(usage));
      if (response.reason === "understated") console.warn("AI understated risk; sent basic answer", parsed.question);
      return json(response);
    } catch (err) {
      if (err instanceof Anthropic.APIError) console.error("Claude API error", err.status, err.message);
      else console.error("ask failed", err);
      return json(basicResponse(ctx, "ai_unavailable"));
    }
  },
} satisfies ExportedHandler<Env>;

/** "What are you running?" → a profile. Same per-phone limit and daily budget as /ask. */
async function handleProfile(request: Request, env: Env): Promise<Response> {
  const parsed = parseProfileRequest(await request.json().catch(() => null));
  if (typeof parsed === "string") return json({ error: parsed }, 400);

  const limiter = env.LIMITER.get(env.LIMITER.idFromName("global"));
  const admission = await limiter.admit(request.headers.get("CF-Connecting-IP") ?? "unknown");
  if (admission !== "ok") return json(basicProfile(parsed, admission));
  if (!env.ANTHROPIC_API_KEY) return json(basicProfile(parsed, "ai_unavailable"));

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 });
  try {
    const { response, usage } = await askProfile(parsed, client, profilePrompt);
    await limiter.charge(costUsd(usage));
    return json(response);
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error("Claude API error", err.status, err.message);
    else console.error("profile failed", err);
    return json(basicProfile(parsed, "ai_unavailable"));
  }
}

async function loadContext(req: AskRequest, env: Env): Promise<AskContext> {
  const base = { activity: req.activity, durationMinutes: req.durationMinutes, language: req.language };
  if (req.demo) {
    const now = new Date(demo.demoNow);
    const forecast = parseOpenMeteo(demo.forecast as unknown as OpenMeteoResponse, now);
    return { ...base, forecast, risks: hourlyRisk(forecast), alerts: [], now };
  }

  const { lat, lon } = req.place;
  const [weather, alerts] = await Promise.all([
    fetch(openMeteoUrl(lat, lon)).then((r) => {
      if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
      return r.json<OpenMeteoResponse>();
    }),
    // Alerts are extra; a failed NWS call shouldn't block the answer.
    fetch(nwsAlertsUrl(lat, lon), { headers: nwsHeaders(nwsContact(env)) })
      .then((r) => (r.ok ? r.json<Parameters<typeof parseNwsAlerts>[0]>() : { features: [] }))
      .then(parseNwsAlerts)
      .catch(() => []),
  ]);
  const now = new Date();
  const forecast = parseOpenMeteo(weather, now);
  return { ...base, forecast, risks: hourlyRisk(forecast), alerts, now };
}

/** NWS asks for a way to reach us. Without one the call still goes out, but they may block it. */
function nwsContact(env: Env): string {
  if (env.NWS_CONTACT?.trim()) return env.NWS_CONTACT.trim();
  console.warn("NWS_CONTACT is not set; run `npx wrangler secret put NWS_CONTACT`");
  return "afuera-proxy, contact not set";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
