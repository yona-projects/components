<script setup lang="ts">
// 개발 서버(`npm run dev`)/데모 하네스 - 실제 화면에서는 이 컴포넌트가 markdownEditor
// 프래그먼트 옆에 놓이지만(help/markdown.html 참고), 독립 검증용으로는 그냥 단독 마운트.
import MarkdownHelp from "./MarkdownHelp.vue";
</script>

<template>
  <div style="max-width: 900px; margin: 24px auto; font-family: sans-serif;">
    <MarkdownHelp />
  </div>
</template>
