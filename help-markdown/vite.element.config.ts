import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// editor2/vite.element.config.ts와 동일한 패턴 - customElement 옵션을 이 파일 하나에만
// 매칭시켜 같은 소스(MarkdownHelp.vue)를 일반 컴포넌트(vite.config.ts)와 네이티브 커스텀
// 엘리먼트로 중복 없이 나눠 컴파일한다. Vue 런타임도 함께 번들에 포함한다(소비 측이 Vue를
// 모르는 페이지에 꽂히므로 자체 완결).
export default defineConfig({
  plugins: [
    vue({
      customElement: /MarkdownHelp\.vue$/,
    }),
  ],
  // IIFE 라이브러리 빌드는 index.html 기반 앱 빌드와 달리 Vue 런타임의
  // `process.env.NODE_ENV` 참조를 자동으로 치환해주지 않아 브라우저에서
  // "process is not defined"로 죽는다(editor2에서 실측으로 발견한 문제) - 명시적으로 정의.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist-element",
    lib: {
      entry: "src/element.ts",
      formats: ["iife"],
      name: "YonaHelpMarkdownElement",
      fileName: () => "yona-help-markdown-element.js",
    },
  },
});
