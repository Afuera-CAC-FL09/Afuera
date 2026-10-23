// Usage: node tools/what-if.mjs <schedule.csv> [output-folder]
// CSV columns: date,start,durationMin,place,lat,lon,activity (see data/what-if/sample-schedule.csv)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./lib/load-ts.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node tools/what-if.mjs <schedule.csv> [output-folder]");
    process.exit(1);
  }
  const outDir = process.argv[3] ?? join(root, "docs/evidence");
  const { parseCsv, toCsv } = await loadTs(new URL("./lib/csv.ts", import.meta.url));
  const { fetchHistory, groupByPlace, HISTORY_SOURCE, isSampleInput } = await loadTs(new URL("./lib/history.ts", import.meta.url));
  const w = await loadTs(new URL("./lib/whatif.ts", import.meta.url));
  const engine = await loadTs(new URL("../engine/src/index.ts", import.meta.url));

  const csvText = readFileSync(input, "utf8");
  const { practices, errors } = w.parsePractices(parseCsv(csvText));
  for (const e of errors) console.warn(`skipped ${e}`);
  if (practices.length === 0) {
    console.error(`No practices to check. Columns needed: ${w.PRACTICE_COLUMNS.join(",")}`);
    process.exit(1);
  }

  const results = [];
  for (const group of groupByPlace(practices)) {
    console.log(`weather for ${group.items[0].place || `${group.lat},${group.lon}`}: ${group.startDate} to ${group.endDate}`);
    const forecast = await fetchHistory(group.lat, group.lon, group.startDate, group.endDate);
    const risks = engine.hourlyRisk(forecast);
    for (const p of group.items) results.push(w.analyzePractice(p, forecast, risks));
  }
  results.sort((a, b) => a.start - b.start);

  const name = basename(input).replace(/\.csv$/i, "");
  const files = { md: `what-if-${name}.md`, csv: `what-if-${name}.csv`, svg: `what-if-${name}.svg` };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, files.csv), toCsv(w.resultRows(results), w.RESULT_COLUMNS));
  writeFileSync(join(outDir, files.svg), w.chartSvg(results));
  writeFileSync(
    join(outDir, files.md),
    w.reportMarkdown(results, {
      input: relative(root, input).replace(/\\/g, "/"),
      generated: new Date(),
      source: HISTORY_SOURCE,
      chartFile: files.svg,
      csvFile: files.csv,
      skipped: errors,
      sample: isSampleInput(csvText),
    }),
  );

  const s = w.summarize(results);
  console.log(
    `\n${s.practices} practices · ${s.inHighOrExtreme} reached High/Extreme · ${s.minutesHighOrExtreme} min in High/Extreme heat · ` +
      `${s.couldMove} could have moved · ${s.minutesAvoided} min avoidable`,
  );
  console.log(`Wrote ${relative(root, join(outDir, files.md))} (+ .csv, .svg)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
