<script setup lang="ts">
// components/editor의 원본(네이티브 Custom Element, Shadow DOM)과 동일 기능을 Vue SFC로
// 다시 작성한 것. 원본과 의도적으로 달라진 지점:
//
// 1) Shadow DOM 없음 -> Vue의 `scoped` 스타일(data-v-* 속성 선택자)을 쓴다. Shadow DOM
//    전제인 원본의 `::part()` 계약은 제거했고, `--yona-md-*` CSS 커스텀 프로퍼티 계약만
//    유지한다.
// 2) 값 계약: 원본의 명령형 `value` getter/setter 대신 `v-model`을 1차 API로 삼고,
//    명령형 접근용 defineExpose(getValue/setValue)도 함께 내보낸다.
//    실제 <form> 제출로 발견한 함정: defineCustomElement는 이 textarea까지 Shadow DOM
//    안에 마운트하므로 조상 <form>의 FormData에 자동으로 실리지 않는다(표준 동작). Vue의
//    defineCustomElement는 아직 form-associated custom element(ElementInternals)를
//    지원하지 않아(vuejs/core #12129, 미병합) element.ts에서 표준 웹 컴포넌트 API로 직접
//    연결했다 - textarea의 input 이벤트를 composed:true로 내보내 Shadow 경계를 넘긴 뒤
//    호스트에서 internals.setFormValue()를 호출한다.
// 3) render-url/mention-url을 조상에서 closest()로 읽어오던 원본 패턴(Thymeleaf 프래그먼트
//    통합용 우회) 대신 명시적 prop(renderUrl/mentionUrl)으로 받는다.
// 4) 인스턴스별 textarea id는 원본의 수동 `instanceCounter` 대신 Vue 3.5+ `useId()`로
//    생성한다.
//
// commands.ts/mention.ts/preview.ts는 프레임워크에 의존하지 않는 순수 로직이라 원본과
// 동일한 파일을 그대로 재사용한다 - 포팅이 필요했던 부분은 Custom Element 껍데기뿐이다.
import { ref, computed, useId, onMounted, onBeforeUnmount, watch } from "vue";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { PreviewController } from "./preview";
import { createMentionExtension } from "./mention";
// MENTION_STYLES(mention.ts)는 순수 문자열 CSS라 Vue SFC의 정적 <style> 블록에 그대로
// 옮겨 적었다(아래 :deep(.yona-mention-option) 등) - JS 상수를 <style>에 동적으로 주입할
// 방법이 없어(v-bind()는 값 하나만 가능) 내용만 그대로 복사했다.
import { buildToolbarSpec, type ToolbarItem, type ToolbarButtonSpec } from "./toolbarSpec";

const props = withDefaults(
  defineProps<{
    name?: string;
    editorMode?: string;
    modelValue?: string;
    renderUrl?: string | null;
    mentionUrl?: string | null;
  }>(),
  {
    name: "",
    editorMode: "",
    modelValue: "",
    renderUrl: null,
    mentionUrl: null,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const textareaId = `editor-${useId()}`;
const toolbarSpec: ToolbarItem[] = buildToolbarSpec();

const rootRef = ref<HTMLDivElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const editorWrapperRef = ref<HTMLDivElement | null>(null);
const previewPanelRef = ref<HTMLDivElement | null>(null);
const previewActive = ref(false);

let view: EditorView | null = null;
let previewController: PreviewController | null = null;
let form: HTMLFormElement | null = null;
let formResetHandler: (() => void) | null = null;
// mount 시점의 초기값을 보존해둔다(form.reset() 시 CM6 뷰를 이 값으로 되돌리기 위해 - 원본의
// initialValue 필드와 동일한 목적).
const initialValue = props.modelValue;

function syncTextareaFromEditor(newValue: string): void {
  const textarea = textareaRef.value;
  if (!textarea) {
    return;
  }
  textarea.value = newValue;
  // 레거시(비-Vue) 핸들러 호환을 위해 네이티브 input/keyup 이벤트도 재발행한다.
  // composed:true 필수 - 없으면 Shadow DOM 경계를 못 넘어 element.ts가 받지 못한다.
  textarea.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  textarea.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, composed: true }));
}

