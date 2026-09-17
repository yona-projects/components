<script setup lang="ts">
// yona.ui.Switch.js(vanilla, bootstrap-switch.js 대체)를 옮긴 버전. 유일한
// 실사용처는 user/edit_notifications.html의 알림 on/off 토글.
//
// 원본과 마찬가지로 실제 체크박스가 "진실의 원천"이다 - service/yona.user.Setting.js가
// `document.querySelectorAll(".notiUpdate")`로 체크박스를 직접 찾아 change 리스너를
// 붙이므로, 체크박스는 반드시 커스텀 엘리먼트의 라이트 DOM 자식으로 남아있어야
// 외부에서 계속 찾을 수 있다. `<slot>`으로 프로젝션하고 `assignedElements()`로 실제
// 노드를 얻어 checked/disabled를 읽고 change를 걸고 dispatch한다.
import { ref } from "vue";

withDefaults(
  defineProps<{
    onLabel?: string;
    offLabel?: string;
  }>(),
  {
    onLabel: "ON",
    offLabel: "OFF",
  },
);

const slotRef = ref<HTMLSlotElement | null>(null);
const checked = ref(false);
const disabled = ref(false);

function getCheckbox(): HTMLInputElement | null {
  const assigned = slotRef.value?.assignedElements?.() ?? [];
  const found = assigned.find(
    (el): el is HTMLInputElement => el.tagName === "INPUT" && (el as HTMLInputElement).type === "checkbox",
  );
  return found ?? null;
}

function syncFromCheckbox(): void {
  const checkbox = getCheckbox();
  if (!checkbox) {
    return;
  }
  checked.value = checkbox.checked;
  disabled.value = checkbox.disabled;
}

function onSlotChange(): void {
  const checkbox = getCheckbox();
  if (checkbox) {
    checkbox.addEventListener("change", syncFromCheckbox);
    syncFromCheckbox();
  }
}

function toggle(): void {
  if (disabled.value) {
    return;
  }
  const checkbox = getCheckbox();
  if (!checkbox) {
    return;
  }
  checkbox.checked = !checkbox.checked;
  checked.value = checkbox.checked;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
}

// 원본 102-108/133행 이하: switch-left/switch-right 클릭, label 클릭이 전부 같은
// 토글로 귀결된다(bootstrap-switch.js 원본과 yona.ui.Switch.js 둘 다 동일).
function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!target.closest(".switch-left, .switch-right, label")) {
    return;
  }
  event.preventDefault();
  toggle();
}

// 원본 94-100/219-234행: 스페이스바(keyCode 32)만 토글한다 - 원본과 동일하게
// keyCode로 판정한다(deprecated지만 evergreen 브라우저에서 여전히 동작 - 동작 동치성이
// 목적이라 굳이 event.code로 바꾸지 않았다).
function onKeydown(event: KeyboardEvent): void {
  if (event.keyCode !== 32) {
    return;
  }
  event.preventDefault();
  toggle();
}
</script>

<template>
  <div
    class="switch has-switch"
    :class="{ deactivate: disabled }"
    tabindex="0"
    role="checkbox"
    :aria-checked="checked ? 'true' : 'false'"
    @click="onClick"
    @keydown="onKeydown"
  >
    <div class="switch-animate" :class="checked ? 'switch-on' : 'switch-off'">
      <slot ref="slotRef" @slotchange="onSlotChange"></slot>
      <span class="switch-left">{{ onLabel }}</span>
      <label>&nbsp;</label>
      <span class="switch-right">{{ offLabel }}</span>
    </div>
  </div>
</template>

<style>
/* host는 기본 display:inline이라 내부 float 레이아웃이 박스 밖으로 새어나가
   옆 <th>와 클릭 영역이 겹치는 버그가 있었다(Playwright로 확인) - .has-switch의
   inline-block을 host에도 반영한다.
   scoped가 아닌 별도 <style>에 두는 이유: Vue의 scoped 변환이 `:host` 뒤에
   `[data-v-xxx]`를 붙이는데, `:host`는 compound selector 맨 앞에만 올 수 있어
   (CSS Shadow DOM 스펙) 그 형태는 무효 셀렉터가 되어 조용히 적용되지 않는다
   (실측 확인). 같은 이유로 체크박스 숨김 규칙도 scoped 블록의 `:slotted()`(단일
   콜론, scoped 안에서만 `::slotted()`로 변환됨)로 두면 컴파일 결과에서 사라져
   여기로 옮겼다 - 이 블록은 변환을 거치지 않으므로 표준 `::slotted()`(이중
   콜론)를 직접 써야 한다. */
