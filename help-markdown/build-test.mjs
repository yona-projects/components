// editor2/build-test.mjs와 동일한 이유/방식 - test/*.test.ts를 esbuild로
// dist-test/*.test.mjs(ESM, Node 타깃)로 트랜스파일한 뒤 node:test로 돌린다.
import * as esbuild from "esbuild";
import { readdirSync } from "node:fs";

const testFiles = readdirSync("test").filter((f) => f.endsWith(".test.ts"));

await esbuild.build({
  entryPoints: testFiles.map((f) => `test/${f}`),
  outdir: "dist-test",
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["node18"],
  sourcemap: "inline",
  logLevel: "info",
  outExtension: { ".js": ".mjs" },
});
