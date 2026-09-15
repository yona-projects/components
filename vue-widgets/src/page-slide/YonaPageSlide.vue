<script setup lang="ts">
// yona.twoColumnMode.js(service/)의 _pageslide*(jquery.pageslide.js를 대체한 vanilla
// 구현) 부분만 뽑아 Vue 3 SFC로 다시 쓴 버전 - "2열 모드"에서 게시글 제목을 클릭하면
// 화면 오른쪽에서 슬라이드해 들어오는 iframe 패널이다.
//
// **범위 - 같은 파일의 나머지는 옮기지 않는다**: yona.twoColumnMode.js는 이 패널
// 외에도 twoColumnMode 체크박스 상태 저장(localStorage), 제목 클릭 델리게이트 부착,
// 클릭한 게시글 하이라이트(.post-item.highlightBg), history.pushState 연동,
// NProgress 호출까지 한 파일에 다 있다 - 이건 "2열 모드"라는 페이지 기능 자체의
// 오케스트레이션이지 패널 위젯의 일부가 아니다(review-form에서 트리거 로직을
// yona.code.Diff.js에 그대로 남겨둔 것과 동일한 경계 판단). 이 컴포넌트는 패널
// 자체(show/hide/isVisible)만 담당하고, 나머지는 어댑터(페이지 쪽 vanilla 코드)가
// 그대로 소유한다.
//
// **CSS를 이식하지 않고 인라인 스타일로 직접 재현**: 원본은 `#pageslide`라는 id
// 선택자로 yona.css에 딱 한 번 정의된 스타일(position:fixed/width:50%/box-shadow/
// 배경 로딩 gif)을 쓴다. 이 컴포넌트는 그 값을 그대로 인라인 `:style`로 재현해
// 별도 <style> 블록/전역 CSS 의존 자체가 필요 없게 했다.
//
// **실측 중 발견한 진짜 함정(review-form/login-dialog와 같은 계열 - 어댑터
// 설계 단계에서 미리 피함)**: 어댑터가 하위 호환을 위해 원본처럼
// `document.getElementById("pageslide")`를 계속 지원하려고 이 컴포넌트의
// host에 `id="pageslide"`를 그대로 주면, yona.css의 전역 `#pageslide {
// display: none; ... }` 규칙이 **host 자체**에 그대로 적용돼(내부에서 아무리
// 인라인 스타일을 재현해도 host 자신이 그 id로 display:none이 되면 shadow
// 트리 전체가 렌더링 자체가 안 된다) 기능은 동작하는데(isVisible() true,
// iframe src 정상) 화면에는 전혀 안 보이는 채로 처음 실측에서 재현됐다.
// `display: contents`로 host를 덮어써도 Vue가 host의 style 속성 변경을
// class/style 병합 대상으로 감지해 안쪽 div의 :style과 섞어버리는 2차
// 문제까지 있었다 - 근본 해결은 이 컴포넌트가 아니라 **어댑터가 애초에
// host에 그 id를 주지 않고, 클로저 변수로 엘리먼트를 직접 캐싱**하는 것이다
// (element.ts/어댑터 쪽 커밋 메시지·README 참고). 이 컴포넌트 자신은 CSS
// 충돌과 무관하게 원래 형태 그대로 유지한다.
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
