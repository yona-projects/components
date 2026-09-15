import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 기본 설정 - `npm run dev`는 index.html+App.vue(두 위젯을 나란히 마운트하는 데모)를
// 서빙하고, `npm run build`는 그 데모 앱을 그대로 빌드해 dist/에 정적 산출물을 만든다.
// yona에 실제로 반영하는 커스텀 엘리먼트 빌드는 vite.element.config.ts 쪽을 쓴다.
export default defineConfig({
  plugins: [vue()],
  base: "./",
});
