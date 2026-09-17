// 산출물(dist/yona-markdown-editor.min.js)은 yona 저장소에 수동으로 복사·커밋되는 vendoring
// 대상이다 - 이 저장소는 yona의 Gradle 빌드/CI와 무관하다(README 참고).
import * as esbuild from "esbuild";
import { execSync } from "node:child_process";

// vendoring 산출물만 보고는 어느 소스 커밋에서 빌드됐는지 알 수 없으므로, 배너 주석으로 커밋
// SHA/빌드 시각을 새겨 넣는다. import.meta.dirname은 Node 20.11+ 전용(engines.node는 ">=18")
// 이라 fileURLToPath(import.meta.url)로 디렉터리를 구한다.
import { fileURLToPath } from "node:url";
import path from "node:path";

const buildDir = path.dirname(fileURLToPath(import.meta.url));

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: buildDir }).toString().trim();
  } catch {
    // git 저장소 밖에서 빌드되는 경우(예: 산출물만 떼어내 별도로 재빌드) 등 실패 대비 폴백.
    return "unknown";
  }
}

const gitSha = getGitSha();
const builtAt = new Date().toISOString();

await esbuild.build({
  entryPoints: ["src/YonaMarkdownEditor.ts"],
  bundle: true,
  format: "iife",
  minify: true,
  outfile: "dist/yona-markdown-editor.min.js",
  target: ["chrome110", "firefox110", "safari16"],
  sourcemap: true,
  logLevel: "info",
  banner: {
    js: `/* yona-markdown-editor built from components@${gitSha} at ${builtAt} */`,
  },
});
