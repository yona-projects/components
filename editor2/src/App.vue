<script setup lang="ts">
// 개발 서버(`npm run dev`)/스모크 테스트용 데모 하네스. 원본(components/editor)의
// smoke-test/toolbar.html이 정적 HTML에 <yona-markdown-editor>를 그냥 박아넣을 수 있었던
// 것과 달리, Vue 컴포넌트는 Vue 앱 트리 안에서만 마운트할 수 있으므로 이 App.vue가 그
// 진입점 역할을 한다.
import { ref } from "vue";
import YonaMarkdownEditor from "./YonaMarkdownEditor.vue";

const text = ref("");
const editorRef = ref<InstanceType<typeof YonaMarkdownEditor> | null>(null);

// Playwright 스모크 테스트(smoke-test/toolbar.mjs)가 커스텀 엘리먼트처럼
// `document.querySelector(...).value`로 값을 주고받을 수 없으므로(Vue 컴포넌트 인스턴스는
// DOM 노드가 아니다), defineExpose된 getValue/setValue를 전역에 노출해 테스트가 접근할 수
// 있게 한다 - 어디까지나 테스트 편의용이며 실제 사용처에서는 필요 없다(v-model만으로 충분).
if (typeof window !== "undefined") {
  (window as unknown as { __yonaEditor: typeof editorRef }).__yonaEditor = editorRef;
}
</script>

<template>
  <div id="target">
    <YonaMarkdownEditor ref="editorRef" name="body" v-model="text" />
  </div>
</template>
