import type { Checkin, RiskLevel } from "@afuera/engine";
import Constants from "expo-constants";
import type { Settings } from "@/state/settings";

const proxyUrl: string | undefined = Constants.expoConfig?.extra?.proxyUrl;

/** What proxy/src/ask.ts sends back. */
export interface AskResponse {
  mode: "ai" | "basic";
  reason?: string;
  answer: string | null;
  level: RiskLevel | null;
  aboutTime: string;
  wbgtF: number | null;
  stopOutdoor: boolean;
  checkins: Checkin[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

/** Throws if the proxy can't be reached; the screen then answers from the heat model on the phone. */
export async function askProxy(question: string, settings: Settings, history: ChatTurn[]): Promise<AskResponse> {
  if (!proxyUrl || !settings.place) throw new Error("No proxy configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${proxyUrl}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        question,
        language: settings.language,
        activity: settings.activity,
        durationMinutes: settings.durationMinutes,
        place: { lat: settings.place.lat, lon: settings.place.lon },
        demo: settings.demo,
        history,
        role: settings.role,
        activityName: settings.profile?.displayName ?? null,
      }),
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    return (await res.json()) as AskResponse;
  } finally {
    clearTimeout(timer);
  }
}
