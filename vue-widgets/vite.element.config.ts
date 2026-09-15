import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 두 위젯 다 네이티브 커스텀 엘리먼트로 빌드하되, Vite/Rollup 제약("Multiple entry points
// are not supported when output formats include umd or iife")때문에 한 번의 vite build
// 호출로는 iife 포맷의 멀티 엔트리를 만들 수 없다 - VUE_WIDGET_TARGET 환경변수로 어느
// 위젯을 빌드할지 고르고, package.json의 build:elements 스크립트가 이 설정 파일을 두 번
// (editor/help 각각) 호출한다. package.json/node_modules/tsconfig는 하나로 공유되므로
// "완전히 별개의 두 npm 프로젝트"였던 editor2/help-markdown 시절보다는 확실히 통합됐다 -
// 다만 빌드 산출물 자체는 여전히 위젯당 1개의 독립 파일이다(원래 커스텀 엘리먼트가
// 그렇게 쓰이는 방식이기도 하다 - yona 템플릿에 스크립트 태그로 각각 로드).
const target = process.env.VUE_WIDGET_TARGET;

const TARGETS = {
  editor: {
    customElement: /YonaMarkdownEditor\.vue$/,
    entry: "src/editor/element.ts",
    fileName: "yona-markdown-editor-vue-element.js",
    name: "YonaMarkdownEditorVueElement",
  },
  help: {
    customElement: /MarkdownHelp\.vue$/,
    entry: "src/help-markdown/element.ts",
    fileName: "yona-help-markdown-element.js",
    name: "YonaHelpMarkdownElement",
  },
} as const;

if (target !== "editor" && target !== "help") {
  throw new Error(
    `VUE_WIDGET_TARGET 환경변수를 "editor" 또는 "help"로 지정해야 한다(현재: ${JSON.stringify(target)}). ` +
      `npm run build:elements가 이미 두 값을 각각 넘겨 호출하므로, 직접 vite build를 돌릴 때만 신경 쓰면 된다.`,
  );
}

const config = TARGETS[target];

export default defineConfig({
  plugins: [vue({ customElement: config.customElement })],
  // IIFE 라이브러리 빌드는 index.html 기반 앱 빌드와 달리 Vue 런타임의
  // `process.env.NODE_ENV` 참조를 자동으로 치환해주지 않아 브라우저에서
  // "process is not defined"로 죽는다(editor2에서 실측으로 발견한 문제) - 명시적으로 정의.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist-element",
    // 두 번의 빌드가 서로의 산출물을 지우지 않도록(Vite 기본은 build마다 outDir를 비움).
    emptyOutDir: false,
    lib: {
      entry: config.entry,
      formats: ["iife"],
      name: config.name,
      fileName: () => config.fileName,
    },
  },
});
