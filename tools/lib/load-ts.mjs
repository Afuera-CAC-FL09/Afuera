// Lets the plain-Node tools use the TypeScript engine: bundles a .ts entry with
// esbuild in memory and imports the result. Nothing is written to disk.

import { build } from "esbuild";
import { fileURLToPath } from "node:url";

export async function loadTs(url) {
  const result = await build({
    entryPoints: [fileURLToPath(url)],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node20",
    logLevel: "error",
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
