// Bygger backend/server.ts til dist-server/server.mjs, siderne (src/main.ts og src/print.ts) til dist/app.js og
// dist/print.js, og kopierer public/ til dist/. `--watch` genbygger siderne ved ændringer (serveren køres med
// `npm run backend:watch`).
import { cp, rm } from "node:fs/promises";
import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");

const server = {
  entryPoints: ["backend/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  outfile: "dist-server/server.mjs",
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
};

const web = {
  entryPoints: { app: "src/main.ts", print: "src/print.ts" },
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  outdir: "dist",
  logLevel: "info",
};

const copyPublic = () => cp("public", "dist", { recursive: true });

await rm("dist", { recursive: true, force: true });
await copyPublic();
if (watch) {
  const ctx = await context(web);
  await ctx.watch();
  console.log("Genbygger dist/app.js og dist/print.js ved ændringer i src/ og shared/. Kopiér public/ igen med `npm run build`, hvis du retter dér.");
} else {
  await build(web);
  await build(server);
}