onMounted(() => {
  const textarea = textareaRef.value;
  const editorWrapper = editorWrapperRef.value;
  const previewPanel = previewPanelRef.value;
  if (!textarea || !editorWrapper || !previewPanel) {
    return;
  }

  textarea.value = initialValue;
  textarea.defaultValue = initialValue;

  previewController = new PreviewController({ renderUrl: props.renderUrl, panel: previewPanel });

  const extensions: Extension[] = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    EditorView.lineWrapping,
    EditorView.theme({
      "&": {
        fontFamily: "var(--yona-md-font-family, Consolas, Menlo, Monaco, monospace)",
        fontSize: "var(--yona-md-font-size, 13px)",
      },
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) {
        return;
      }
      const newValue = update.state.doc.toString();
      syncTextareaFromEditor(newValue);
      emit("update:modelValue", newValue);
      if (previewActive.value) {
        previewController?.scheduleRender(newValue);
      }
    }),
  ];
  // mentionUrl은 mount 시점에만 읽는다(원본과 동일한 all-or-nothing 설계 - "@"/":"/"#" 3개를
  // 한꺼번에 켜거나 아예 안 켜며, mount 이후 prop이 바뀌어도 재구성하지 않는다).
  if (props.mentionUrl) {
    const mentionUrl = props.mentionUrl;
    extensions.push(createMentionExtension({ getMentionUrl: () => mentionUrl }));
  }

  view = new EditorView({
    state: EditorState.create({ doc: initialValue, extensions }),
    parent: editorWrapper,
  });

  form = rootRef.value?.closest("form") ?? null;
  if (form) {
    formResetHandler = () => {
      if (!view) {
        return;
      }
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: initialValue },
      });
    };
    form.addEventListener("reset", formResetHandler);
  }
});

onBeforeUnmount(() => {
  previewController?.dispose();
  view?.destroy();
  view = null;
  if (form && formResetHandler) {
    form.removeEventListener("reset", formResetHandler);
  }
  form = null;
  formResetHandler = null;
});

// 부모가 v-model 쪽에서 값을 바꾼 경우(예: 폼 일괄 리셋, 다른 필드에서 계산된 값 주입)에도
// CM6 문서를 맞춰준다 - 우리 자신이 emit한 갱신을 되받아 무한루프에 빠지지 않도록 현재 문서와
// 다를 때만 반영한다.
watch(
  () => props.modelValue,
  (newValue) => {
    if (!view || newValue === view.state.doc.toString()) {
      return;
    }
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newValue },
    });
  },
);

function runToolbarCommand(item: ToolbarButtonSpec): void {
  if (!view || !item.run) {
    return;
  }
  const spec = item.run(view.state);
  if (spec) {
    view.dispatch(spec);
  }
  view.focus();
}

function onToolbarButtonClick(item: ToolbarButtonSpec): void {
  if (item.run) {
    runToolbarCommand(item);
    return;
  }
  previewActive.value = !previewActive.value;
  if (previewActive.value && view) {
    previewController?.scheduleRender(view.state.doc.toString());
  }
  view?.focus();
}

function buttonClass(item: ToolbarButtonSpec) {
  return [
    item.text !== undefined ? "text-icon" : `icon icon-${item.command}`,
    { "is-active": item.command === "preview" && previewActive.value },
  ];
}

/** 원본 Custom Element의 공개 `value` getter/setter와 동일한 계약. v-model이 1차 API이고
 * 이쪽은 명령형 접근이 필요한 소비자를 위한 보조 API다. */
function getValue(): string {
  return view ? view.state.doc.toString() : "";
}

function setValue(newValue: string): void {
  if (!view) {
    return;
  }
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: newValue },
  });
}

defineExpose({ getValue, setValue });
</script>

