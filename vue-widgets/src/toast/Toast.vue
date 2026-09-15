<script setup lang="ts">
// yona.ui.Toast.js(+ yona.Common.js의 notify())를 Vue 3 Composition API + TypeScript
// SFC로 다시 작성한 파일럿.
//
// 원본 API: `new yona.ui.Toast("#container")`가 돌려주는 `{ push(message, duration),
// clear() }`를 사이트 전역에서 단 하나(yona.Common.js의 notify()가 지연 생성하는 싱글턴)
// 만들어 쓴다. 이 컴포넌트도 같은 계약을 defineExpose(push/clear)로 그대로 제공한다 -
// `el.push(message, duration, title)`/`el.clear()`.
//
// 원본과 의도적으로 다른 점:
// - push/제거 애니메이션(투명도 0 -> 1로 켜기, nDuration 뒤 0으로 줄이고
//   webkitTransitionEnd에서 remove())을 Vue의 <TransitionGroup>으로 대체했다 - 배열에서
//   항목을 넣고 빼는 것만으로 진입/퇴장 트랜지션이 자동으로 재생된다(수동 opacity 조작 +
//   전환 종료 이벤트 리스닝이 필요 없음). webkitTransitionEnd는 표준 이벤트가 아니라
//   원본에서도 사실상 레거시 호환용이었다 - 새로 쓰는 표준 API로 교체.
// - 클릭으로 닫을 때도(원본은 즉시 제거, 페이드 없음) 나머지와 동일한 0.3초 페이드아웃을
//   적용한다 - TransitionGroup이 배열에서 빠지는 모든 항목에 동일하게 leave 트랜지션을
//   적용하는 것을 그대로 살렸다(사용자 경험상 더 자연스럽고, 굳이 이 항목만 트랜지션을
//   우회하는 추가 로직을 둘 만큼 원본 동작이 중요한 계약은 아니라고 판단).
// - clear()도 배열을 통째로 비우는 것만으로 구현했다 - TransitionGroup이 각 항목의
//   퇴장 트랜지션을 동시에 재생한다(원본은 즉시 사라짐 - 이 역시 위와 같은 이유로
//   허용 가능한 차이로 봤다).
// - message/title 포맷팅(줄바꿈 -> <br>, title 굵게 처리)은 format.ts의 순수 함수
//   toastHtml()로 뽑아 단위 테스트했다.
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
/* yona.css의 .yonaToasts/.toast* (10363~10412행) 그대로 이식 - 다만 `opacity: 90 / 100`
   (원본 10382행)은 CSS 표준상 유효하지 않은 값(나눗셈 표현식은 calc() 밖에서 쓸 수 없다)이라
   모든 브라우저가 이 선언 자체를 무시한다(죽은 규칙, 실측 확인) - 옮기지 않았다. */
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
  color: black;
  font-size: 25px;
  font-weight: bold;
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

/* Vue TransitionGroup 진입/퇴장(원본의 opacity 0->1 켜기, nDuration 뒤 0으로 줄이며
   페이드아웃 - transition-duration: 0.3s는 원본 -webkit-transition-duration과 동일 값). */
.yona-toast-enter-active,
.yona-toast-leave-active {
  transition: opacity 0.3s;
}
.yona-toast-enter-from,
.yona-toast-leave-to {
  opacity: 0;
}
</style>
