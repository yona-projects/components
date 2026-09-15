<script setup lang="ts">
// yona.Common.js의 툴팁/팝오버 플로팅 위치 시스템(showTooltip/hideTooltip,
// showPopoverError/hidePopoverError, initHoverPopovers) 세 계약을 하나의 싱글턴
// 위젯으로 다시 썼다 - 셋 다 내부적으로 같은 위치 계산(_positionPopoverElement/
// _getPopoverContainer)을 공유한다는 원본 주석을 그대로 따른 통합이다.
//
// **범위 - 트리거는 이 위젯 소유가 아니다**: `showTooltip`/`hideTooltip`은
// site/layout.html의 전역 mouseenter/mouseleave/focus/blur 델리게이트가
// `[data-toggle="tooltip"]`을 찾아 호출한다(Dropdown과 동일한 "전역 델리게이트가
// 트리거를 소유"하는 경계 판단) - 이 위젯은 호출받으면 그릴 뿐, 트리거 스캔 자체는
// 페이지(어댑터) 쪽에 그대로 남는다. `initHoverPopovers(selector)`만 예외적으로
// 스스로 리스너를 붙이는데(원본도 그랬다), 그것도 "찾아서 붙인다"일 뿐 위젯
// 외부의 다른 요소를 조작하지는 않는다.
//
// **`<Teleport>`를 동적 대상으로 사용 - CSS 포팅 회피 + dialog-awareness 동시
// 해결**: 원본이 `.tooltip`/`.popover`(bootstrap.css) 마크업을 그대로 쓰므로
// Shadow DOM에 두면 그 전역 CSS 전체를 이식해야 했다 - Teleport로 실제 라이트
// DOM에 그리면 이식이 전혀 필요 없다. 게다가 원본의 `_getPopoverContainer`가
// "트리거가 열린 `<dialog>` 안에 있으면 그 dialog를 부모로 써야 한다"(네이티브
// `<dialog>`는 top layer에서 그려져 일반 z-index로는 못 이긴다)는 요구사항도
// Teleport의 `:to`를 트리거마다 동적으로(body 또는 그 dialog) 바꾸는 것만으로
// 자연스럽게 해결된다.
//
// **id를 host에 주지 않는다**: page-slide에서 실측으로 확인한 함정("하위 호환을
// 위해 원본과 같은 id를 host에 주면 그 id를 겨냥한 전역 CSS와 충돌할 수 있다")을
// 이번엔 처음부터 피한다 - 어댑터가 클로저 변수로 싱글턴 엘리먼트를 캐싱한다.
import { nextTick, reactive } from "vue";
import { computeContainerRelativeOffset, computeFloatPosition } from "./popover";

interface FloatItem {
  id: number;
  skin: "tooltip" | "popover";
  content: string;
  title: string;
  html: boolean;
  placement: string;
  container: HTMLElement;
  top: number;
  left: number;
  visible: boolean;
}

const floats = reactive<FloatItem[]>([]);
let nextId = 1;

const tooltipMap = new WeakMap<HTMLElement, FloatItem>();
const popoverMap = new WeakMap<HTMLElement, FloatItem>();
const hoverMap = new WeakMap<HTMLElement, FloatItem>();

function getPopoverContainer(trigger: HTMLElement): HTMLElement {
  const dialog = trigger.closest("dialog[open]") as HTMLElement | null;
  return dialog || document.body;
}

function findFloatEl(id: number): HTMLElement | null {
  return document.querySelector(`[data-yona-popover-id="${id}"]`);
}

async function addFloat(
  trigger: HTMLElement,
  skin: "tooltip" | "popover",
  content: string,
  title: string,
  placement: string,
  html: boolean,
): Promise<FloatItem> {
  const container = getPopoverContainer(trigger);
  const item = reactive({
    id: nextId++,
    skin,
    content,
    title,
    html,
    placement,
    container,
    top: 0,
    left: 0,
    visible: false,
  }) as FloatItem;
  floats.push(item);

  await nextTick();
  const el = findFloatEl(item.id);
  if (el) {
    const triggerRect = trigger.getBoundingClientRect();
    const containerArg = container === document.body ? "body" : container.getBoundingClientRect();
    const offset = computeContainerRelativeOffset(triggerRect, containerArg, { x: window.pageXOffset, y: window.pageYOffset });
    const pos = computeFloatPosition(
      offset,
      { width: triggerRect.width, height: triggerRect.height },
      { width: el.offsetWidth, height: el.offsetHeight },
      placement,
    );
    item.top = pos.top;
    item.left = pos.left;
  }
  item.visible = true;
  return item;
}

