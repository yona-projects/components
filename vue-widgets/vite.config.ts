import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 데모 앱(App.vue) 빌드용 설정. yona에 실제로 반영하는 커스텀 엘리먼트 빌드는
// vite.element.config.ts 쪽을 쓴다.
export default defineConfig({
  plugins: [vue()],
  base: "./",
});
