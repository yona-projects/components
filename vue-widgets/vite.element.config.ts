import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// es 포맷 멀티 엔트리 빌드 - 여러 위젯을 한 번의 build 호출로, Vue 런타임을 공유 청크로
// 묶어서 번들링한다. 대가는 yona 쪽 <script> 태그에 type="module"이 필요하다는 것.
export default defineConfig({
  plugins: [
    vue({
      customElement: /(YonaMarkdownEditor|MarkdownHelp|Toast|YonaSwitch|YonaDropdown|YonaDialog|YonaTypeahead|YonaAttachments|YonaReviewForm|YonaPagination|YonaLoginDialog|YonaScrollElevator|YonaPageSlide|YonaPopover|YonaNewLabelForm|YonaCategoryEditDialog|YonaLabelEditDialog)\.vue$/,
    }),
  ],
  // 라이브러리 빌드는 Vue 런타임의 `process.env.NODE_ENV` 참조를 자동 치환해주지 않아
  // 직접 치환하지 않으면 브라우저에서 "process is not defined"로 죽는다.
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
        "yona-popover-element": "src/popover/element.ts",
        "yona-new-label-form-element": "src/label-editor/new-label-form-element.ts",
        "yona-category-edit-dialog-element": "src/label-editor/category-edit-dialog-element.ts",
        "yona-label-edit-dialog-element": "src/label-editor/label-edit-dialog-element.ts",
        // Vue 커스텀 엘리먼트가 아니라 페이지 위임 리스너 모듈(#labelsList 클릭 위임 +
        // 커스텀 엘리먼트 호출) - customElement 컴파일 대상이 아닌 일반 ESM으로 번들된다.
        "yona-label-list-adapter": "src/label-editor/list-adapter.ts",
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
  },
});