:host {
  display: inline-block;
}
.switch.has-switch ::slotted(input[type="checkbox"]) {
  display: none;
}
</style>

<style scoped>
/* yona.css:11077-11193 (Flat UI Free, CC BY 3.0 / MIT) 그대로 이식 - 이 위젯은
   전부 Shadow DOM 안에서 렌더링되므로(라이트 DOM은 슬롯된 체크박스뿐) 전역 CSS가
   전혀 닿지 않는다. mask 이미지 경로만 원본의 상대경로(../images/...)를 사이트
   루트 기준 절대경로(/images/...)로 바꿨다 - 이 번들은 yona.css와 다른 위치
   (javascripts/lib/yona-vue-widgets/)에서 서빙되어 상대경로가 깨진다. */
.switch.has-switch {
  border-radius: 30px;
  display: inline-block;
  cursor: pointer;
  line-height: 1.231;
  overflow: hidden;
  position: relative;
  text-align: left;
  width: 80px;
  -webkit-mask: url("/images/switch-mask.png") 0 0 no-repeat;
  mask: url("/images/switch-mask.png") 0 0 no-repeat;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -o-user-select: none;
  user-select: none;
}
.switch.has-switch.deactivate {
  opacity: 0.5;
  cursor: default !important;
}
.switch.has-switch.deactivate label,
.switch.has-switch.deactivate span {
  cursor: default !important;
}
.switch.has-switch > div {
  width: 162%;
  position: relative;
  top: 0;
}
.switch.has-switch > div.switch-animate {
  -webkit-transition: left 0.25s ease-out;
  -moz-transition: left 0.25s ease-out;
  -o-transition: left 0.25s ease-out;
  transition: left 0.25s ease-out;
  -webkit-backface-visibility: hidden;
}
.switch.has-switch > div.switch-off {
  left: -63%;
}
.switch.has-switch > div.switch-off label {
  background-color: #fff;
  border-color: #fd6956;
  -webkit-box-shadow: -1px 0 0 rgba(255, 255, 255, 0.5);
  -moz-box-shadow: -1px 0 0 rgba(255, 255, 255, 0.5);
  box-shadow: -1px 0 0 rgba(255, 255, 255, 0.5);
}
.switch.has-switch > div.switch-on {
  left: 0%;
}
.switch.has-switch > div.switch-on label {
  background-color: #fff;
}
.switch.has-switch span {
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  float: left;
  height: 29px;
  line-height: 19px;
  margin: 0;
  padding-bottom: 6px;
  padding-top: 5px;
  position: relative;
  text-align: center;
  width: 50%;
  z-index: 1;
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  -webkit-transition: 0.25s ease-out;
  -moz-transition: 0.25s ease-out;
  -o-transition: 0.25s ease-out;
  transition: 0.25s ease-out;
  -webkit-backface-visibility: hidden;
}
.switch.has-switch span.switch-left {
  border-radius: 30px 0 0 30px;
  background-color: #b6da54;
  color: #fff;
  border-left: 1px solid transparent;
}
.switch.has-switch span.switch-left:hover {
  background-color: #a3ce2d;
}
.switch.has-switch span.switch-right {
  border-radius: 0 30px 30px 0;
  background-color: #fd6956;
  color: #fff;
  text-indent: 5px;
}
.switch.has-switch span.switch-right:hover {
  background-color: #fc3c24;
}
.switch.has-switch label {
  border: 4px solid #b6da54;
  border-radius: 50%;
  float: left;
  height: 21px;
  margin: 0 -15px 0 -14px;
  padding: 0;
  position: relative;
  vertical-align: middle;
  width: 21px;
  z-index: 100;
  -webkit-transition: 0.25s ease-out;
  -moz-transition: 0.25s ease-out;
  -o-transition: 0.25s ease-out;
  transition: 0.25s ease-out;
  -webkit-backface-visibility: hidden;
}
</style>
