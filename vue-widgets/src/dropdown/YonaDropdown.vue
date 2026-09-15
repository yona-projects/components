<script setup lang="ts">
// yona.ui.Dropdown.js(커스텀 vanilla 드롭다운 - Bootstrap dropdown 플러그인에 의존하지
// 않음)를 Vue 3 SFC로 다시 쓴 버전.
//
// 원본과 달리 이 컴포넌트는 "위젯 전체를 Shadow DOM에 그린다"는 다른 위젯들의 패턴을
// 따르지 않는다 - 실제로 조사해보니 그럴 필요도 없고 그러면 안 된다:
// 1. 드롭다운 열고/닫기(.open 클래스 토글)는 이 파일이 아니라 yona.Common.js의 전역
//    `[data-toggle="dropdown"]` document 클릭 델리게이트가 담당한다. 그 델리게이트는
//    `event.target.closest('[data-toggle="dropdown"]')`으로 버튼을 찾고
//    `elToggle.parentElement`에 `.open`을 토글하는데, 토글 버튼이 Shadow DOM 안에 있으면
//    바깥에서 관찰하는 이 클릭 이벤트의 target이 host로 리타겟되어 버튼을 절대 못 찾는다
//    (마크다운 에디터에서 겪은 shadow 경계 문제와 동일 계열).
// 2. `<li>` 항목 내용이 담당자 아바타/역할/브랜치명 등 호출부마다 다른 풍부한 서버
//    렌더링 마크업이라(project/members.html, issue/partial_massupdate.html 등), Vue가
//    선언적으로 다시 그릴 만한 하나의 고정 템플릿이 없다.
//
// 그래서 호스트 자신이 원본 `.btn-group[data-name]` 컨테이너를 그대로 대신하고(클래스/
// data-name 속성도 동일하게 유지), 버튼+목록 전체를 <slot>으로 라이트 DOM에 그대로
// 투과한다 - Vue는 목록 클릭 시 라벨 텍스트/active 클래스/hidden input을 갱신하고
// onChange 콜백을 호출하는 얇은 행동 레이어만 담당한다. 커스텀 엘리먼트 host 자신에
// 접근하기 위해 Vue 3.5+의 `useHost()`를 쓴다(defineCustomElement 전용 API).
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

// 원본 _setItemSelected
function setItemSelected(item: HTMLElement): void {
  const label = getLabel();
  if (label) {
    label.innerHTML = item.innerHTML;
  }
  getItems().forEach((li) => li.classList.remove("active"));
  item.classList.add("active");
}

// 원본 _setFormValue - hidden input은 host(원본의 welContainer에 해당)의 라이트 DOM
// 자식으로 명령형으로 만든다(에디터의 light-DOM textarea와 동일한 이유 - 실제 <form>
// 제출에 실려야 한다).
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

// 원본 _onClickItem
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

// 원본 _onScrollList/_isScrollTopOfList/_isScrollEndOfList - 목록 끝에서 페이지 전체
// 스크롤로 새는 것을 막는다.
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

// 원본 _selectItem
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
  selectItem("li[data-selected=true]"); // 원본 _selectDefault
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