<template>
  <div ref="rootRef" class="yona-markdown-editor-vue">
    <textarea
      ref="textareaRef"
      :name="name"
      :id="textareaId"
      :data-editor-mode="editorMode"
      markdown="true"
      style="display: none"
    ></textarea>

    <div class="toolbar">
      <template v-for="(item, idx) in toolbarSpec" :key="idx">
        <span v-if="item === 'separator'" class="separator" aria-hidden="true"></span>
        <button
          v-else
          type="button"
          class="toolbar-button"
          :class="buttonClass(item)"
          :data-command="item.command"
          :data-icon="item.iconChar"
          :title="item.title"
          :aria-label="item.title"
          :aria-pressed="item.command === 'preview' ? previewActive : undefined"
          @click="onToolbarButtonClick(item)"
        >{{ item.text }}</button>
      </template>
    </div>

    <div ref="editorWrapperRef" class="editor-wrapper" v-show="!previewActive"></div>
    <div ref="previewPanelRef" class="preview-wrap markdown-wrap" v-show="previewActive"></div>
  </div>
</template>

<style scoped>
/* 원본 toolbar.ts의 TOOLBAR_STYLES 이식 - `:host`/part 셀렉터를 스코프 클래스로
   치환했을 뿐 실제 값(색상/치수)은 원본과 동일하다. */
.yona-markdown-editor-vue {
  --yona-md-toolbar-bg: #fafafa;
  --yona-md-border-color: rgba(0, 0, 0, 0.15);
  --yona-md-radius: 4px;
  --yona-md-button-radius: 3px;
  --yona-md-button-bg: #fff;
  --yona-md-button-color: #333;
  --yona-md-accent-color: #51aacc;
  --yona-md-accent-text-color: #fff;
  --yona-md-disabled-opacity: 0.35;
  --yona-md-font-family: Consolas, Menlo, Monaco, monospace;
  --yona-md-font-size: 13px;
  --yona-md-icon-font-family: "yobicon";
  --yona-md-min-height: 300px;

  display: block;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  box-sizing: border-box;
  background-color: var(--yona-md-toolbar-bg);
  border: 1px solid var(--yona-md-border-color);
  border-bottom: none;
  border-radius: var(--yona-md-radius) var(--yona-md-radius) 0 0;
  padding: 6px 8px;
  margin-bottom: 4px;
}

.toolbar-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  min-width: 30px;
  margin: 0 2px 0 0;
  padding: 0 8px;
  font-size: 14px;
  line-height: 24px;
  color: var(--yona-md-button-color);
  background-color: var(--yona-md-button-bg);
  border: 1px solid var(--yona-md-border-color);
  border-radius: var(--yona-md-button-radius);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  transition: all 0.3s ease;
}

.toolbar-button:hover,
.toolbar-button.is-active {
  background-color: var(--yona-md-accent-color);
  border-color: var(--yona-md-accent-color);
  color: var(--yona-md-accent-text-color);
}

.toolbar-button.icon::before {
  font-family: var(--yona-md-icon-font-family);
  font-style: normal;
  font-weight: normal;
  vertical-align: middle;
  content: attr(data-icon);
}

.toolbar-button.text-icon {
  font-family: Arial, sans-serif;
  font-weight: bold;
}

.separator {
  display: inline-block;
  align-self: stretch;
  border-left: 1px solid var(--yona-md-border-color);
  width: 0;
  min-height: 18px;
  margin: 0 6px;
}

.editor-wrapper {
  box-sizing: border-box;
  border: 1px solid var(--yona-md-border-color);
  border-radius: 0 0 var(--yona-md-radius) var(--yona-md-radius);
}

.editor-wrapper:focus-within {
  border-color: var(--yona-md-accent-color);
}

.editor-wrapper :deep(.cm-editor) {
  min-height: var(--yona-md-min-height);
}

.preview-wrap {
  box-sizing: border-box;
  min-height: var(--yona-md-min-height);
  padding: 10px;
  border: 1px solid var(--yona-md-border-color);
  border-radius: 0 0 var(--yona-md-radius) var(--yona-md-radius);
  overflow: auto;
}

