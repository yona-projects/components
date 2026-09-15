import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 기본 설정 - `npm run dev`는 index.html+App.vue 데모를 서빙하고, `npm run build`는
// (라이브러리 모드가 아니라) 그 데모 앱을 그대로 빌드해 dist/에 정적 산출물을 만든다.
// 이 컴포넌트는 editor2와 달리 npm 라이브러리로 배포할 계획이 없어 별도 lib 모드 설정을
// 두지 않았다 - 실제 yona 반영은 vite.element.config.ts(defineCustomElement)만 쓴다.
export default defineConfig({
  plugins: [vue()],
  base: "./",
});
