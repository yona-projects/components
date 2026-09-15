import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// YonaMarkdownEditor.vue를 네이티브 커스텀 엘리먼트(<yona-markdown-editor-vue>)로 빌드하는
// 전용 설정. `customElement` 옵션을 이 파일 하나에만 매칭시켜(vite.config.ts/
// vite.demo.config.ts는 일반 컴포넌트로 컴파일 - 그쪽은 Vue 앱 트리 안에서 v-model로 쓰임)
// 같은 소스 파일(YonaMarkdownEditor.vue)을 중복 없이 두 가지 방식으로 컴파일한다.
//
// Vue 런타임을 external로 빼지 않는다 - 커스텀 엘리먼트는 소비 측(yona 템플릿)이 Vue를
// 전혀 모르는 페이지에 꽂히므로 자체 완결 번들이어야 한다(원본 Web Component가 CM6를
// 번들에 포함하는 것과 동일한 이유).
export default defineConfig({
  plugins: [
    vue({
      customElement: /YonaMarkdownEditor\.vue$/,
    }),
  ],
  // IIFE 라이브러리 빌드는 index.html 기반 앱 빌드와 달리 Vue 런타임의
  // `process.env.NODE_ENV` 참조를 자동으로 치환해주지 않아 브라우저에서
  // "process is not defined"로 죽는다 - 명시적으로 정의해준다.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist-element",
    lib: {
      entry: "src/element.ts",
      formats: ["iife"],
      name: "YonaMarkdownEditorVueElement",
      fileName: () => "yona-markdown-editor-vue-element.js",
    },
  },
});
