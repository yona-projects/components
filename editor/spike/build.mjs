// P3-46 0단계 스파이크 빌드 스크립트. esbuild로 CM6 + 실험 코드를 단일 IIFE로 번들.
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["entry.js"],
  bundle: true,
  format: "iife",
  outfile: "dist/spike-bundle.js",
  target: ["chrome110", "firefox110", "safari16"],
  sourcemap: true,
  logLevel: "info",
});
