import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// `npm run build`(vite.config.ts)는 라이브러리 모드로 YonaMarkdownEditor.vue만 내보내고
// vue를 peer로 외부화한다 - npm 소비자를 위한 배포용. 이 설정은 그 반대로, index.html을
// 진입점으로 삼아 Vue 런타임까지 전부 포함한 완결된 정적 페이지를 만든다(빌드 도구 없는
// 곳에 그냥 파일로 올려서 열어볼 수 있는 데모/스모크 검증용 - yona 벤더링 확인이 그 예).
export default defineConfig({
  plugins: [vue()],
  base: "./",
  build: {
    outDir: "dist-demo",
  },
});
