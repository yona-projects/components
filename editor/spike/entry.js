// P3-46 0단계 스파이크 전용 코드. 정식 컴포넌트 아님 — go/no-go 실험용.
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

const SAMPLE_DOC = [
  "# Shadow DOM + CM6 spike",
  "",
  "## 구문강조 확인용 헤딩",
  "",
  "일반 문단입니다. **굵게**, *기울임*, `인라인 코드`.",
  "",
  "```js",
  "function hello() {",
  "  return 1 + 1;",
  "}",
  "```",
  "",
  "- 목록 1",
  "- 목록 2",
].join("\n");

function baseExtensions() {
  return [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    EditorView.lineWrapping,
  ];
}

// mode: "no-root" | "with-root" | "light"
function mountEditor(container, mode) {
  let root; // ShadowRoot 여기에 attach
  let editorParent = container;

  if (mode === "light") {
    root = undefined; // light DOM: root 옵션 자체가 필요 없음
  } else {
    root = container.attachShadow({ mode: "open" });
    editorParent = root;
  }

  const viewConfig = {
    state: EditorState.create({
      doc: SAMPLE_DOC,
      extensions: baseExtensions(),
    }),
    parent: editorParent,
  };

  // 함정 2번 재현/반증: root 옵션을 의도적으로 누락시키는 케이스
  if (mode === "with-root") {
    viewConfig.root = root;
  }
  // mode === "no-root"일 땐 root를 절대 넘기지 않는다 (오류 재현 목적)
  // mode === "light"일 땐 root 옵션이 원래 필요 없다 (대조군)

  let view;
  let error = null;
  try {
    view = new EditorView(viewConfig);
  } catch (e) {
    error = e;
    // eslint-disable-next-line no-console
    console.error(`[spike:${mode}] EditorView 생성 중 오류:`, e);
    return { view: null, error, root };
  }
  return { view, error: null, root };
}

window.__spike = { mountEditor };
