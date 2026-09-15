<script setup lang="ts">
// yona.ui.Dialog.js(네이티브 <dialog> + showModal()/close() 기반 사이트 전역 싱글턴
// 모달)를 Vue 3 SFC로 다시 쓴 버전. $yona.alert()/$yona.confirm()이 쓰는 #yonaDialog의
// 실제 대체 대상이다.
//
// 다른 위젯들과 마찬가지로 이 컴포넌트도 전체를 Shadow DOM에 그리지 않는다 - 실제로
// 조사해보니 그러면 안 된다: 버튼 스타일(showConfirm의 aButtonStyles)을 호출부가
// 그때그때 임의의 전역 CSS 클래스(ybtn-info/ybtn-danger 등 사이트 전체 버튼 디자인
// 시스템 아무거나)로 지정하는데, Shadow DOM 안에서는 이 임의 클래스들이 전역 CSS를
// 받지 못한다(그 클래스 전체를 컴포넌트 안에 복제하지 않는 한). 그래서 버튼만
// 명령형으로 만들어 라이트 DOM에 두고 이름 있는 슬롯(slot="buttons")으로 투과시킨다
// (에디터의 light-DOM textarea, 드롭다운의 라이트 DOM 버튼/목록과 동일한 탈출구) -
// 배경(::backdrop)/메시지/설명/닫기 버튼 같은 고정된 나머지 껍데기만 Vue가 Shadow
// DOM에서 소유한다.
//
// Messages()는 messages.js(site/layout.html이 항상 먼저 로드)가 전역으로 노출하는
// i18n 함수다 - 다른 vanilla JS 파일들과 동일하게 그냥 전역으로 호출한다(격리된
// 스모크 테스트 환경처럼 messages.js가 없을 때만 안전하게 폴백한다).
import { useHost, useTemplateRef } from "vue";
import { nl2br } from "../toast/format";

declare function Messages(key: string): string;

interface ShowOptions {
  fOnAfterShow?: () => void;
  fOnAfterHide?: () => void;
  fOnClickButton?: (arg: { weEvt: Event; nButtonIndex: number }) => boolean | void;
  aButtonLabels?: string[];
  aButtonStyles?: string[];
}

const host = useHost();
const dialogRef = useTemplateRef<HTMLDialogElement>("dialogRef");
const messageRef = useTemplateRef<HTMLParagraphElement>("messageRef");
const descriptionRef = useTemplateRef<HTMLParagraphElement>("descriptionRef");

let onAfterHide: (() => void) | null = null;
let onClickButtonCallback: ShowOptions["fOnClickButton"] | null = null;

// 원본 htVar.bAutoFocusOnLastButton은 생성자 옵션이었지만(yona.ui.Dialog.js:55),
// 실제 호출부($yona.alert/$yona.confirm) 어디도 이 옵션을 넘긴 적이 없어(전수 grep
// 확인) 항상 기본값 true였다 - 관측 가능한 동작 변화 없이 상수로 단순화했다.
const AUTO_FOCUS_ON_LAST_BUTTON = true;

function confirmLabel(): string {
  return typeof Messages === "function" ? Messages("button.confirm") : "Confirm";
}

function getButtons(): HTMLElement[] {
  return host ? (Array.from(host.querySelectorAll('[slot="buttons"]')) as HTMLElement[]) : [];
}

function clearButtons(): void {
  getButtons().forEach((el) => el.remove());
}

function createButton(text: string, cssClass: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ybtn " + cssClass;
  button.textContent = text;
  button.setAttribute("slot", "buttons");
  return button;
}

// 원본 _getCustomButtons - aButtonStyles가 없으면 마지막 버튼만 ybtn-primary, 나머지는
// ybtn-default(원본과 동일한 규칙).
function buildButtons(options: ShowOptions): void {
  clearButtons();
  if (!host) {
    return;
  }

  const labels = options.aButtonLabels;
  if (!labels) {
    host.appendChild(createButton(confirmLabel(), "ybtn-info"));
    return;
  }

  const styles = options.aButtonStyles || [];
  labels.forEach((label, i) => {
    const cssClass = styles[i] || (styles.length === 0 && i === labels.length - 1 ? "ybtn-primary" : "ybtn-default");
    host.appendChild(createButton(label, cssClass));
  });
}

// 원본 _onClickButton
function onClickButton(button: HTMLElement, event: MouseEvent): void {
  if (typeof onClickButtonCallback === "function") {
    const result = onClickButtonCallback({ weEvt: event, nButtonIndex: getButtons().indexOf(button) });
    if (result === false) {
      return;
    }
  }
  hide();
}

