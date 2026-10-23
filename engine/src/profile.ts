// A profile never changes the heat level. It can only add check-ins or make them more frequent.

import { ACTIVITIES, activityTemplate, getCheckins, MIN_INTERVAL_MINUTES, type ActivityId, type Checkin, type Localized } from "./checkins";
import type { RiskLevel } from "./risk";

export const EFFORTS = ["light", "moderate", "hard"] as const;
export const GEARS = ["none", "light", "heavy"] as const;
export const SURFACES = ["grass", "turf", "asphalt", "sand", "unknown"] as const;
export const SHADES = ["yes", "some", "none", "unknown"] as const;
export const ROLES = ["organizer", "parent", "participant"] as const;

export type Effort = (typeof EFFORTS)[number];
export type Gear = (typeof GEARS)[number];
export type Surface = (typeof SURFACES)[number];
export type Shade = (typeof SHADES)[number];
export type Role = (typeof ROLES)[number];

export interface ActivityProfile {
  baseTemplate: ActivityId;
  effort: Effort;
  gear: Gear;
  surface: Surface;
  shade: Shade;
  groupSize: number | null;
  ages: string | null;
  role: Role;
  /** Short name in the language it was typed in, 40 characters max. */
  displayName: string;
  /** Things to have ready, added by the AI. Shown once at the start. */
  extraCheckins: { id: string; label: Localized }[];
  language: "en" | "es";
}

export const PROFILE_TEXT_MAX = 300;
export const DISPLAY_NAME_MAX = 40;
export const EXTRA_CHECKINS_MAX = 3;

/** The JSON schema the AI must fill (strict structured output). */
export const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    baseTemplate: { type: "string", enum: [...ACTIVITIES] },
    effort: { type: "string", enum: [...EFFORTS] },
    gear: { type: "string", enum: [...GEARS] },
    surface: { type: "string", enum: [...SURFACES] },
    shade: { type: "string", enum: [...SHADES] },
    groupSize: { type: ["integer", "null"] },
    ages: { type: ["string", "null"] },
    role: { type: "string", enum: [...ROLES] },
    displayName: { type: "string" },
    extraCheckins: {
      type: "array",
      items: {
        type: "object",
        properties: { en: { type: "string" }, es: { type: "string" } },
        required: ["en", "es"],
        additionalProperties: false,
      },
    },
  },
  required: ["baseTemplate", "effort", "gear", "surface", "shade", "groupSize", "ages", "role", "displayName", "extraCheckins"],
  additionalProperties: false,
} as const;

const has = (text: string, words: string[]) => words.some((w) => new RegExp(`(^|[^\\p{L}])${w}`, "iu").test(text));

const TEMPLATE_WORDS: [ActivityId, string[]][] = [
  ["band", ["band", "banda", "marching", "drumline", "color guard", "guardia de color", "ensayo", "rehearsal", "orchestra", "orquesta", "music", "música", "musica"]],
  ["camp", ["camp", "campamento", "day camp", "recess", "recreo", "playground", "parque infantil", "summer program", "programa de verano"]],
  ["event", ["event", "evento", "festival", "fair", "feria", "5k", "fun run", "carrera", "parade", "desfile", "tournament", "torneo", "game day", "graduation", "graduación", "concert", "concierto"]],
  ["team", ["practice", "práctica", "practica", "football", "fútbol", "futbol", "soccer", "baseball", "béisbol", "beisbol", "softball", "track", "atletismo", "cross country", "lacrosse", "cheer", "porrist", "team", "equipo", "training", "entrenamiento", "conditioning"]],
];

/** The closest preset for a sentence: keywords in English and Spanish. Used when the AI is off or sends junk. */
export function guessProfile(text: string, role: Role = "organizer", language: "en" | "es" = "en"): ActivityProfile {
  const t = text.slice(0, PROFILE_TEXT_MAX);
  const baseTemplate = TEMPLATE_WORDS.find(([, words]) => has(t, words))?.[0] ?? "team";
  const gear: Gear = has(t, ["uniform", "uniforme", "pads", "hombreras", "helmet", "casco", "full gear", "equipo completo", "shako", "costume", "disfraz", "jacket", "chaqueta"])
    ? "heavy"
    : "none";
  const surface: Surface = has(t, ["asphalt", "asfalto", "parking", "estacionamiento", "parqueo", "blacktop", "pavement", "pavimento", "road", "calle", "street", "concrete", "concreto", "cemento"])
    ? "asphalt"
    : has(t, ["turf", "artificial", "sintétic", "sintetic"])
      ? "turf"
      : has(t, ["sand", "arena", "beach", "playa"])
        ? "sand"
        : has(t, ["grass", "césped", "cesped", "pasto", "zacate", "field", "campo", "cancha"])
          ? "grass"
          : "unknown";
  const shade: Shade = has(t, ["no shade", "sin sombra", "full sun", "pleno sol", "sol directo"]) ? "none" : has(t, ["shade", "sombra", "tent", "carpa", "canopy"]) ? "some" : "unknown";
  const effort: Effort = has(t, ["conditioning", "sprint", "running", "correr", "run ", "scrimmage", "two-a-day", "doble sesión", "drills", "hard"]) ? "hard" : "moderate";
  const people = t.match(/(\d{1,4})\s*(people|kids|players|students|members|campers|personas|niños|ninos|jugadores|estudiantes|chicos|muchachos)/i);
  return {
    baseTemplate,
    effort,
    gear,
    surface,
    shade,
    groupSize: people ? clampGroup(Number(people[1])) : null,
    ages: null,
    role,
    displayName: activityTemplate(baseTemplate).name[language],
    extraCheckins: [],
    language,
  };
}

