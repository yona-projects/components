<script setup lang="ts">
// yona.ui.Typeahead.js(Bootstrap bootstrap-typeahead.js에 의존하지 않는 순수 커스텀
// 자동완성 구현)를 Vue 3 SFC로 다시 쓴 버전.
//
// 다른 위젯들과 다른 지점에서 시작한 블로커: 이 위젯은 정적 Thymeleaf 템플릿이 아니라
// 이미 존재하는 <input>에 JS 생성자가 직접 인스턴스화하는 방식이다(`new
// yona.ui.Typeahead(existingInput, options)`, 5개의 서로 다른 호출부). 그래서 교체할
// 고정된 마크업 자체가 없다 - 하지만 이건 "커스텀 엘리먼트를 못 쓴다"는 뜻이 아니라
// "생성자 자신이 그 자리에서 커스텀 엘리먼트를 만들어 기존 input을 감싸면 된다"는
// 뜻이다(호출부 코드는 전혀 안 바뀜 - element.ts가 아니라 yona.ui.Typeahead.js 어댑터가
// 이 감싸기를 담당한다).
//
// 메뉴 자체(.typeahead.dropdown-menu > li > a)는 스위치/드롭다운과 달리 호출부마다
// 다른 임의 마크업이 아니라 항상 같은 모양(문자열 배열 -> <li><a>텍스트</a></li>)이라 -
// 이 부분은 다른 위젯들처럼 전부 Shadow DOM 안에서 Vue가 선언적으로 그린다(bootstrap.css의
// .dropdown-menu CSS를 그대로 이식). 오직 <input> 자신만 <slot>으로 라이트 DOM에 남긴다
// (스위치의 체크박스와 동일한 이유 - 포커스/타이핑 상태를 유지해야 하고 다른 코드가
// 그 input을 계속 참조할 수 있어야 한다).
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

// 원본 yona.ui.Typeahead.js의 생성자 옵션(htOptions.htData.source/minLength/limit)을
// 그대로 받는다 - 실제 서버 조회(XHR)는 어댑터(yona.ui.Typeahead.js) 쪽에 남겨두고,
// 이 컴포넌트는 배열이든 함수든 동일하게 다룬다(원본과 동일한 이원화).
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
/* :host는 scoped 블록 안에 두면 무효 셀렉터가 되어 조용히 사라진다(스위치/드롭다운/
   다이얼로그 위젯에서 이미 실측 확인 - components/vue-widgets/README.md의 switch 위젯
   절 참고) - 그래서 이 규칙만 scoped 없는 별도 블록에 둔다. 호스트 자신이
   position:relative인 새 포지셔닝 컨텍스트가 되어, 메뉴를 원본처럼 offsetTop/offsetLeft를
   JS로 계산하지 않고 순수 CSS(top:100%)만으로 입력창 바로 아래에 놓을 수 있다 - 원본은
   메뉴가 입력창의 형제 엘리먼트였기 때문에 JS 계산이 필요했지만, 이 구조에서는 host가
   포지셔닝 기준점 역할을 대신한다(더 견고한 방식으로의 의도적 개선 - 실제 시각적
   위치는 실측으로 검증). */
:host {
  display: inline-block;
  position: relative;
}
</style>

<style scoped>
/* bootstrap.css:2857 .dropdown-menu + 원본 셀렉터 .typeahead.dropdown-menu 그대로 이식 -
   이 위젯은 메뉴 전체를 Shadow DOM에서 렌더링하므로 전역 CSS가 안 닿는다. 원본처럼
   JS로 top/left를 계산하지 않고 CSS만으로 입력창 바로 아래에 붙인다(위 :host 블록
   참고). */
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