// 원본 _attachEvent의 단일 click 델리게이트(배경 클릭 -> 버튼 클릭 -> data-dismiss 순).
// 슬롯된 라이트 DOM 버튼의 클릭도 같은 shadow 트리 안의 리스너로 정상 전파된다(스위치/
// 드롭다운에서 이미 검증한 것과 동일한 슬롯 이벤트 전파 메커니즘).
function onDialogClick(event: MouseEvent): void {
  if (event.target === dialogRef.value) {
    hide();
    return;
  }

  const target = event.target as HTMLElement;
  const button = target.closest?.('[slot="buttons"]') as HTMLElement | null;
  if (button) {
    onClickButton(button, event);
    return;
  }

  const dismissEl = target.closest?.('[data-dismiss="modal"]');
  if (dismissEl) {
    hide();
  }
}

// 원본 _onHiddenDialog - 메시지만 지운다(설명은 그대로 유지, 원본과 동일).
function onClose(): void {
  if (messageRef.value) {
    messageRef.value.innerHTML = "";
  }
  if (typeof onAfterHide === "function") {
    onAfterHide();
  }
}

function show(message: string, description?: string, options: ShowOptions = {}): void {
  onAfterHide = options.fOnAfterHide ?? null;
  onClickButtonCallback = options.fOnClickButton ?? null;

  buildButtons(options);
  if (messageRef.value) {
    messageRef.value.innerHTML = nl2br(message);
  }
  if (descriptionRef.value) {
    descriptionRef.value.innerHTML = nl2br(description || "");
  }

  dialogRef.value?.showModal();

  if (typeof options.fOnAfterShow === "function") {
    options.fOnAfterShow();
  }

  if (AUTO_FOCUS_ON_LAST_BUTTON) {
    const buttons = getButtons();
    const primaryButtons = buttons.filter((b) => b.classList.contains("ybtn-primary"));
    const target = primaryButtons.length ? primaryButtons[primaryButtons.length - 1] : buttons[buttons.length - 1];
    target?.focus();
  }
}

function hide(): void {
  dialogRef.value?.close();
}

defineExpose({ show, hide });
</script>

<template>
  <dialog ref="dialogRef" class="modal yonaDialog" @click="onDialogClick" @close="onClose">
    <div class="btn-dismiss"><button type="button" class="btn-transparent" data-dismiss="modal">&times;</button></div>
    <div class="message">
      <div class="center-text">
        <p ref="messageRef" class="msg"></p>
        <p ref="descriptionRef" class="desc"></p>
      </div>
      <div class="center-txt buttons">
        <slot name="buttons"></slot>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* bootstrap.css:5147 .modal + yona.css:10309 .yonaDialog(둘 다 원본 마크업이
   "modal yonaDialog" 두 클래스를 함께 쓴다) 그대로 이식 - 이 위젯은 <dialog> 자체를
   Shadow DOM에서 렌더링하므로(라이트 DOM은 슬롯된 버튼뿐) 전역 CSS가 안 닿는다.
   원본의 `.yonaDialog { border-radius: none; }`는 애초에 무효한 CSS 값(브라우저가
   조용히 무시)이라 .modal의 border-radius: 6px가 그대로 이긴다 - 캐스케이드 결과
   그대로 이식했다(무효 선언 자체는 재현하지 않음, 최종 렌더 결과만 동일하면 된다). */
.modal.yonaDialog {
  position: fixed;
  top: 10%;
  left: 50%;
  z-index: 1050;
  width: 500px;
  margin-left: -250px;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  outline: none;
  box-shadow: 0 3px 7px rgba(0, 0, 0, 0.3);
  background-clip: padding-box;
  padding: 16px 20px;
}
.modal.yonaDialog::backdrop {
  background-color: #000000;
  opacity: 0.8;
}
.btn-dismiss {
  padding: 0;
  margin: 0;
  width: 100%;
  text-align: right;
  display: block;
  clear: both;
}
.btn-dismiss button {
  font-size: 24px;
  font-weight: bold;
  color: #898989;
  border: none;
  background: transparent;
  cursor: pointer;
}
.message .center-text {
  text-align: center;
}
.message .msg {
  text-align: center;
  font-weight: bold;
  font-size: 18px;
  margin-bottom: 20px;
  line-height: 1.5em;
}
.message .desc {
  text-align: center;
  font-weight: normal;
  font-size: 14px;
  margin: 20px 0 25px;
  line-height: 150%;
  color: #555;
}
.message .buttons {
  text-align: center;
}
</style>

<style>
/* ::slotted()는 scoped 블록 안에 두면 Vue의 scoped CSS 변환이 속성 셀렉터를 앞에
   붙여(스위치 위젯에서 :host/:slotted() 둘 다 실측 확인한 것과 동일한 문제) 무효
   셀렉터가 되어 조용히 사라진다 - components/vue-widgets/README.md의 switch 위젯
   절 참고. 그래서 이 규칙만 scoped 없는 별도 블록으로 뺐다. 슬롯된 버튼(전역 .ybtn
   디자인 시스템, 위 헤더 주석 참고)의 색상/여백은 그대로 전역 CSS에 맡기고, 여기서는
   버튼 사이 여백만 최소한으로 보정한다. */
::slotted([slot="buttons"]) {
  margin: 0 4px;
}
</style>