/* 원본 toolbar.ts의 .preview-wrap(yobi.css .markdown-wrap 이식분 + highlight.js 테마) 그대로. */
.preview-wrap {
  font-size: 1.1em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji",
    "Segoe UI Emoji", "Segoe UI Symbol";
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
  font-feature-settings: "kern" 1;
  font-kerning: normal;
  word-wrap: break-word;
}
.preview-wrap > :deep(:first-child) {
  margin-top: 0 !important;
}
.preview-wrap > :deep(:last-child) {
  margin-bottom: 0 !important;
}
.preview-wrap :deep(ul),
.preview-wrap :deep(ol) {
  padding: 0 0 5px 2.5em;
  font-weight: normal;
  margin-left: 0;
}
.preview-wrap :deep(li) {
  margin-bottom: 5px;
  line-height: 1.6em;
}
.preview-wrap :deep(li > ul) {
  margin-bottom: 0;
  padding: 5px 0 0 2.5em;
}
.preview-wrap :deep(li > ul :last-of-type) {
  padding-bottom: 0;
}
.preview-wrap :deep(li > ul pre) {
  padding-bottom: 10px !important;
}
.preview-wrap :deep(li > p) {
  margin-top: 8px;
  margin-bottom: 2px;
}
.preview-wrap :deep(a) {
  color: #4183c4;
  text-decoration: none;
}
.preview-wrap :deep(a:hover) {
  color: #4183c4;
  text-decoration: underline;
}
.preview-wrap :deep(a:hover span) {
  text-decoration: none;
}
.preview-wrap :deep(a:active) {
  color: #4183c4;
  text-decoration: none;
}
.preview-wrap :deep(h1),
.preview-wrap :deep(h2),
.preview-wrap :deep(h3) {
  line-height: 40px;
  margin-bottom: 16px;
}
.preview-wrap :deep(h1) {
  font-size: 2em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #eee;
  width: 95%;
  font-weight: 600;
}
.preview-wrap :deep(h1) .head-anchor,
.preview-wrap :deep(h2) .head-anchor,
.preview-wrap :deep(h3) .head-anchor,
.preview-wrap :deep(h4) .head-anchor,
.preview-wrap :deep(h5) .head-anchor {
  margin-left: 3px;
  opacity: 0;
}
.preview-wrap :deep(h1:hover) .head-anchor,
.preview-wrap :deep(h2:hover) .head-anchor,
.preview-wrap :deep(h3:hover) .head-anchor,
.preview-wrap :deep(h4:hover) .head-anchor,
.preview-wrap :deep(h5:hover) .head-anchor {
  opacity: 1;
}
.preview-wrap :deep(h2) {
  line-height: 1.25;
  font-size: 1.5em;
  width: 95%;
  padding: 0 0 0.3em 0;
  border-bottom: 1px solid #eaecef;
}
.preview-wrap :deep(h3) {
  margin: 1em 0 5px;
  font-size: 1.25em;
  padding: 0;
}
.preview-wrap :deep(h4) {
  font-size: 1.25em;
  margin-top: 1.2em;
  padding: 0;
}
.preview-wrap :deep(h5) {
  font-size: 1em;
  margin-top: 20px;
}
.preview-wrap :deep(hr) {
  height: 1px;
  margin: 10px 0;
  border: 0;
  color: #ccc;
  background-color: #ccc;
}
.preview-wrap :deep(p) {
  margin: 0 0 12px 0;
  line-height: 1.6em;
}
.preview-wrap :deep(blockquote p) {
  font-size: 0.9em;
  font-weight: normal;
}
.preview-wrap :deep(code) {
  padding: 5px 5px 2px 5px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-family: Consolas, "Menlo", "Monaco", "Ubuntu Mono", "source-code-pro", monospace;
  font-size: 13px;
}
.preview-wrap :deep(code .title) {
  font-size: inherit;
}
.preview-wrap :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding: 0 15px;
  color: #777;
}
.preview-wrap :deep(li > img) {
  max-width: 80%;
}
.preview-wrap :deep(p > input[type="checkbox"]) {
  vertical-align: text-top;
}
.preview-wrap :deep(li > input[type="checkbox"]) {
  vertical-align: top;
}
.preview-wrap :deep(img) {
  max-width: 100%;
  margin: 10px 0;
  padding: 5px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  max-height: 600px;
}
.preview-wrap > :deep(ul) {
  line-height: 20px;
  list-style: disc;
  margin-bottom: 16px;
}
.preview-wrap :deep(ul ul),
.preview-wrap :deep(ol ul) {
  list-style: circle;
}
.preview-wrap :deep(ul ul ul),
.preview-wrap :deep(ol ul ul),
.preview-wrap :deep(ol ol ul),
.preview-wrap :deep(ul ol ul) {
  list-style: square;
}
.preview-wrap :deep(ol) {
  line-height: 1.6em;
  list-style: decimal;
}
.preview-wrap :deep(pre) {
  font-size: 1em;
  background-color: #efefef;
  padding: 10px;
  margin: 10px 0;
  word-break: normal;
  border: none;
}
.preview-wrap :deep(pre code) {
  margin: 0;
  padding: 0;
  border: none;
}
.preview-wrap :deep(table) {
  border-collapse: collapse;
  margin: 15px 15px;
}
.preview-wrap :deep(table th) {
  padding: 5px;
  border: 1px solid #dcddde;
  background-color: #f7f7f7;
  min-width: 45px;
}
.preview-wrap :deep(table td) {
  padding: 5px;
  border: 1px solid #dcddde;
  word-break: break-all;
}

