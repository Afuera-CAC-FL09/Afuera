import {
  activityTemplate,
  guessProfile,
  PROFILE_TEXT_MAX,
  profileCheckins,
  profileWaterEvery,
  type ActivityProfile,
  type Checkin,
  type RiskLevel,
  type Role,
} from "@afuera/engine";
import Constants from "expo-constants";
import type { Settings } from "@/state/settings";

const proxyUrl: string | undefined = Constants.expoConfig?.extra?.proxyUrl;

// Falls back to keyword matching when AI is off or unreachable.
export async function requestProfile(text: string, role: Role, language: "en" | "es", aiAllowed: boolean): Promise<{ profile: ActivityProfile; ai: boolean }> {
  const clipped = text.trim().slice(0, PROFILE_TEXT_MAX);
  const fallback = () => ({ profile: guessProfile(clipped, role, language), ai: false });
  if (!aiAllowed || !proxyUrl || proxyUrl.includes("YOUR-SUBDOMAIN")) return fallback();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(`${proxyUrl}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ text: clipped, role, language }),
    });
    if (!res.ok) return fallback();
    const json = (await res.json()) as { mode: "ai" | "basic"; profile: ActivityProfile };
    return { profile: json.profile, ai: json.mode === "ai" };
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}

type ActivitySettings = Pick<Settings, "activity" | "profile">;

/** The check-ins for this activity and level, with the profile's modifiers (they only add or tighten). */
export function checkinsFor(settings: ActivitySettings, level: RiskLevel): Checkin[] {
  return profileCheckins(settings.profile, settings.activity, level);
}

export function waterEveryFor(settings: ActivitySettings, level: RiskLevel): number {
  return profileWaterEvery(settings.profile, settings.activity, level);
}

/** The profile's own name when it's in this language, else the template's name. */
export function activityName(settings: ActivitySettings, language: "en" | "es"): string {
  const p = settings.profile;
  return p && p.language === language && p.displayName ? p.displayName : activityTemplate(settings.activity).name[language];
}
