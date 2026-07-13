import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";

const outfile = resolve("dist/server/index.js");
await mkdir(dirname(outfile), { recursive: true });

await build({
  entryPoints: ["worker/index.ts"],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  legalComments: "none",
  logLevel: "info",
});
