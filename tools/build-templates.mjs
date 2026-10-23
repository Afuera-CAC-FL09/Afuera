// ai/templates/*.yaml -> engine/src/templates.json. Run: npm run templates

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const dir = fileURLToPath(new URL("../ai/templates/", import.meta.url));
const out = fileURLToPath(new URL("../engine/src/templates.json", import.meta.url));

export function buildTemplates() {
  const shared = parse(readFileSync(dir + "_shared.yaml", "utf8")).checkins;
  const activities = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".yaml") && !f.startsWith("_")).sort()) {
    const t = parse(readFileSync(dir + file, "utf8"));
    activities[t.id] = { ...t, checkins: [...shared, ...t.checkins] };
  }
  return activities;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(out, JSON.stringify(buildTemplates(), null, 2) + "\n");
  console.log("wrote", out);
}
