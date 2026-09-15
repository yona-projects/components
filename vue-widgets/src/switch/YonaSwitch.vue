<script setup lang="ts">
// yona.ui.Switch.js(vanilla, bootstrap-switch.js 대체)를 Vue 3 Composition API + TS
// SFC로 다시 쓴 버전. 유일한 실사용처는 user/edit_notifications.html의 알림 on/off
// 토글(`<div class="switch" data-on-label="On" data-off-label="Off"><input
// class="notiUpdate" type="checkbox" data-toggle="switch" ...></div>`).
//
// 원본과 마찬가지로 실제 체크박스가 "진실의 원천"이다 - 이 컴포넌트는 체크박스를
// 대신하지 않고 시각적 스위치 껍데기로 감쌀 뿐이다. service/yona.user.Setting.js가
// `document.querySelectorAll(".notiUpdate")`로 체크박스를 직접 찾아 `change` 리스너를
// 붙이므로, 체크박스는 반드시 커스텀 엘리먼트의 라이트 DOM 자식으로 남아있어야
// 외부에서 계속 찾을 수 있다(에디터 위젯에서 발견한 Shadow DOM 검색 불가 문제와
// 동일한 이유). `<slot>`으로 라이트 DOM 체크박스를 그대로 프로젝션하고, 그 실제 노드는
// `slotRef.value.assignedElements()`로 얻어와 checked/disabled를 읽고 change 이벤트를
// 걸고 dispatch한다 - element.ts에 별도 wrapper 클래스를 두지 않고 SFC 안에서 전부
// 처리할 수 있다(Vue 공식 문서의 커스텀 엘리먼트 라이트 DOM 접근 패턴).
//
// 원본과 의도적으로 다른 점 없음 - 드래그 슬라이드 애니메이션 미이식은 이미
// yona.ui.Switch.js 헤더 주석에 문서화된 결정을 그대로 계승한다(CSS transition만으로
// 충분).
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
/* 커스텀 엘리먼트 호스트 자체는 스타일이 전혀 없으면 브라우저 기본값인
   display:inline으로 렌더링된다 - 실제 대치 검증(Playwright)에서 발견: 내부의
   float 레이아웃(.switch-left/.switch-right)이 inline 호스트의 박스 바깥으로
   새어나가 옆 테이블 셀(<th>)과 클릭 영역이 겹치는 실제 레이아웃 버그가 있었다.
   원본 .has-switch(아래)의 display: inline-block을 호스트 자신에도 그대로
   반영해야 한다.
   이 규칙만 scoped 없는 별도 <style> 블록에 둔 이유: Vue의 scoped CSS 변환이
   `:host`를 그대로 두지 않고 `[data-v-xxx]:host`로 속성 셀렉터를 앞에 붙이는데,
   `:host`는 반드시 compound selector의 맨 앞에 와야 하는 규칙(CSS Shadow DOM
   스펙)이라 이 형태는 아예 매치되지 않는 무효 셀렉터가 된다(customElement 빌드로
   실제 대치했을 때 :host 규칙이 조용히 적용되지 않는 것으로 실측 확인) - scoped을
   빼면 변환 없이 `:host{...}` 그대로 나가 정상 동작한다. 같은 이유로 아래 체크박스
   숨김 규칙도 scoped 블록의 Vue 전용 `:slotted()`(단일 콜론 - scoped 블록 안에서만
   `::slotted()`로 변환된다)로 두면 컴파일된 CSS에서 통째로 사라지는 것을 실측
   확인해(라이트 DOM 체크박스가 숨겨지지 않아 float 레이아웃이 옆 테이블 셀까지
   밀려나는 클릭 영역 겹침 버그로 이어짐) 여기로 옮겼다 - 단, 이 블록은 scoped가
   아니라 변환을 안 거치므로 표준 CSS 문법인 `::slotted()`(이중 콜론)를 직접 써야
   한다(단일 콜론은 변환되지 않은 채 그대로 나가 무효 셀렉터가 된다 - 이 역시
   빌드 시 lightningcss 경고로 실측). */
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