export function presetProfile(activity: ActivityId, role: Role, language: "en" | "es"): ActivityProfile {
  return { ...guessProfile("", role, language), baseTemplate: activity, displayName: activityTemplate(activity).name[language] };
}

// Health details never belong in a profile. Spanish and English, stems so plurals and genders match.
const HEALTH = [
  "asthma", "asma", "inhaler", "inhalador", "diabet", "insulin", "insulina", "epilep", "seizure", "convuls", "heart", "corazón", "corazon", "cardi",
  "adhd", "tdah", "autis", "allerg", "alergi", "pregnan", "embaraz", "medic", "médic", "pills?\\b", "pastilla", "sick", "enferm", "illness",
  "condition(?!ing)", "condición", "condicion", "disab", "discapac", "anxiety", "ansiedad", "depress", "sickle", "falciforme", "obes", "overweight", "sobrepeso",
  "injur", "lesion", "lesión", "concussion", "conmoción", "conmocion", "faint", "desmay", "fever", "fiebre", "migraine", "migraña", "surgery", "cirugía", "cirugia",
];
const HEALTH_RE = new RegExp(`(^|[^\\p{L}])(${HEALTH.join("|")})`, "iu");
/** Checked without accents too, so "diabética" matches "diabet". */
const isHealth = (s: string) => HEALTH_RE.test(s) || HEALTH_RE.test(s.normalize("NFD").replace(/\p{M}/gu, ""));

// Capitalized words that are fine to keep even mid-sentence.
const ALLOWED_CAPS = new Set(["I", "JV", "PE", "FHSAA", "AM", "PM", "WBGT", "YMCA", "Afuera"]);

