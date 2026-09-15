<script setup lang="ts">
// yona.Pagination.js(common/yona.Pagination.js)를 Vue 3 SFC로 다시 쓴 버전 -
// 매번 새로 그리는 stateless 위젯(Toast와 같은 계열)이라 <Teleport>도 라이트 DOM
// 탈출구도 필요 없다: 원본이 매 update() 호출마다 target.innerHTML = ''로 지우고
// 통째로 다시 그리던 것을, Vue가 내부 reactive 상태 기반으로 선언적으로 다시
// 그리는 것으로 그대로 옮겼다. 순수 로직(URL 파싱/페이지 계산/입력값 보정)은
// pagination.ts로 뽑아 단위 테스트했다(원본의 미묘한 특성 - rxDigit이 실제로는
// "positive만"이 아니라 "첫 글자는 아무거나 + 나머지는 숫자"만 검사하는 것,
// isNumeric이 16진수/음수 문자열도 숫자로 판정하는 것 - 까지 전부 그대로 보존).
//
// 원본과 의도적으로 다른 점 두 가지(둘 다 순수 UX 개선, 관찰 가능한 페이지 이동
// 동작은 동일):
// 1. 입력창 클램프(min/max 보정)를 원본은 keydown에서 처리해 실제로는 "한 타 늦게"
//    (막 입력된 글자가 반영되기 전 값을 검사) 동작했다 - input 이벤트로 옮겨 실제
//    입력된 값을 즉시 검사/보정한다.
// 2. 클릭 시 전체 선택(document 전역 델리게이트)이 원본은 `input[name="pageNum"]`
//    을 하드코딩해 paramNameForPage를 커스터마이즈한 4개 화면(예: site/postList.html의
//    "page")에서는 실행 경로 자체를 타지 못했다 - 이 컴포넌트는 인스턴스 자신의
//    클릭 핸들러로 처리해 paramNameForPage와 무관하게 항상 실행된다. 다만 실측 확인
//    결과 `type="number"` 입력창에서는 최신 브라우저가 `.select()`/`selectionStart`를
//    전부 무동작(null)으로 처리한다(원본도 동일한 제약을 겪는다 - 브라우저 플랫폼
//    한계이지 이 포팅의 회귀가 아니다) - 그래서 실질적 사용자 체감 차이는 없고,
//    "핸들러가 항상 걸린다"는 구조적 정확성만 개선된 것이다.
import { reactive, ref } from "vue";
import { resolvePaginationState, urlWithPageNum, clampInputValue, type UpdateOptions } from "./pagination";

// Vue는 선언되지 않은 host 속성(우리 어댑터가 원본 target의 id 등을 그대로 복사해
// 넘기는 것 포함)을 기본적으로 템플릿 루트에 그대로 흘려보낸다(attrs fallthrough) -
// 실측 중 host의 id="pagination"이 shadow DOM 내부 루트 div에도 그대로 복제되는
// 것을 발견했다(동작에는 영향 없음 - shadow DOM은 light DOM과 별도 ID 스코프라
// document.getElementById는 못 찾는다 - 하지만 shadow 관통 셀렉터를 쓰는 도구에는
// 불필요한 혼동을 준다). 내부에서 id를 참조하는 곳이 없으므로 흘려보내지 않는다.
defineOptions({ inheritAttrs: false });

// messages.js(site/layout.html이 항상 먼저 로드)가 전역으로 노출하는 i18n 함수 -
// dialog 위젯과 동일한 안전 호출 패턴.
declare function Messages(key: string): string;
declare const yona: { ShortcutKey?: { setKeymapLink(map: Record<string, string>): void } } | undefined;

const visible = ref(false);
const state = reactive({
  current: 1,
  firstPage: 1,
  totalPages: 1,
  paramNameForPage: "pageNum",
  hasPrev: false,
  hasNext: false,
  url: "",
});
// 함수는 반응형으로 감쌀 필요가 없다(review-form의 createdTempRow와 동일 패턴).
let submitFn: ((pageNum: number) => void) | undefined;
const inputValue = ref("1");

function prevLabel(): string {
  return (typeof Messages === "function" ? Messages("button.prevPage") : "") || "PREV";
}
function nextLabel(): string {
  return (typeof Messages === "function" ? Messages("button.nextPage") : "") || "NEXT";
}

function prevHref(): string {
  return urlWithPageNum(state.url, state.current - 1, state.paramNameForPage, window.location.href);
}
function nextHref(): string {
  return urlWithPageNum(state.url, state.current + 1, state.paramNameForPage, window.location.href);
}

function registerShortcut(key: string, href: string): void {
  if (typeof yona !== "undefined" && yona?.ShortcutKey) {
    yona.ShortcutKey.setKeymapLink({ [key]: href });
  }
}

function update(totalPages: number, options: UpdateOptions = {}): void {
  // 원본 updatePagination의 가드 그대로: 대상 부재/총 페이지 수 미확정이면 아무것도
  // 그리지 않는다(elTarget 자체는 컴포넌트 존재로 대체됐으므로 totalPages만 검사).
  if (!(totalPages > 0)) {
    return;
  }

  const base = window.location.href;
  const resolved = resolvePaginationState(totalPages, options, base);
  state.current = resolved.current;
  state.firstPage = resolved.firstPage;
  state.totalPages = resolved.totalPages;
  state.paramNameForPage = resolved.paramNameForPage;
  state.hasPrev = resolved.hasPrev;
  state.hasNext = resolved.hasNext;
  state.url = resolved.url;
  submitFn = resolved.submit;
  inputValue.value = String(resolved.current);
  visible.value = true;

  registerShortcut("LEFT", state.hasPrev ? prevHref() : "");
  registerShortcut("RIGHT", state.hasNext ? nextHref() : "");
}

