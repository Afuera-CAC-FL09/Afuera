import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      // Wrangler imports .md as text (see wrangler.toml); do the same in tests.
      name: "markdown-as-text",
      transform(_code, id) {
        if (id.endsWith(".md")) return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
      },
    },
  ],
  resolve: {
    alias: { "cloudflare:workers": fileURLToPath(new URL("./test/cloudflare-stub.ts", import.meta.url)) },
  },
});
