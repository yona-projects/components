<script setup lang="ts">
// yona.ui.Toast.js(+ yona.Common.js의 notify())를 Vue 3 SFC로 이식.
// 원본과 동일하게 defineExpose(push/clear)로 push(message, duration, title)/clear()
// 계약을 유지한다. 애니메이션은 원본의 수동 opacity 조작 대신 <TransitionGroup>을 쓰며,
// 클릭으로 닫을 때와 clear()도 원본(즉시 제거)과 달리 동일한 페이드아웃을 적용한다
// (의도적 UX 차이 - 계약상 중요하지 않다고 판단).
import { ref } from "vue";
import { toastHtml } from "./format";

interface ToastEntry {
  id: number;
  html: string;
}

const toasts = ref<ToastEntry[]>([]);
let nextId = 0;

function push(message: string, duration?: number, title?: string): void {
  const id = nextId++;
  toasts.value.unshift({ id, html: toastHtml(message, title) });

  if (duration && duration > 0) {
    setTimeout(() => remove(id), duration);
  }
}

function remove(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

function clear(): void {
  toasts.value = [];
}

defineExpose({ push, clear });
</script>

<template>
  <div class="yona-toasts">
    <TransitionGroup name="yona-toast" tag="div">
      <div v-for="toast in toasts" :key="toast.id" class="toast" tabindex="-1" @click="remove(toast.id)">
        <div class="btn-dismiss"><button type="button" class="btn-transparent">&times;</button></div>
        <div class="center-text">
          <span class="v"></span>
          <div class="msg" v-html="toast.html"></div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* yona.css의 .yonaToasts/.toast* 그대로 이식 - 다만 `opacity: 90 / 100`(원본)은
   CSS 표준상 유효하지 않은 값(나눗셈은 calc() 밖에서 쓸 수 없다)이라 모든 브라우저가
   무시하는 죽은 규칙이므로 옮기지 않았다. */
.yona-toasts {
  position: fixed;
  overflow: hidden;
  right: 20px !important;
  bottom: 25px !important;
  margin: 10px;
  z-index: 9999;
}
.toast {
  position: relative;
  width: 450px;
  word-break: keep-all;
  word-wrap: break-word;
  margin: 10px;
  padding: 10px 20px;
  outline: none;
  font-weight: bold;
  box-sizing: border-box;
  color: black;
  background-color: #cddc39;
  box-shadow: 1px 1px 3px black;
  border-radius: 2px;
  cursor: pointer;
}
.btn-dismiss {
  position: absolute;
  top: 5px;
  left: 420px;
}
.btn-dismiss button {
  /* 원본의 class="btn-transparent"(yona.css 전역)를 재현 - 없으면 버튼이 브라우저
     기본 버튼 크롬(흰 박스+테두리)으로 보인다(실제 yona 화면 대조로 발견). */
  background: transparent;
  border: 0;
  outline: none;
  color: black;
  font-size: 25px;
  font-weight: bold;
  cursor: pointer;
}
.v {
  display: inline-block;
  width: 0;
  height: 50px;
  vertical-align: middle;
}
.msg {
  width: 90%;
  font-size: 15px;
  display: inline-block;
  word-wrap: break-word;
  word-break: break-all;
  margin: 0;
  vertical-align: middle;
}

/* 0.3s는 원본 -webkit-transition-duration과 동일 값. */
.yona-toast-enter-active,
.yona-toast-leave-active {
  transition: opacity 0.3s;
}
.yona-toast-enter-from,
.yona-toast-leave-to {
  opacity: 0;
}
</style>
