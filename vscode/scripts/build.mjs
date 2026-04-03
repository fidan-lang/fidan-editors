import { build, context } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "out");
const outFile = path.join(outDir, "extension.js");
const watch = process.argv.includes("--watch");

const options = {
  entryPoints: [path.join(rootDir, "src", "extension.ts")],
  outfile: outFile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  sourcemap: false,
  logLevel: "info",
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching VS Code extension bundle...");
  await new Promise(() => { });
} else {
  await build(options);
}
