<script setup lang="ts">
// help/markdown.html(마크다운 도움말 패널)의 Vue 3 Composition API + TypeScript SFC판.
//
// 원본은 상태가 사실상 하나뿐이다 - "지금 열려 있는 탭이 무엇인가"(없으면 전부 접힘,
// 원본 초기 마크업에도 .active 클래스가 아무 데도 없어 최초 상태는 전부 닫힘). 클릭한
// 탭이 이미 열려 있으면 닫고, 다른 탭이면 그걸로 바꾼다(한 번에 최대 1개만 열림) - 이
// 규칙을 toggle.ts의 순수 함수 nextActiveKey()로 뽑아 단위 테스트했다.
//
// 원본과 의도적으로 다른 점:
// - marked.js/hljs를 런타임 의존성으로 들이지 않는다. 이 패널의 10개 예시는 절대 바뀌지
//   않는 고정 레퍼런스라(사용자 입력을 렌더링하는 게 아님) "입력 + 결과 HTML"을 전부
//   정적으로 하드코딩했다 - examples.ts 주석 참고. 원본도 이미 2/10(체크리스트/짧은 링크)은
//   이 방식이었다 - 그 패턴을 10개 전부로 일관되게 확장했을 뿐이다.
// - `.row-fluid`/`.span6`(레거시 Bootstrap 2 그리드) 대신 이 컴포넌트 자체의 flex
//   two-column 레이아웃을 쓴다 - 전역 Bootstrap CSS에 기대지 않는 자기완결 컴포넌트로
//   만들기 위함(시각 결과는 동일).
import { ref } from "vue";
import { MARKDOWN_HELP_EXAMPLES } from "./examples";
import { nextActiveKey } from "./toggle";

withDefaults(defineProps<{ title?: string }>(), {
  title: "마크다운 도움말",
});

const activeKey = ref<string | null>(null);

function onNavClick(key: string): void {
  activeKey.value = nextActiveKey(activeKey.value, key);
}
</script>

<template>
  <div class="markdown-help">
    <ul class="markdown-help-nav">
      <li><span class="label">{{ title }}</span></li>
      <li
        v-for="example in MARKDOWN_HELP_EXAMPLES"
        :key="example.key"
        class="help-nav"
        :class="{ active: activeKey === example.key }"
        @click="onNavClick(example.key)"
      >{{ example.navLabel }}</li>
    </ul>
    <ul class="markdown-help-wrap">
      <li
        v-for="example in MARKDOWN_HELP_EXAMPLES"
        :key="example.key"
        class="markdown-help-item"
        :class="[example.key, { active: activeKey === example.key }]"
      >
        <div class="thead">
          <div class="col">Markdown Input</div>
          <div class="col">Markdown Output</div>
        </div>
        <div class="syntax-wrap">
          <div class="col syntax"><pre>{{ example.input }}</pre></div>
          <div class="col"><div class="markdown-wrap" v-html="example.outputHtml"></div></div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* yona.css의 .markdown-help* 규칙(6771~6880행대) 그대로 이식 - 값은 100% 동일,
   `.markdown-help .markdown-help-nav li` 앞의 전역 접두어만 스코프 속성으로 대체됐다. */
