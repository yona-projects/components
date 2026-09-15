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
  white-space: pre-wrap;
  word-break: break-word;
}

/* yona.css의 .markdown-wrap(11331행대) 타이포그래피 - YonaMarkdownEditor.vue의
   preview-wrap과 동일한 원본 규칙(구문강조 색상 제외 - 이 패널은 hljs를 쓰지 않는다). */
.markdown-wrap {
  padding: 0 10px;
  font-size: 1.1em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji",
    "Segoe UI Emoji", "Segoe UI Symbol";
  word-wrap: break-word;
}
.markdown-wrap :deep(> :first-child) {
  margin-top: 0 !important;
}
.markdown-wrap :deep(> :last-child) {
  margin-bottom: 0 !important;
}
.markdown-wrap :deep(h1),
.markdown-wrap :deep(h2),
.markdown-wrap :deep(h3) {
  line-height: 1.4;
  margin: 0.6em 0;
}
.markdown-wrap :deep(p) {
  margin: 0 0 12px 0;
  line-height: 1.6em;
}
.markdown-wrap :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding: 0 15px;
  color: #777;
  margin: 0;
}
.markdown-wrap :deep(code) {
  padding: 2px 5px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-family: Consolas, "Menlo", "Monaco", "Ubuntu Mono", "source-code-pro", monospace;
  font-size: 13px;
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
  margin: 5px 0;
}
.markdown-wrap :deep(table th),
.markdown-wrap :deep(table td) {
  padding: 5px;
  border: 1px solid #dcddde;
}
.markdown-wrap :deep(table th) {
  background-color: #f7f7f7;
}
.markdown-wrap :deep(img) {
  max-width: 100%;
}
.markdown-wrap :deep(ul),
.markdown-wrap :deep(ol) {
  padding-left: 1.5em;
  margin: 0 0 12px 0;
}
</style>
