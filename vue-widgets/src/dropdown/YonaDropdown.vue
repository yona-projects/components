<script setup lang="ts">
// yona.ui.Dropdown.js를 Vue 3 SFC로 다시 쓴 버전.
//
// 다른 위젯과 달리 위젯 전체를 Shadow DOM에 그리지 않는다:
// 1. 드롭다운 열고/닫기는 yona.Common.js의 전역 `[data-toggle="dropdown"]` document 클릭
//    델리게이트가 담당하는데, 토글 버튼이 Shadow DOM 안에 있으면 클릭 이벤트의 target이
//    host로 리타겟되어 델리게이트가 버튼을 찾지 못한다(마크다운 에디터의 shadow 경계
//    문제와 동일 계열).
// 2. `<li>` 항목은 호출부마다 다른 서버 렌더링 마크업(담당자 아바타/역할/브랜치명 등)이라
//    Vue가 선언적으로 다시 그릴 고정 템플릿이 없다.
//
// 그래서 호스트가 원본 `.btn-group[data-name]` 컨테이너 역할을 그대로 하고, 버튼+목록은
// <slot>으로 라이트 DOM에 투과한다. Vue는 클릭 시 라벨/active 클래스/hidden input을
// 갱신하는 얇은 행동 레이어만 담당하며, host 접근에는 Vue 3.5+ `useHost()`를 쓴다.
import { onMounted, onUnmounted, useHost } from "vue";

const host = useHost();

let value = "";
let onChangeCallback: ((value: string) => void) | null = null;

function getList(): HTMLElement | null {
  return host?.querySelector(":scope > .dropdown-menu") ?? host?.querySelector(".dropdown-menu") ?? null;
}

function getLabel(): HTMLElement | null {
  return host?.querySelector(".d-label") ?? null;
}

function getItems(): HTMLElement[] {
  return Array.from(getList()?.querySelectorAll("li") ?? []);
}

function setItemSelected(item: HTMLElement): void {
  const label = getLabel();
  if (label) {
    label.innerHTML = item.innerHTML;
  }
  getItems().forEach((li) => li.classList.remove("active"));
  item.classList.add("active");
}

// hidden input은 host의 라이트 DOM 자식으로 명령형으로 만든다(에디터의 light-DOM
// textarea와 동일한 이유 - 실제 <form> 제출에 실려야 한다).
function setFormValue(item: HTMLElement): void {
  const fieldValue = item.getAttribute("data-value") ?? "";
  const name = host?.getAttribute("data-name");
  value = fieldValue;

  if (!name || !host) {
    return;
  }

  let input = host.querySelector(`input[name="${CSS.escape(name)}"]`) as HTMLInputElement | null;
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    host.appendChild(input);
  }
  input.value = value;
}

function fireChange(): void {
  if (typeof onChangeCallback === "function") {
    const callback = onChangeCallback;
    setTimeout(() => callback(value), 0);
  }
}

function onClickList(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest("li");
  const list = getList();
  if (!target || !list || !list.contains(target) || target.getAttribute("data-value") === null) {
    event.stopPropagation();
    event.preventDefault();
    return;
  }

  setItemSelected(target);
  setFormValue(target);
  fireChange();
}

// 목록 끝에서 페이지 전체 스크롤로 새는 것을 막는다.
function onScrollList(event: WheelEvent): void {
  const list = getList();
  if (!list) {
    return;
  }
  const atTop = list.scrollTop === 0;
  const atBottom = list.scrollTop + list.clientHeight === list.scrollHeight;
  if ((event.deltaY > 0 && atBottom) || (event.deltaY < 0 && atTop)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function selectItem(query: string): boolean {
  const list = getList();
  if (!list) {
    return false;
  }
  const found = list.querySelector(query) as HTMLElement | null;
  if (!found) {
    return false;
  }
  setItemSelected(found);
  setFormValue(found);
  return true;
}

onMounted(() => {
  const list = getList();
  if (list) {
    list.addEventListener("click", onClickList);
    list.addEventListener("mousewheel", onScrollList as EventListener);
  }
  selectItem("li[data-selected=true]");
});

onUnmounted(() => {
  const list = getList();
  if (list) {
    list.removeEventListener("click", onClickList);
    list.removeEventListener("mousewheel", onScrollList as EventListener);
  }
});

defineExpose({
  getValue: (): string => value,
  onChange: (fn: (value: string) => void): boolean => {
    onChangeCallback = fn;
    return true;
  },
  selectByValue: (v: string): boolean => selectItem(`li[data-value='${CSS.escape(v)}']`),
  selectItem,
});
</script>

<template>
  <slot></slot>
</template>