.markdown-help {
  margin: 5px 0 0;
}
.markdown-help-nav {
  list-style: none;
  background-color: #f7f7f7;
  border: 1px solid #ddd;
  border-bottom: none;
  padding: 0;
  margin: 0;
}
.markdown-help-nav li {
  display: inline-block;
  padding: 5px 7px;
  line-height: 20px;
}
.markdown-help-nav li .label {
  background-color: #c7c9c9;
  text-shadow: none;
}
.markdown-help-nav li.help-nav {
  cursor: pointer;
  position: relative;
  color: #9e9e9e;
}
.markdown-help-nav li.help-nav:hover {
  color: #333;
}
.markdown-help-nav li.help-nav.active {
  color: #333;
  font-weight: bold;
}
.markdown-help-nav li.help-nav.active::before {
  content: " ";
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 0;
  overflow: hidden;
  border: 7px solid transparent;
  border-style: outset outset solid outset;
  border-bottom-color: #ddd;
  margin-left: -7px;
}
.markdown-help-nav li.help-nav.active::after {
  content: " ";
  position: absolute;
  bottom: -1px;
  left: 50%;
  width: 0;
  height: 0;
  overflow: hidden;
  border: 7px solid transparent;
  border-style: outset outset solid outset;
  border-bottom-color: #fff;
  margin-left: -7px;
}
.markdown-help-wrap {
  list-style: none;
  background-color: #fff;
  padding: 0;
  margin: 0;
}
.markdown-help-item {
  border-top: none;
  height: 0;
  overflow: hidden;
}
.markdown-help-item.active {
  border: 1px solid #ddd;
  border-top: none;
  border-bottom: none;
  height: auto;
  padding: 10px;
}
.markdown-help-item .thead {
  background-color: #f7f7f7;
  border-radius: 6px 6px 0 0;
  border: 1px solid #ddd;
  border-bottom: none;
  display: flex;
}
.markdown-help-item .thead .col {
  flex: 1 1 0;
  padding: 0 10px;
  line-height: 30px;
  font-weight: bold;
}
.markdown-help-item .syntax-wrap {
  border: 1px solid #ddd;
  display: flex;
}
.markdown-help-item .syntax-wrap > .col {
  flex: 1 1 0;
  min-width: 0;
}
.markdown-help-item .syntax-wrap .syntax {
  padding: 10px;
}
.markdown-help-item .syntax-wrap .syntax pre {
  padding: 0;
  margin: 0;
  background-color: transparent;
  border: none;
}

/* yona.css의 .markdown-wrap(11378~11606행) 그대로 이식 - 이전 버전은 YonaMarkdownEditor.vue의
   preview-wrap(별개의 CSS 블록)을 어림잡아 옮겨 적어서 실제로는 값이 다른 곳이 여럿 있었다
   (예: table margin이 15px 15px가 아니라 5px 0으로 잘못됨 - 실사용 화면에서 원본과 나란히
   놓고서야 발견됨). 이번엔 yona.css 원본 블록을 줄 단위로 그대로 옮기고 v-html로 주입되는
   콘텐츠 셀렉터에만 :deep()을 붙였다 - 값 자체는 전부 원본과 동일해야 한다. */
