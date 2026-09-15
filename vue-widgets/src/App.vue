<script setup lang="ts">
// 개발 서버(`npm run dev`)/데모 하네스 - 위젯들을 한 페이지에 같이 마운트한다(마크다운
// 에디터+도움말 패널은 원본 yona 화면에서도 markdownEditor 프래그먼트 옆에 help/markdown
// 프래그먼트가 나란히 있는 것과 같은 배치 - editor2/help-markdown README 참고. 토스트는
// 원본도 사이트 전역에 딱 하나만 두고 다른 어디서든 push()를 호출하는 싱글턴 위젯이라
// 이 데모에서도 버튼으로 트리거해보는 형태로 둔다).
import { ref } from "vue";
import YonaMarkdownEditor from "./editor/YonaMarkdownEditor.vue";
import MarkdownHelp from "./help-markdown/MarkdownHelp.vue";
import Toast from "./toast/Toast.vue";
import YonaSwitch from "./switch/YonaSwitch.vue";

const text = ref("");
const editorRef = ref<InstanceType<typeof YonaMarkdownEditor> | null>(null);
const toastRef = ref<InstanceType<typeof Toast> | null>(null);

// smoke-test/editor-toolbar.mjs가 커스텀 엘리먼트처럼 `document.querySelector(...).value`로
// 값을 주고받을 수 없으므로(Vue 컴포넌트 인스턴스는 DOM 노드가 아니다), defineExpose된
// getValue/setValue(+ toast의 push/clear)를 전역에 노출해 테스트가 접근할 수 있게 한다 -
// 어디까지나 테스트 편의용이며 실제 사용처에서는 필요 없다.
if (typeof window !== "undefined") {
  (window as unknown as { __yonaEditor: typeof editorRef; __yonaToast: typeof toastRef }).__yonaEditor = editorRef;
  (window as unknown as { __yonaToast: typeof toastRef }).__yonaToast = toastRef;
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

    <h2 style="margin-top: 32px;">토스트</h2>
    <button type="button" @click="toastRef?.push('저장되었습니다', 3000)">3초짜리 토스트</button>
    <button type="button" @click="toastRef?.push('닫기 전까지 유지됩니다', 0, '알림')">제목 있는 영구 토스트</button>
    <Toast ref="toastRef" />

    <h2 style="margin-top: 32px;">스위치</h2>
    <YonaSwitch on-label="On" off-label="Off">
      <input class="notiUpdate" type="checkbox" checked />
    </YonaSwitch>
  </div>
</template>
