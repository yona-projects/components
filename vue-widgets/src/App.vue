<script setup lang="ts">
// 개발 서버(`npm run dev`)/데모 하네스 - 두 위젯을 한 페이지에 같이 마운트한다(원본
// yona 화면에서도 markdownEditor 프래그먼트 옆에 help/markdown 프래그먼트가 나란히 있는
// 것과 같은 배치 - editor2/help-markdown README 참고).
import { ref } from "vue";
import YonaMarkdownEditor from "./editor/YonaMarkdownEditor.vue";
import MarkdownHelp from "./help-markdown/MarkdownHelp.vue";

const text = ref("");
const editorRef = ref<InstanceType<typeof YonaMarkdownEditor> | null>(null);

// smoke-test/editor-toolbar.mjs가 커스텀 엘리먼트처럼 `document.querySelector(...).value`로
// 값을 주고받을 수 없으므로(Vue 컴포넌트 인스턴스는 DOM 노드가 아니다), defineExpose된
// getValue/setValue를 전역에 노출해 테스트가 접근할 수 있게 한다 - 어디까지나 테스트
// 편의용이며 실제 사용처에서는 필요 없다(v-model만으로 충분).
if (typeof window !== "undefined") {
  (window as unknown as { __yonaEditor: typeof editorRef }).__yonaEditor = editorRef;
}
</script>

<template>
  <div style="max-width: 900px; margin: 24px auto; font-family: sans-serif;">
    <h2>마크다운 에디터</h2>
    <div id="target">
      <YonaMarkdownEditor ref="editorRef" name="body" v-model="text" />
    </div>

    <h2 style="margin-top: 32px;">마크다운 도움말</h2>
    <MarkdownHelp />
  </div>
</template>