function removeImmediate(item: FloatItem): void {
  const idx = floats.indexOf(item);
  if (idx > -1) {
    floats.splice(idx, 1);
  }
}

// 원본 hideTooltip: fade-out 트랜지션이 끝난 뒤(폴백 500ms) 제거한다 - popover류의
// 즉시 제거와 다른, 툴팁만의 동작이라 그대로 재현.
function fadeOutAndRemove(item: FloatItem): void {
  item.visible = false;
  nextTick(() => {
    const el = findFloatEl(item.id);
    if (!el) {
      removeImmediate(item);
      return;
    }
    const removeTimeout = setTimeout(() => removeImmediate(item), 500);
    el.addEventListener(
      "transitionend",
      () => {
        clearTimeout(removeTimeout);
        removeImmediate(item);
      },
      { once: true },
    );
  });
}

// 원본 _fixTooltipTitle: title 속성을 최초 1회만 data-original-title로 옮긴다.
function fixTooltipTitle(trigger: HTMLElement): void {
  if (trigger.getAttribute("data-original-title") === null) {
    trigger.setAttribute("data-original-title", trigger.getAttribute("title") || "");
    trigger.setAttribute("title", "");
  }
}

function showTooltip(trigger: HTMLElement): void {
  if (!trigger || tooltipMap.has(trigger)) {
    return;
  }
  fixTooltipTitle(trigger);
  const title = trigger.getAttribute("data-original-title") || "";
  if (!title) {
    return;
  }
  const placement = trigger.getAttribute("data-placement") || "top";
  const html = trigger.getAttribute("data-html") === "true";
  addFloat(trigger, "tooltip", title, "", placement, html).then((item) => {
    tooltipMap.set(trigger, item);
  });
}

function hideTooltip(trigger: HTMLElement): void {
  const item = trigger && tooltipMap.get(trigger);
  if (!item) {
    return;
  }
  tooltipMap.delete(trigger);
  fadeOutAndRemove(item);
}

function showPopoverError(target: HTMLElement, message: string, placement?: string): void {
  hidePopoverError(target);
  addFloat(target, "popover", message, "", placement || "left", false).then((item) => {
    popoverMap.set(target, item);
  });
}

function hidePopoverError(target: HTMLElement): void {
  const item = target && popoverMap.get(target);
  if (item) {
    popoverMap.delete(target);
    removeImmediate(item);
  }
}

function initHoverPopovers(selector: string): void {
  document.querySelectorAll(selector).forEach((el) => {
    const trigger = el as HTMLElement & { _yonaHoverPopoverBound?: boolean };
    if (trigger._yonaHoverPopoverBound) {
      return;
    }
    trigger._yonaHoverPopoverBound = true;

    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    function remove(): void {
      const item = hoverMap.get(trigger);
      if (item) {
        hoverMap.delete(trigger);
        removeImmediate(item);
      }
    }

    trigger.addEventListener("mouseenter", () => {
      clearTimeout(hideTimer);
      showTimer = setTimeout(() => {
        const content = trigger.getAttribute("data-content");
        if (!content) {
          return;
        }
        const title = trigger.getAttribute("data-original-title") || "";
        const placement = trigger.getAttribute("data-placement") || "top";
        remove();
        addFloat(trigger, "popover", content, title, placement, false).then((item) => {
          hoverMap.set(trigger, item);
        });
      }, 100);
    });

    trigger.addEventListener("mouseleave", () => {
      clearTimeout(showTimer);
      hideTimer = setTimeout(remove, 100);
    });
  });
}

defineExpose({ showTooltip, hideTooltip, showPopoverError, hidePopoverError, initHoverPopovers });
</script>

<template>
  <Teleport v-for="item in floats" :key="item.id" :to="item.container">
    <div
      v-if="item.skin === 'tooltip'"
      :data-yona-popover-id="item.id"
      :class="['tooltip', 'fade', item.placement, { in: item.visible }]"
      role="tooltip"
      :style="{ top: item.top + 'px', left: item.left + 'px', display: 'block' }"
    >
      <div class="tooltip-arrow"></div>
      <div v-if="item.html" class="tooltip-inner" v-html="item.content"></div>
      <div v-else class="tooltip-inner">{{ item.content }}</div>
    </div>
    <div
      v-else
      :data-yona-popover-id="item.id"
      :class="['popover', item.placement, { in: item.visible }]"
      :style="{ top: item.top + 'px', left: item.left + 'px', display: 'block' }"
    >
      <div class="arrow"></div>
      <h3 v-if="item.title" class="popover-title">{{ item.title }}</h3>
      <div class="popover-content">{{ item.content }}</div>
    </div>
  </Teleport>
</template>
