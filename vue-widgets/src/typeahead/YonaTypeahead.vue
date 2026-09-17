<script setup lang="ts">
// yona.ui.Typeahead.js(Bootstrap에 의존하지 않는 순수 커스텀 자동완성)를 Vue 3 SFC로 이식.
//
// 다른 위젯과 달리 정적 템플릿이 아니라 이미 존재하는 <input>을 JS 생성자가 직접
// 감싸는 방식(`new yona.ui.Typeahead(existingInput, options)`)이라, 그 감싸기는
// element.ts가 아니라 yona.ui.Typeahead.js 어댑터가 담당한다(호출부 코드는 안 바뀜).
//
// 메뉴(.typeahead.dropdown-menu > li > a)는 항상 같은 모양이라 Shadow DOM 안에서 Vue가
// 그리고, <input> 자신만 <slot>으로 라이트 DOM에 남긴다(포커스/타이핑 상태 유지 및
// 외부 코드의 input 참조 때문 - 스위치의 체크박스와 동일한 이유).
import { ref, useTemplateRef } from "vue";

interface TypeaheadItem {
  value: string;
  highlightedHtml: string;
}

export type TypeaheadSource = ((query: string, process: (items: string[]) => void) => void) | string[];

const slotRef = useTemplateRef<HTMLSlotElement>("slotRef");

const shown = ref(false);
const items = ref<TypeaheadItem[]>([]);
const activeIndex = ref(0);

let source: TypeaheadSource = () => {};
let minLength = 0;
let limit = 10;
let query = "";

function getInput(): HTMLInputElement | null {
  const assigned = (slotRef.value?.assignedElements?.() ?? []) as HTMLElement[];
  return (assigned.find((el) => el.tagName === "INPUT") as HTMLInputElement) ?? null;
}

// 원본 생성자 옵션(source/minLength/limit)을 그대로 받는다 - 서버 조회(XHR)는
// 어댑터 쪽에 남기고, 이 컴포넌트는 배열/함수 소스를 동일하게 다룬다.
function configure(options: { source: TypeaheadSource; minLength?: number; limit?: number }): void {
  source = options.source;
  minLength = options.minLength ?? 0;
  limit = options.limit ?? 10;
}

// 원본 Typeahead.prototype.sorter와 동일한 규칙 - 쿼리로 시작 > 대소문자 일치 포함 > 그 외.
function sort(list: string[]): string[] {
  const queryLower = query.toLowerCase();
  const beginsWith: string[] = [];
  const caseSensitive: string[] = [];
  const caseInsensitive: string[] = [];

  list.forEach((item) => {
    if (item.toLowerCase().indexOf(queryLower) === 0) {
      beginsWith.push(item);
    } else if (item.indexOf(query) > -1) {
      caseSensitive.push(item);
    } else {
      caseInsensitive.push(item);
    }
  });

  return beginsWith.concat(caseSensitive, caseInsensitive);
}

function highlight(item: string): string {
  const escapedQuery = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  return item.replace(new RegExp(`(${escapedQuery})`, "ig"), "<strong>$1</strong>");
}

function render(list: string[]): void {
  items.value = list.slice(0, limit).map((value) => ({ value, highlightedHtml: highlight(value) }));
  activeIndex.value = 0;
}

function process(list: string[]): void {
  const queryLower = query.toLowerCase();
  const filtered = list.filter((item) => String(item).toLowerCase().indexOf(queryLower) > -1);
  const sorted = sort(filtered);

  if (sorted.length === 0) {
    shown.value = false;
    return;
  }

  render(sorted);
  shown.value = true;
}

function lookup(): void {
  const input = getInput();
  if (!input) return;
  query = input.value;

  if (!query || query.length < minLength) {
    shown.value = false;
    return;
  }

  if (typeof source === "function") {
    source(query, process);
  } else if (Array.isArray(source)) {
    process(source.slice());
  }
}

function select(): void {
  const input = getInput();
  const item = items.value[activeIndex.value];
  if (!input || !item) {
    shown.value = false;
    return;
  }
  input.value = item.value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  shown.value = false;
}

