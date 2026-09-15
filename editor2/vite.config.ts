import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// dev(예: `npm run dev`)는 이 루트의 index.html(App.vue를 마운트하는 데모/스모크 하네스)을
// 그대로 서빙한다. build는 라이브러리 모드로 YonaMarkdownEditor.vue만 내보낸다 - yona 쪽에
// vendoring할 산출물은 원본 컴포넌트(<yona-markdown-editor> 네이티브 커스텀 엘리먼트)와
// 별개로, 이 디렉터리는 어디까지나 "같은 기능을 Vue 3 Composition API + TypeScript SFC로
// 다시 작성하면 어떤 모습이 되는가"를 보여주는 비교용 구현이다(README 참고).
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: "src/YonaMarkdownEditor.vue",
      name: "YonaMarkdownEditorVue",
      fileName: (format) => `yona-markdown-editor-vue.${format}.js`,
    },
    rollupOptions: {
      external: ["vue"],
      output: {
        globals: { vue: "Vue" },
      },
    },
  },
});
