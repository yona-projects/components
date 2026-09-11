// yona-markdown-editor 정식 빌드 스크립트. esbuild로 TypeScript 소스 + CM6를 단일
// IIFE 번들로 묶는다. 산출물은 yona 저장소에 수동 복사·커밋되는 vendoring 대상이다
// (README.md 참고 — 이 저장소는 yona의 Gradle 빌드/CI와 완전히 무관하다).
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/YonaMarkdownEditor.ts"],
  bundle: true,
  format: "iife",
  minify: true,
  outfile: "dist/yona-markdown-editor.min.js",
  target: ["chrome110", "firefox110", "safari16"],
  sourcemap: true,
  logLevel: "info",
});
