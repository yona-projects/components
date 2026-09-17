// yona-markdown-editor 테스트 번들러.
//
// 별도 테스트 러너(vitest/jest 등) 없이 Node 18+ 내장 node:test로 충분하다고 판단했다. 소스가
// TypeScript라 Node가 바로 실행하지 못하므로, esbuild로 test/*.test.ts를 dist-test/*.test.mjs로
// 트랜스파일만 한 뒤 `node --test`로 돌린다.
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
