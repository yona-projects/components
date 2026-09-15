<script setup lang="ts">
// yona.ScrollElevator.js(common/, jquery.elevator.js를 대체한 vanilla 구현)를 Vue 3
// SFC로 다시 쓴 버전 - "맨 위로/맨 아래로 스크롤" 버튼. 원본도 이미 document.body에
// 프로그래밍적으로 마운트하는 위젯(Toast와 동일 계열)이었다.
//
// **<Teleport to="body"> 사용 이유(review-form/login-dialog와 동일한 이유 - CSS 포팅
// 회피)**: 이 위젯의 시각 스타일은 전부 jquery.elevator.css(413줄, board/view.html·
// issue/view.html이 각자 <link>로 로드하는 서드파티 플러그인 CSS - yona.css가 아님)에
// 있다. Shadow DOM에 그대로 두면(Toast처럼) 이 CSS 전체를 이식해야 했다 - Teleport로
// 옮기면 host 페이지가 이미 로드해둔 jquery.elevator.css를 그대로 상속받아 포팅이
// 전혀 필요 없다. 원본도 어차피 document.body에 직접 append하던 위젯이라 위치상
// 손실도 없다.
import { onMounted, onUnmounted, reactive, ref, useHost } from "vue";

type SizeClass = "jq-big" | "jq-mid" | "jq-sml";

const host = useHost();

const align = ref("bottom right");
const shape = ref("rounded");
const glass = ref(false);
const tooltips = ref(false);
const isTouch = ref(false);
let margin = 100;

const state = reactive<{ topSize: SizeClass; bottomSize: SizeClass }>({
  topSize: "jq-mid",
  bottomSize: "jq-mid",
});

function alignClasses(): string[] {
  return align.value
    .split(" ")
    .filter(Boolean)
    .map((token) => `align-${token}`);
}

function atTop(): boolean {
  return window.scrollY <= margin;
}
function atBottom(): boolean {
  return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - margin;
}

function refreshSizeClasses(): void {
  if (atTop()) {
    state.topSize = "jq-sml";
    state.bottomSize = "jq-big";
  } else if (atBottom()) {
    state.topSize = "jq-big";
    state.bottomSize = "jq-sml";
  } else {
    state.topSize = "jq-mid";
    state.bottomSize = "jq-mid";
  }
}

function onTopClick(event: Event): void {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function onBottomClick(event: Event): void {
  event.preventDefault();
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
}

function destroy(): void {
  document.removeEventListener("scroll", refreshSizeClasses);
}

onMounted(() => {
  if (host) {
    align.value = host.getAttribute("data-align") ?? align.value;
    shape.value = host.getAttribute("data-shape") ?? shape.value;
    glass.value = host.getAttribute("data-glass") === "true";
    tooltips.value = host.getAttribute("data-tooltips") === "true";
    const marginAttr = host.getAttribute("data-margin");
    if (marginAttr) {
      margin = Number(marginAttr);
    }
  }
  isTouch.value = "ontouchstart" in window || !!(navigator as unknown as { msMaxTouchPoints?: number }).msMaxTouchPoints;

  // 원본과 동일하게 document(window가 아님)에 scroll 리스너를 붙인다.
  document.addEventListener("scroll", refreshSizeClasses);
  refreshSizeClasses();
});
onUnmounted(destroy);

defineExpose({ destroy });
</script>

<template>
  <Teleport to="body">
    <div class="jq-elevator" :class="[...alignClasses(), shape, { glass: glass, touch: isTouch }]">
      <a href="#" class="jq-top" :class="state.topSize" :title="!tooltips ? 'Move to Top' : undefined" @click="onTopClick">
        &#9650;<span v-if="tooltips" class="jq-title">Move to Top</span>
      </a>
      <a href="#" class="jq-bottom" :class="state.bottomSize" :title="!tooltips ? 'Move to Bottom' : undefined" @click="onBottomClick">
        &#9660;<span v-if="tooltips" class="jq-title">Move to Bottom</span>
      </a>
    </div>
  </Teleport>
</template>