/* highlight.js styles/default.css 그대로 이식(원본 toolbar.ts와 동일). */
.preview-wrap :deep(.hljs) {
  display: block;
  overflow-x: auto;
  padding: 0.5em;
  background: #f0f0f0;
}
.preview-wrap :deep(.hljs),
.preview-wrap :deep(.hljs-subst) {
  color: #444;
}
.preview-wrap :deep(.hljs-comment) {
  color: #888888;
}
.preview-wrap :deep(.hljs-keyword),
.preview-wrap :deep(.hljs-attribute),
.preview-wrap :deep(.hljs-selector-tag),
.preview-wrap :deep(.hljs-meta-keyword),
.preview-wrap :deep(.hljs-doctag),
.preview-wrap :deep(.hljs-name) {
  font-weight: bold;
}
.preview-wrap :deep(.hljs-type),
.preview-wrap :deep(.hljs-string),
.preview-wrap :deep(.hljs-number),
.preview-wrap :deep(.hljs-selector-id),
.preview-wrap :deep(.hljs-selector-class),
.preview-wrap :deep(.hljs-quote),
.preview-wrap :deep(.hljs-template-tag),
.preview-wrap :deep(.hljs-deletion) {
  color: #880000;
}
.preview-wrap :deep(.hljs-title),
.preview-wrap :deep(.hljs-section) {
  color: #880000;
  font-weight: bold;
}
.preview-wrap :deep(.hljs-regexp),
.preview-wrap :deep(.hljs-symbol),
.preview-wrap :deep(.hljs-variable),
.preview-wrap :deep(.hljs-template-variable),
.preview-wrap :deep(.hljs-link),
.preview-wrap :deep(.hljs-selector-attr),
.preview-wrap :deep(.hljs-selector-pseudo) {
  color: #bc6060;
}
.preview-wrap :deep(.hljs-literal) {
  color: #78a960;
}
.preview-wrap :deep(.hljs-built_in),
.preview-wrap :deep(.hljs-bullet),
.preview-wrap :deep(.hljs-code),
.preview-wrap :deep(.hljs-addition) {
  color: #397300;
}
.preview-wrap :deep(.hljs-meta) {
  color: #1f7199;
}
.preview-wrap :deep(.hljs-meta-string) {
  color: #4d99bf;
}
.preview-wrap :deep(.hljs-emphasis) {
  font-style: italic;
}
.preview-wrap :deep(.hljs-strong) {
  font-weight: bold;
}

/* mention.ts의 MENTION_STYLES(autocompletion() 드롭다운은 CM6가 view.dom 자식으로 붙이므로
   scoped 속성이 안 닿을 수 있다 - :deep()으로 뚫어준다). */
:deep(.cm-completionLabel) {
  display: none;
}
:deep(.yona-mention-option) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
:deep(.yona-mention-option img) {
  border-radius: 3px;
  vertical-align: middle;
}
:deep(.yona-mention-option small) {
  opacity: 0.65;
  margin-left: 4px;
}
:deep(.yona-mention-option strong) {
  color: var(--yona-md-accent-color, #51aacc);
  font-weight: 700;
}
</style>
