// Usage: node tools/meter-compare.mjs <readings.csv> [output-folder]
// CSV columns: time,wbgtF,lat,lon,notes (see data/meter/sample-readings.csv)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./lib/load-ts.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node tools/meter-compare.mjs <readings.csv> [output-folder]");
    process.exit(1);
  }
  const outDir = process.argv[3] ?? join(root, "docs/evidence");
  const { parseCsv, toCsv } = await loadTs(new URL("./lib/csv.ts", import.meta.url));
  const { fetchHistory, groupByPlace, HISTORY_SOURCE, isSampleInput } = await loadTs(new URL("./lib/history.ts", import.meta.url));
  const mt = await loadTs(new URL("./lib/meter.ts", import.meta.url));
  const engine = await loadTs(new URL("../engine/src/index.ts", import.meta.url));

  const csvText = readFileSync(input, "utf8");
  const { readings, errors } = mt.parseReadings(parseCsv(csvText));
  for (const e of errors) console.warn(`skipped ${e}`);
  if (readings.length === 0) {
    console.error(`No readings to compare. Columns needed: ${mt.READING_COLUMNS.join(",")}`);
    process.exit(1);
  }

  const results = [];
  for (const group of groupByPlace(readings)) {
    // One extra day on each side, so a time near midnight or written in UTC still has its hour.
    const shift = (d, days) => new Date(Date.parse(d) + days * 86_400_000).toISOString().slice(0, 10);
    const forecast = await fetchHistory(group.lat, group.lon, shift(group.startDate, -1), shift(group.endDate, 1));
    const risks = engine.hourlyRisk(forecast);
    for (const r of group.items) results.push(mt.compareReading(r, forecast, risks));
  }
  results.sort((a, b) => a.at - b.at);

  const name = basename(input).replace(/\.csv$/i, "");
  const files = { md: `meter-${name}.md`, csv: `meter-${name}.csv`, svg: `meter-${name}.svg` };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, files.csv), toCsv(mt.comparisonRows(results), mt.COMPARISON_COLUMNS));
  writeFileSync(join(outDir, files.svg), mt.scatterSvg(results));
  writeFileSync(
    join(outDir, files.md),
    mt.meterReport(results, {
      input: relative(root, input).replace(/\\/g, "/"),
      generated: new Date(),
      source: HISTORY_SOURCE,
      chartFile: files.svg,
      csvFile: files.csv,
      skipped: errors,
      sample: isSampleInput(csvText),
    }),
  );

  const s = mt.meterStats(results);
  console.log(
    `${s.n} readings · average gap ${s.meanAbsGap} °F · bias ${s.bias > 0 ? "+" : ""}${s.bias} °F · ` +
      `largest ${s.largest?.gap ?? "—"} °F · same level ${s.levelMatches}/${s.n}`,
  );
  console.log(`Wrote ${relative(root, join(outDir, files.md))} (+ .csv, .svg)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
