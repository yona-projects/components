// YonaMarkdownEditor.vue를 Vue 공식 API인 defineCustomElement로 네이티브 커스텀
// 엘리먼트로 컴파일하는 진입점. 이렇게 빌드하면 원본(editor/, <yona-markdown-editor>)과
// 완전히 같은 방식으로 - Vue 앱 부트스트랩이나 마운트 지점 없이 - 기존 Thymeleaf 템플릿에
// 태그 하나(<yona-markdown-editor-vue>)로 그대로 꽂을 수 있다.
//
// props(name/editorMode/modelValue/renderUrl/mentionUrl)는 <script setup>의 타입 전용
// defineProps<{...}>()에서 컴파일 시 자동 생성된 런타임 옵션을 그대로 쓴다 - 커스텀
// 엘리먼트의 케밥케이스 속성(예: mention-url)이 자동으로 캐멀케이스 prop(mentionUrl)에
// 매핑된다. defineExpose(getValue/setValue)도 Vue 3.4+부터 커스텀 엘리먼트 인스턴스에
// 그대로 노출된다(el.getValue()/el.setValue(...)로 직접 호출 가능) - 원본의 공개 value
// getter/setter와 동일한 명령형 접근을 제공한다.
//
// 이 빌드(vite.element.config.ts)는 라이브러리 모드 빌드(vite.config.ts, vue를 external로
// 뺌)와 달리 Vue 런타임을 번들에 포함한다 - 커스텀 엘리먼트는 소비 측(yona)이 Vue를 아예
// 모르는 페이지에 꽂히므로 자체 완결이어야 한다.
//
// 폼 참여(ElementInternals) - 실제 <form> 안에 넣고 제출해보고서야 발견한 함정:
// defineCustomElement는 컴포넌트 전체(내부 textarea 포함)를 Shadow DOM 안에 마운트한다.
// Shadow DOM 안의 폼 필드는 조상 <form>의 FormData/제출에 자동으로 실리지 않는다(표준
// 동작) - 원본(editor/)이 textarea를 일부러 light DOM에 뒀던 이유가 바로 이것이었다.
// Vue의 defineCustomElement는 아직 이 문제를 위한 공식 지원(form-associated custom
// element, vuejs/core #12129)이 없어(2026-09 기준 미병합) 표준 웹 컴포넌트 API
// (ElementInternals)로 직접 연결했다: defineCustomElement()가 반환한 클래스를 상속해
// `static formAssociated = true`를 얹고 `attachInternals()`로 얻은 ElementInternals에
// 문서가 바뀔 때마다(YonaMarkdownEditor.vue가 composed:true로 내보내는 input 이벤트를
// 받아) `setFormValue()`를 호출한다 - 이러면 이 커스텀 엘리먼트 자신이 `name` 속성으로
// 지정된 필드처럼(<input name="body">와 동일하게) 조상 폼의 제출값에 포함된다.
import { defineCustomElement } from "vue";
import YonaMarkdownEditor from "./YonaMarkdownEditor.vue";

interface YonaMarkdownEditorHost extends HTMLElement {
  getValue(): string;
}

const YonaMarkdownEditorElement = defineCustomElement(YonaMarkdownEditor);

class FormAssociatedMarkdownEditorElement extends YonaMarkdownEditorElement {
  static formAssociated = true;

  #internals: ElementInternals;

  constructor() {
    super();
    this.#internals = this.attachInternals();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Vue의 defineCustomElement는 connectedCallback 안에서 동기적으로 앱을 마운트하므로,
    // super 호출 직후 getValue()가 이미 유효하다 - 초기값을 폼에 즉시 등록해둔다(사용자가
    // 한 글자도 안 치고 바로 제출해도 값이 실려야 한다).
    this.#syncFormValue();
    this.addEventListener("input", this.#syncFormValue);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("input", this.#syncFormValue);
    super.disconnectedCallback();
  }

  #syncFormValue = (): void => {
    this.#internals.setFormValue((this as unknown as YonaMarkdownEditorHost).getValue());
  };
}

customElements.define("yona-markdown-editor-vue", FormAssociatedMarkdownEditorElement);
