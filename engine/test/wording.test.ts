import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { en } from "../../app/src/i18n/en";
import { es } from "../../app/src/i18n/es";
import templates from "../src/templates.json";

// No heat level is "safe". Every word a user can see must say "lower risk" instead.
const BANNED = { en: /\bsafe(ly|ty)?\b/i, es: /\bsegur[oa]s?\b/i };

function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

describe("never say safe", () => {
  it.each([
    ["en", en],
    ["es", es],
  ] as const)("app strings (%s)", (lang, table) => {
    const hits = strings(table).filter(([, text]) => BANNED[lang].test(text));
    expect(hits).toEqual([]);
  });

  it("check-in templates", () => {
    const hits = strings(templates).filter(([path, text]) => (path.endsWith(".es") ? BANNED.es : BANNED.en).test(text));
    expect(hits).toEqual([]);
  });

  it("system prompt only mentions 'safe' to forbid it", () => {
    const prompt = readFileSync(new URL("../../ai/prompts/system.md", import.meta.url), "utf8");
    for (const line of prompt.split("\n").filter((l) => BANNED.en.test(l) || BANNED.es.test(l))) {
      expect(line).toMatch(/never|nunca/i);
    }
  });
});

describe("translations", () => {
  it("Spanish has every English key", () => {
    const keys = (t: object) => strings(t).map(([p]) => p.replace(/\[\d+\]$/, "")).sort();
    expect(keys(es)).toEqual(keys(en));
  });
});
