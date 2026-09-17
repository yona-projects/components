<script setup lang="ts">
// 개발 서버/데모 하네스. 원본 yona 화면에서도 토스트는 사이트 전역에 하나만 두고
// 어디서든 push()를 호출하는 싱글턴 위젯이라, 여기서도 버튼으로 트리거하는 형태로 둔다.
import { ref } from "vue";
import YonaMarkdownEditor from "./editor/YonaMarkdownEditor.vue";
import MarkdownHelp from "./help-markdown/MarkdownHelp.vue";
import Toast from "./toast/Toast.vue";
import YonaSwitch from "./switch/YonaSwitch.vue";

const text = ref("");
const editorRef = ref<InstanceType<typeof YonaMarkdownEditor> | null>(null);
const toastRef = ref<InstanceType<typeof Toast> | null>(null);

// Vue 컴포넌트 인스턴스는 DOM 노드가 아니라 document.querySelector(...).value로 접근할 수 없다.
// 테스트가 접근할 수 있도록 defineExpose된 값을 전역에 노출한다(테스트 편의용, 실사용처엔 불필요).
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