/** Words in the person's text that look like names: capitalized, not starting a sentence, not a known word. */
export function nameLikeWords(text: string): Set<string> {
  const out = new Set<string>();
  let sentenceStart = true;
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    const word = tok.replace(/[^\p{L}'-]/gu, "");
    const starts = sentenceStart || /^[¿¡]/.test(tok);
    if (word && /^\p{Lu}/u.test(word) && !starts && !ALLOWED_CAPS.has(word)) out.add(word.toLowerCase());
    sentenceStart = /[.!?]["')]*$/.test(tok);
  }
  // "my son Mateo" / "mi hija Sofía" catches names even at the start of a phrase.
  for (const m of text.matchAll(/\b(?:named|called|my (?:son|daughter|kid|child)|llamad[oa]|mi (?:hijo|hija|niño|niña))\s+(\p{L}+)/giu)) out.add(m[1].toLowerCase());
  return out;
}

// No heat level is safe; a profile can't say otherwise, even if someone types it in.
const NEVER_SAY = /^(safe|safely|safety|segur[oa]s?|seguridad)$/i;

/** Removes words that look like a name from the person's text, any health detail, and "safe". */
export function scrubPersonal(value: string, sourceText: string): string {
  const names = nameLikeWords(sourceText);
  return value
    .split(/\s+/)
    .filter((w) => {
      const bare = w.replace(/[^\p{L}'’-]/gu, "").replace(/['’]s$/i, "").replace(/['’]/g, "").toLowerCase();
      return bare === "" ? w.trim() !== "" : !names.has(bare) && !isHealth(bare) && !NEVER_SAY.test(bare);
    })
    .join(" ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/^[\s,.;:–-]+|[\s,;:–-]+$/g, "")
    .trim();
}

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

function clampGroup(n: number): number | null {
  return Number.isInteger(n) && n >= 1 && n <= 5000 ? n : null;
}

// Bad fields fall back to the closest preset. Names and health details are stripped.
export function cleanProfile(raw: unknown, text: string, role: Role, language: "en" | "es"): ActivityProfile {
  const guess = guessProfile(text, role, language);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return guess;
  const r = raw as Record<string, unknown>;
  const baseTemplate = oneOf(ACTIVITIES, r.baseTemplate, guess.baseTemplate);

  const name = typeof r.displayName === "string" ? scrubPersonal(r.displayName, text).slice(0, DISPLAY_NAME_MAX).trim() : "";
  const ages = typeof r.ages === "string" ? scrubPersonal(r.ages, text).slice(0, 30).trim() : "";
  const extras = (Array.isArray(r.extraCheckins) ? r.extraCheckins : [])
    .filter((c): c is { en: string; es: string } => typeof c?.en === "string" && typeof c?.es === "string")
    // A check-in about someone's health isn't scrubbed into something vague; it's dropped.
    .filter((c) => !isHealth(c.en) && !isHealth(c.es))
    .map((c) => ({ en: scrubPersonal(c.en, text).slice(0, 80), es: scrubPersonal(c.es, text).slice(0, 80) }))
    .filter((c) => c.en && c.es)
    .slice(0, EXTRA_CHECKINS_MAX)
    .map((label, i) => ({ id: `extra-${i + 1}`, label }));

  return {
    baseTemplate,
    effort: oneOf(EFFORTS, r.effort, guess.effort),
    gear: oneOf(GEARS, r.gear, guess.gear),
    surface: oneOf(SURFACES, r.surface, guess.surface),
    shade: oneOf(SHADES, r.shade, guess.shade),
    groupSize: typeof r.groupSize === "number" ? clampGroup(r.groupSize) : null,
    ages: ages || null,
    // The person picked their role in the app; the AI can't change it.
    role,
    displayName: name || activityTemplate(baseTemplate).name[language],
    extraCheckins: extras,
    language,
  };
}

/** Hot surfaces radiate heat and have no shade of their own. */
const HOT_SURFACE: Surface[] = ["asphalt", "turf", "sand"];

const added = (id: string, required: boolean, everyMinutes: number, title: Localized, detail: Localized): Checkin => ({
  id,
  required,
  everyMinutes,
  title,
  detail,
  source: "template",
});

// Modifiers only tighten or add check-ins.
export function profileCheckins(profile: ActivityProfile | null, activity: ActivityId, level: RiskLevel): Checkin[] {
  const base = getCheckins(profile?.baseTemplate ?? activity, level);
  if (!profile) return base;

  // Our own factors, not FHSAA's.
  let factor = 1;
  if (profile.gear === "heavy") factor *= 0.8;
  if (HOT_SURFACE.includes(profile.surface)) factor *= 0.9;
  if (profile.shade === "none") factor *= 0.9;
  if (profile.effort === "hard") factor *= 0.9;
  const tighten = (every: number) => (every === 0 ? 0 : Math.max(MIN_INTERVAL_MINUTES, Math.min(every, Math.floor(every * factor))));

  const out = base.map((c) => ({
    ...c,
    everyMinutes: c.id === "water-break" || c.id === "symptom-check" ? tighten(c.everyMinutes) : c.everyMinutes,
  }));
  const water = out.find((c) => c.id === "water-break")?.everyMinutes ?? 30;
  const serious = level !== "lower";

  if (profile.gear === "heavy") {
    out.push(
      added("gear-off", serious, water, { en: "Gear and jackets off at every break", es: "Fuera equipo y chaquetas en cada descanso" }, {
        en: "Heavy uniforms and pads hold heat in. Take them off (or open them up) during every water break.",
        es: "Los uniformes pesados y el equipo guardan el calor. Quítatelos (o ábrelos) en cada descanso con agua.",
      }),
    );
  }
  if (HOT_SURFACE.includes(profile.surface)) {
    out.push(
      added("off-hot-surface", serious, 0, { en: "Breaks off the hot ground", es: "Descansos fuera del suelo caliente" }, {
        en: "Asphalt, turf and sand get much hotter than grass. Rest on grass or in shade, never sitting on the hot surface.",
        es: "El asfalto, el césped artificial y la arena se calientan mucho más que el pasto. Descansen en el pasto o en la sombra, nunca sentados en la superficie caliente.",
      }),
    );
    const reading = out.find((c) => c.id === "heat-reading");
    if (reading) reading.everyMinutes = Math.min(reading.everyMinutes, 20);
  }
  if (profile.shade === "none") {
    out.push(
      added("bring-shade", serious, 0, { en: "Bring shade for breaks", es: "Lleven sombra para los descansos" }, {
        en: "There's no shade here. Set up a canopy or tent, or plan breaks somewhere shaded.",
        es: "Aquí no hay sombra. Pongan una carpa o toldo, o planeen los descansos en un lugar con sombra.",
      }),
    );
  }
  for (const extra of profile.extraCheckins.slice(0, EXTRA_CHECKINS_MAX)) {
    out.push({ id: extra.id, required: false, everyMinutes: 0, title: extra.label, detail: { en: "", es: "" }, source: "ai" });
  }
  return out;
}

/** The water-break interval the profile works out to (what Today and Live show). */
export function profileWaterEvery(profile: ActivityProfile | null, activity: ActivityId, level: RiskLevel): number {
  return profileCheckins(profile, activity, level).find((c) => c.id === "water-break")?.everyMinutes ?? 30;
}