function onPrevClick(): void {
  if (submitFn) {
    submitFn(state.current - 1);
  }
}
function onNextClick(): void {
  if (submitFn) {
    submitFn(state.current + 1);
  }
}

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const result = clampInputValue(target.value, 1, state.totalPages, state.current);
  inputValue.value = result.value;
  if (target.value !== result.value) {
    target.value = result.value;
  }
  if (result.valid && submitFn) {
    submitFn(Number(result.value));
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== "Enter" || submitFn) {
    // submit 모드는 이미 onInput에서 매 입력마다 반영하므로 Enter는 별도 처리 없음.
    return;
  }
  event.preventDefault();
  window.location.href = urlWithPageNum(state.url, inputValue.value, state.paramNameForPage, window.location.href);
}

function onInputClick(event: Event): void {
  (event.target as HTMLInputElement).select();
}

defineExpose({ update });
</script>

<template>
  <div v-if="visible" class="page-navigation-wrap">
    <ul class="page-nums">
      <li class="page-num ikon">
        <a v-if="state.hasPrev" pjax-page :href="submitFn ? 'javascript: void(0);' : prevHref()" @click="onPrevClick">
          <i class="ico btn-pg-prev"></i><span>{{ prevLabel() }}</span>
        </a>
        <template v-else><i class="ico btn-pg-prev off"></i><span class="off">{{ prevLabel() }}</span></template>
      </li>
      <li class="page-num">
        <input
          type="number"
          pattern="[0-9]*"
          class="input-mini nospinner"
          :name="state.paramNameForPage"
          :max="state.totalPages"
          min="1"
          :value="inputValue"
          @input="onInput"
          @keydown="onKeydown"
          @click="onInputClick"
        />
      </li>
      <li class="page-num delimiter">/</li>
      <li class="page-num">{{ state.totalPages }}</li>
      <li class="page-num ikon">
        <a v-if="state.hasNext" pjax-page :href="submitFn ? 'javascript: void(0);' : nextHref()" @click="onNextClick">
          <span>{{ nextLabel() }}</span><i class="ico btn-pg-next"></i>
        </a>
        <template v-else><span class="off">{{ nextLabel() }}</span><i class="ico btn-pg-next off"></i></template>
      </li>
    </ul>
  </div>
</template>

<style>
/* :host는 scoped 블록 안에서 [data-v-xxx]가 뒤에 붙어 무효화되므로(switch 위젯에서
   실측 확인된 버그) 반드시 별도 non-scoped 블록에 둔다 - 커스텀 엘리먼트 host의
   기본값 display: inline으로는 아래 width:100%/text-align:center가 무의미해진다. */
:host {
  display: block;
}
</style>

<style scoped>
/* yona.css의 pagination 관련 규칙을 그대로 이식(.page-navigation-wrap 하위 트리) */
.page-navigation-wrap {
  width: 100%;
  text-align: center;
  margin: 20px 0;
  clear: both;
}
.page-navigation-wrap .page-nums {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0;
  display: inline-block;
  /* yona.css 8476행의 전역(!important) 보정값 - Shadow DOM 밖 전역 스타일은 이
     안까지 닿지 않으므로 직접 이식했다. */
  margin-left: -120px;
}
@media all and (max-width: 720px) {
  .page-navigation-wrap .page-nums {
    margin-left: 0;
  }
}
.page-navigation-wrap .page-nums .page-num {
  display: inline-block;
  padding: 0 10px;
  font-size: 12px;
  color: #8e9094;
}
.page-navigation-wrap .page-nums .page-num .input-mini {
  margin: 0;
  width: 30px;
  text-align: center;
  font-weight: bold;
  border: 1px solid #eee;
}
.page-navigation-wrap .page-nums .page-num .input-mini:hover,
.page-navigation-wrap .page-nums .page-num .input-mini:focus {
  box-shadow: inset -1px -1px 2px rgba(0, 0, 0, 0.1);
  color: #f36c22;
  border-color: #f36c22;
}
.page-navigation-wrap .page-nums .page-num.ikon {
  padding: 0 5px;
}
.page-navigation-wrap .page-nums .page-num.ikon:nth-child(4n-2) {
  padding-right: 10px;
}
.page-navigation-wrap .page-nums .page-num.ikon:nth-child(5n-2) {
  padding-left: 10px;
}
.page-navigation-wrap .page-nums .page-num.ikon span {
  font-size: 11px;
  color: #f36c22;
}
.page-navigation-wrap .page-nums .page-num.ikon span.off {
  color: #8e9094;
}
.page-navigation-wrap .page-nums .page-num.delimiter {
  color: #ddd;
  padding: 0 5px;
}
.page-navigation-wrap .page-nums .page-num .nospinner {
  -moz-appearance: textfield;
}
.ico {
  display: inline-block;
  background-repeat: no-repeat;
  background-image: url("/images/sprite.png");
  vertical-align: middle;
}
.btn-pg-next {
  width: 6px;
  height: 9px;
  background-position: -146px -139px;
  margin-left: 10px;
}
.btn-pg-next.off {
  background-position: -23px -13px;
}
.btn-pg-prev {
  width: 6px;
  height: 9px;
  background-position: -136px -139px;
  margin-right: 10px;
}
.btn-pg-prev.off {
  background-position: -164px -2px;
}
</style>