.markdown-wrap {
  font-size: 1.1em;
  clear: both;
  overflow: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji",
    "Segoe UI Emoji", "Segoe UI Symbol";
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
  font-feature-settings: "kern" 1;
  font-kerning: normal;
  padding: 15px 20px !important;
  word-wrap: break-word;
}
.markdown-wrap :deep(> :first-child) {
  margin-top: 0 !important;
}
.markdown-wrap :deep(> :last-child) {
  margin-bottom: 0 !important;
}
.markdown-wrap :deep(ul),
.markdown-wrap :deep(ol) {
  padding: 0 0 5px 2.5em;
  font-weight: normal;
  margin-left: 0;
}
.markdown-wrap :deep(li) {
  margin-bottom: 5px;
  line-height: 1.6em;
}
.markdown-wrap :deep(li > ul) {
  margin-bottom: 0;
  padding: 5px 0 0 2.5em;
}
.markdown-wrap :deep(li > ul :last-of-type) {
  padding-bottom: 0;
}
.markdown-wrap :deep(li > ul pre) {
  padding-bottom: 10px !important;
}
.markdown-wrap :deep(li > p) {
  margin-top: 8px;
  margin-bottom: 2px;
}
.markdown-wrap :deep(a) {
  color: #4183c4;
  text-decoration: none;
}
.markdown-wrap :deep(a:hover) {
  color: #4183c4;
  text-decoration: underline;
}
.markdown-wrap :deep(a:hover span) {
  text-decoration: none;
}
.markdown-wrap :deep(a:active) {
  color: #4183c4;
  text-decoration: none;
}
.markdown-wrap :deep(h1),
.markdown-wrap :deep(h2),
.markdown-wrap :deep(h3) {
  line-height: 40px;
  margin-bottom: 16px;
}
.markdown-wrap :deep(h1) {
  font-size: 2em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #eee;
  width: 95%;
  font-weight: 600;
}
.markdown-wrap :deep(h1) .head-anchor,
.markdown-wrap :deep(h2) .head-anchor,
.markdown-wrap :deep(h3) .head-anchor,
.markdown-wrap :deep(h4) .head-anchor,
.markdown-wrap :deep(h5) .head-anchor {
  margin-left: 3px;
  opacity: 0;
}
.markdown-wrap :deep(h1:hover) .head-anchor,
.markdown-wrap :deep(h2:hover) .head-anchor,
.markdown-wrap :deep(h3:hover) .head-anchor,
.markdown-wrap :deep(h4:hover) .head-anchor,
.markdown-wrap :deep(h5:hover) .head-anchor {
  opacity: 1;
}
.markdown-wrap :deep(h2) {
  line-height: 1.25;
  font-size: 1.5em;
  width: 95%;
  padding: 0 0 0.3em 0;
  border-bottom: 1px solid #eaecef;
}
.markdown-wrap :deep(h3) {
  margin: 1em 0 5px;
  font-size: 1.25em;
  padding: 0;
}
.markdown-wrap :deep(h4) {
  font-size: 1.25em;
  margin-top: 1.2em;
  padding: 0;
}
.markdown-wrap :deep(h5) {
  font-size: 1em;
  margin-top: 20px;
}
.markdown-wrap :deep(hr) {
  height: 1px;
  margin: 10px 0;
  border: 0;
  color: #ccc;
  background-color: #ccc;
}
.markdown-wrap :deep(p) {
  margin: 0 0 12px 0;
  line-height: 1.6em;
}
.markdown-wrap :deep(blockquote p) {
  font-size: 0.9em;
  font-weight: normal;
}
.markdown-wrap :deep(code) {
  padding: 5px 5px 2px 5px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-family: Consolas, "Menlo", "Monaco", "Ubuntu Mono", "source-code-pro", monospace;
  font-size: 13px;
}
.markdown-wrap :deep(code .title) {
  font-size: inherit;
}
.markdown-wrap :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding: 0 15px;
  color: #777;
}
.markdown-wrap :deep(li > img) {
  max-width: 80%;
}
.markdown-wrap :deep(p > input[type="checkbox"]) {
  vertical-align: text-top;
}
.markdown-wrap :deep(li > input[type="checkbox"]) {
  vertical-align: top;
}
.markdown-wrap :deep(img) {
  max-width: 100%;
  margin: 10px 0;
  padding: 5px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  max-height: 600px;
}
.markdown-wrap > :deep(ul) {
  line-height: 20px;
  list-style: disc;
  margin-bottom: 16px;
}
.markdown-wrap :deep(ul ul),
.markdown-wrap :deep(ol ul) {
  list-style: circle;
}
.markdown-wrap :deep(ul ul ul),
.markdown-wrap :deep(ol ul ul),
.markdown-wrap :deep(ol ol ul),
.markdown-wrap :deep(ul ol ul) {
  list-style: square;
}
.markdown-wrap :deep(ol) {
  line-height: 1.6em;
  list-style: decimal;
}
.markdown-wrap :deep(pre) {
  font-size: 1em;
  background-color: #efefef;
  padding: 10px;
  margin: 10px 0;
  word-break: normal;
  border: none;
}
.markdown-wrap :deep(pre code) {
  margin: 0;
  padding: 0;
  border: none;
}
.markdown-wrap :deep(table) {
  border-collapse: collapse;
  margin: 15px 15px;
}
.markdown-wrap :deep(table th) {
  padding: 5px;
  border: 1px solid #dcddde;
  background-color: #f7f7f7;
  min-width: 45px;
}
.markdown-wrap :deep(table td) {
  padding: 5px;
  border: 1px solid #dcddde;
  word-break: break-all;
}
</style>