function onInput(): void {
  lookup();
}

function onKeydown(event: KeyboardEvent): void {
  if (!shown.value) return;
  switch (event.keyCode) {
    case 9: // tab
    case 13: // enter
    case 27: // escape
      event.preventDefault();
      break;
    case 38: // up
      event.preventDefault();
      activeIndex.value = items.value.length ? (activeIndex.value - 1 + items.value.length) % items.value.length : 0;
      break;
    case 40: // down
      event.preventDefault();
      activeIndex.value = items.value.length ? (activeIndex.value + 1) % items.value.length : 0;
      break;
  }
}

function onKeyup(event: KeyboardEvent): void {
  switch (event.keyCode) {
    case 9:
    case 13:
      if (shown.value) select();
      return;
    case 27:
      if (shown.value) shown.value = false;
      return;
  }
}

function onBlur(): void {
  // 메뉴 클릭 시 mousedown 핸들러가 preventDefault()로 포커스 이동 자체를 막으므로,
  // blur는 메뉴 밖을 클릭/탭 이동했을 때만 발생한다(원본과 동일).
  shown.value = false;
}

function onMenuMousedown(event: MouseEvent): void {
  event.preventDefault();
}

function onMenuClick(event: MouseEvent): void {
  const li = (event.target as HTMLElement).closest("li");
  if (!li) return;
  event.preventDefault();
  const index = Array.from(li.parentElement?.children ?? []).indexOf(li);
  if (index >= 0) {
    activeIndex.value = index;
    select();
  }
  getInput()?.focus();
}

function onMenuMouseover(event: MouseEvent): void {
  const li = (event.target as HTMLElement).closest("li");
  if (!li) return;
  const index = Array.from(li.parentElement?.children ?? []).indexOf(li);
  if (index >= 0) {
    activeIndex.value = index;
  }
}

function onSlotChange(): void {
  const input = getInput();
  if (!input) return;
  input.addEventListener("keydown", onKeydown);
  input.addEventListener("keyup", onKeyup);
  input.addEventListener("input", onInput);
  input.addEventListener("blur", onBlur);
}

defineExpose({ configure });
</script>

<template>
  <div class="typeahead-wrap">
    <slot ref="slotRef" @slotchange="onSlotChange"></slot>
    <ul
      class="typeahead dropdown-menu"
      :style="{ display: shown ? 'block' : 'none' }"
      @mousedown="onMenuMousedown"
      @click="onMenuClick"
      @mouseover="onMenuMouseover"
    >
      <li v-for="(item, index) in items" :key="item.value" :class="{ active: index === activeIndex }">
        <a href="#" v-html="item.highlightedHtml"></a>
      </li>
    </ul>
  </div>
</template>

<style>
/* :host를 scoped 블록에 두면 무효 셀렉터가 되어 조용히 사라진다(실측 확인 - README의
   switch 위젯 절 참고) - 그래서 별도 non-scoped 블록에 둔다. host가 position:relative
   기준점이 되어 메뉴를 JS 계산 없이 top:100%만으로 입력창 바로 아래에 놓는다. */
:host {
  display: inline-block;
  position: relative;
}
</style>

<style scoped>
/* bootstrap.css .dropdown-menu 이식 - Shadow DOM이라 전역 CSS가 안 닿는다. 위치는
   JS 계산 없이 CSS(top:100%)로 처리(위 :host 블록 참고). */
.typeahead-wrap {
  display: contents;
}
.typeahead.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  float: left;
  min-width: 160px;
  padding: 5px 0;
  margin: 2px 0 0;
  list-style: none;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
  background-clip: padding-box;
}
.typeahead.dropdown-menu > li > a {
  display: block;
  padding: 3px 20px;
  clear: both;
  font-weight: normal;
  line-height: 20px;
  color: #333333;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
}
.typeahead.dropdown-menu > li > a:hover,
.typeahead.dropdown-menu > li.active > a {
  color: #ffffff;
  background-color: #0081c2;
  background-image: linear-gradient(to bottom, #0088cc, #0077b3);
  background-repeat: repeat-x;
  outline: 0;
}
</style>
