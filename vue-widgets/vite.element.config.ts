import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 위젯들을 하나의 vite build 호출로 각자의 네이티브 커스텀 엘리먼트 번들로 만든다.
// 원래 iife 포맷을 썼을 때는 Rollup 자체가 "iife/umd 포맷은 멀티 엔트리를 지원하지
// 않는다"는 제약이 있어(iife/umd는 번들 전체를 하나의 전역 스코프 함수로 감싸는 구조라
// 엔트리 간 청크를 나누거나 공유할 방법이 없기 때문) VUE_WIDGET_TARGET 환경변수로 같은
// 설정을 두 번 호출해 우회해야 했다. es 포맷으로 바꾸면 Vite가 멀티 엔트리 + 청크
// 공유(Vue 런타임을 두 위젯이 공용 청크로 나눠 씀 - iife 시절엔 각자 중복 포함이었다)를
// 정식 지원하므로 한 번의 호출로 둘 다 나온다 - 대가는 yona 쪽 <script> 태그에
// type="module"이 필요하다는 것뿐(최신 브라우저는 전부 지원).
export default defineConfig({
  plugins: [
    vue({
      customElement: /(YonaMarkdownEditor|MarkdownHelp|Toast|YonaSwitch|YonaDropdown|YonaDialog|YonaTypeahead|YonaAttachments|YonaReviewForm|YonaPagination|YonaLoginDialog|YonaScrollElevator|YonaPageSlide)\.vue$/,
    }),
  ],
  // 라이브러리 빌드는 index.html 기반 앱 빌드와 달리 Vue 런타임의 `process.env.NODE_ENV`
  // 참조를 자동으로 치환해주지 않아 브라우저에서 "process is not defined"로 죽는다
  // (iife 시절 실측으로 발견한 문제 - es 포맷으로 바꿔도 이 부분은 동일하게 필요).
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist-element",
    lib: {
      entry: {
        "yona-markdown-editor-vue-element": "src/editor/element.ts",
        "yona-help-markdown-element": "src/help-markdown/element.ts",
        "yona-toast-element": "src/toast/element.ts",
        "yona-switch-element": "src/switch/element.ts",
        "yona-dropdown-element": "src/dropdown/element.ts",
        "yona-dialog-element": "src/dialog/element.ts",
        "yona-typeahead-element": "src/typeahead/element.ts",
        "yona-attachments-element": "src/attachments/element.ts",
        "yona-review-form-element": "src/review-form/element.ts",
        "yona-pagination-element": "src/pagination/element.ts",
        "yona-login-dialog-element": "src/login-dialog/element.ts",
        "yona-scroll-elevator-element": "src/scroll-elevator/element.ts",
        "yona-page-slide-element": "src/page-slide/element.ts",
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
  },
});
