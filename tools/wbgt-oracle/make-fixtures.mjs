// Saves the original C code's answers so tests don't need a C compiler.
// Usage: node tools/wbgt-oracle/make-fixtures.mjs path/to/oracle.exe

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const oracle = process.argv[2];
if (!oracle) {
  console.error("usage: node make-fixtures.mjs <oracle executable>");
  process.exit(1);
}

// Fixed seed so the cases are the same every time.
let seed = 20261014;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const between = (lo, hi) => Math.round((lo + rand() * (hi - lo)) * 10) / 10;

const KISSIMMEE = [28.29, -81.41];
const cases = [];

// 1. A full July day in Kissimmee, hour by hour, the way the app will use it:
//    Open-Meteo 10 m wind and hour-averaged radiation.
const july = [
  // UTC hour, °C, RH %, wind m/s at 10 m, W/m²
  [10, 25.0, 92, 1.0, 0], [11, 25.2, 90, 1.2, 15], [12, 26.1, 86, 1.5, 120],
  [13, 27.8, 78, 2.0, 310], [14, 29.4, 70, 2.4, 500], [15, 30.8, 64, 2.8, 680],
  [16, 31.9, 59, 3.1, 820], [17, 32.7, 56, 3.3, 900], [18, 33.3, 54, 3.5, 930],
  [19, 33.6, 53, 3.6, 880], [20, 33.2, 55, 3.8, 760], [21, 32.4, 59, 4.0, 420],
  [22, 31.0, 65, 3.4, 260], [23, 29.8, 71, 2.6, 110], [0, 28.6, 77, 1.9, 20],
  [1, 27.7, 82, 1.5, 0], [2, 27.1, 85, 1.3, 0], [3, 26.6, 87, 1.1, 0],
];
for (const [hour, t, rh, wind, solar] of july) {
  const day = hour < 10 ? 16 : 15;
  cases.push([2026, 7, day, hour, 0, 0, 60, ...KISSIMMEE, solar, 1015, t, rh, wind, 10, 0, 0]);
}

// 2. Seeded cases covering the conditions the app can see: anywhere in the US,
//    any season, calm to windy, dry to humid, day and night.
const places = [
  KISSIMMEE, [25.76, -80.19], [30.33, -81.66], [33.45, -112.07],
  [29.76, -95.37], [41.88, -87.63], [47.61, -122.33], [21.31, -157.86],
];
for (let i = 0; i < 400; i++) {
  const [lat, lon] = pick(places);
  const month = 1 + Math.floor(rand() * 12);
  const day = 1 + Math.floor(rand() * 28);
  const hour = Math.floor(rand() * 24);
  const minute = pick([0, 15, 30, 45]);
  const temp = between(0, 44);
  const rh = between(15, 100);
  const height = pick([2, 10]);
  cases.push([
    pick([2026, 2027, 2028]), month, day, hour, minute, 0, pick([0, 15, 60]),
    lat, lon, between(0, 1100), between(990, 1030), temp, rh,
    between(0, 12), height, pick([-1, 0, 1]), pick([0, 1]),
  ]);
}

const input = cases.map((c) => c.join(" ")).join("\n") + "\n";
const output = execFileSync(oracle, { input, encoding: "utf8" }).trim().split(/\r?\n/);
if (output.length !== cases.length) throw new Error(`expected ${cases.length} rows, got ${output.length}`);

const fields = [
  "year", "month", "day", "hour", "minute", "gmt", "avg", "lat", "lon", "solar",
  "pressure", "tempC", "rh", "windSpeed", "windHeight", "dT", "urban",
];
const rows = cases.map((c, i) => {
  const [status, , globe, naturalWetBulb, , wbgt] = output[i].trim().split(/\s+/).map(Number);
  const inputs = Object.fromEntries(fields.map((f, j) => [f, c[j]]));
  return { input: inputs, expected: status === 0 ? { wbgt, globe, naturalWetBulb } : null };
});

const out = fileURLToPath(new URL("../../engine/test/fixtures/liljegren-oracle.json", import.meta.url));
writeFileSync(out, JSON.stringify(rows, null, 1) + "\n");
console.log(`wrote ${rows.length} cases (${rows.filter((r) => !r.expected).length} non-converging) to ${out}`);
