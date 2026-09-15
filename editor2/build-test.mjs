// yona-markdown-editor 테스트 번들러.
//
// 이 저장소는 esbuild만 devDependency로 두고 있고, 별도 테스트 러너(vitest/jest 등)를
// 새로 들이지 않는다 - Node 18+ 내장 test 러너(node:test)로 충분하기 때문이다. 다만 소스가
// TypeScript라 Node가 바로 실행할 수 없으므로, 이미 있는 esbuild로 test/*.test.ts를
// dist-test/*.test.mjs(ESM, Node 타깃, 미압축)로 트랜스파일만 한 뒤 `node --test`로 돌린다.
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
