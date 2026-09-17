<script setup lang="ts">
// yona.twoColumnMode.js(service/)의 _pageslide* 부분(jquery.pageslide.js 대체)만
// 옮긴 패널 위젯이다. 체크박스 상태 저장, 제목 클릭 델리게이트, 하이라이트,
// history.pushState, NProgress 등 "2열 모드" 페이지 오케스트레이션은 어댑터 쪽
// 소관이라 옮기지 않았다 - 이 컴포넌트는 패널 자체(show/hide/isVisible)만 담당한다.
//
// 원본은 `#pageslide` id 선택자의 yona.css 스타일에 의존하므로, 인라인 :style로
// 그대로 재현해 전역 CSS 의존을 없앴다.
//
// 주의: host 엘리먼트에 id="pageslide"를 그대로 주면 yona.css의 전역
// `#pageslide { display: none; }`이 host 자체에 적용돼 shadow 트리 전체가
// 렌더링되지 않는다(기능은 동작하지만 화면엔 안 보임). `display: contents`로
// 덮어써도 Vue가 style 병합 대상으로 감지해 안쪽 :style과 섞여버려 소용없다 -
// 어댑터가 host에 이 id를 주지 말고 클로저 변수로 엘리먼트를 캐싱해야 한다.
import { ref } from "vue";

const visible = ref(false);
const direction = ref<"left" | "right">("left");
const iframeSrc = ref("");
const iframeKey = ref(0);

let openTimer: ReturnType<typeof setTimeout> | undefined;

// 원본 _pageslideOpen: 기존 iframe은 즉시 제거하고, 새 iframe은 300ms 뒤에 채운다.
function show(href: string, dir: "left" | "right" = "left"): void {
  if (openTimer) {
    clearTimeout(openTimer);
  }
  iframeSrc.value = "";
  iframeKey.value++;
  direction.value = dir;
  visible.value = true;

  openTimer = setTimeout(() => {
    iframeSrc.value = href;
  }, 300);
}

function hide(): void {
  if (openTimer) {
    clearTimeout(openTimer);
    openTimer = undefined;
  }
  visible.value = false;
}

function isVisible(): boolean {
  return visible.value;
}

defineExpose({ show, hide, isVisible });
</script>

<template>
  <div
    v-if="visible"
    :style="{
      display: 'block',
      position: 'fixed',
      top: '0',
      height: '100%',
      zIndex: 999999,
      width: '50%',
      padding: '0',
      boxShadow: '2px 2px 8px #000',
      background: `#FFF url('/images/loading-gif-2.gif') no-repeat center`,
      left: direction === 'left' ? 'auto' : '0px',
      right: direction === 'left' ? '0px' : 'auto',
    }"
  >
    <iframe
      v-if="iframeSrc"
      :key="iframeKey"
      allowtransparency="true"
      frameborder="0"
      hspace="0"
      style="width: 100%; height: 100%"
      :src="iframeSrc"
    ></iframe>
  </div>
</template>
