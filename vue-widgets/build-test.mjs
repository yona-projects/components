// editor2/help-markdown 각각의 build-test.mjs와 동일한 이유/방식 - test/*.test.ts를
// esbuild로 dist-test/*.test.mjs(ESM, Node 타깃)로 트랜스파일한 뒤 node:test로 돌린다.
// 두 위젯의 테스트 파일이 test/ 아래 평평하게(editor-*.test.ts, help-*.test.ts) 있어
// 하위 디렉터리 재귀 탐색 없이 그대로 재사용 가능하다.
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
