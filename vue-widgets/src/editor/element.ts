// YonaMarkdownEditor.vue를 Vue 공식 API인 defineCustomElement로 네이티브 커스텀
// 엘리먼트로 컴파일하는 진입점. 이렇게 빌드하면 원본(editor/, <yona-markdown-editor>)과
// 완전히 같은 방식으로 - Vue 앱 부트스트랩이나 마운트 지점 없이 - 기존 Thymeleaf 템플릿에
// 태그 하나(<yona-markdown-editor-vue>)로 그대로 꽂을 수 있다.
//
// props(name/editorMode/modelValue/renderUrl/mentionUrl)는 <script setup>의 타입 전용
// defineProps<{...}>()에서 컴파일 시 자동 생성된 런타임 옵션을 그대로 쓴다 - 커스텀
// 엘리먼트의 케밥케이스 속성(예: mention-url)이 자동으로 캐멀케이스 prop(mentionUrl)에
// 매핑된다.
//
// 이 빌드(vite.element.config.ts)는 라이브러리 모드 빌드(vite.config.ts, vue를 external로
// 뺌)와 달리 Vue 런타임을 번들에 포함한다 - 커스텀 엘리먼트는 소비 측(yona)이 Vue를 아예
// 모르는 페이지에 꽂히므로 자체 완결이어야 한다.
//
// light DOM textarea 계약 - 실제 <form> 안에 넣고 제출해보고, 첨부파일 위젯과 연동해보고서야
// 발견한 두 가지 함정:
//   1) defineCustomElement는 컴포넌트 전체(내부 textarea 포함)를 Shadow DOM 안에
//      마운트한다. Shadow DOM 안의 폼 필드는 조상 <form>의 FormData/제출에 자동으로
//      실리지 않는다(표준 동작).
//   2) yona.Attachments.js/yona.CommentAttachmentsUpdate.js는 (a) 첨부파일 카드 클릭 시
//      본문 텍스트를 raw textarea.value로 직접 계산하기 위해 document.querySelector로
//      실제 <textarea>를 찾고, (b) 그 결과를 다시 에디터에 반영하기 위해
//      `welTextarea.closest("yona-markdown-editor").value = ...`처럼 `.value` 접근자
//      프로퍼티에 직접 대입한다 - 둘 다 Shadow DOM 안의 Vue 인스턴스는 찾을 수도, 다룰
//      수도 없다.
// 두 문제 모두 원본(editor/)이 애초에 textarea를 light DOM에 뒀던 것과 같은 이유다 -
// ElementInternals(form-associated custom element)로 폼 참여만 따로 해결할 수도 있지만
// (실제로 한 번 그렇게 했었다), 그러면 (2)는 여전히 안 풀리고 light DOM textarea를 어차피
// 추가해야 한다면 그 textarea 하나가 (1)도 자연스럽게 해결한다(진짜 <form> 자손 필드가
// 되므로) - 그래서 ElementInternals는 걷어내고 light DOM textarea 하나로 통일했다.
//
// 구현: super.connectedCallback()(Vue 앱을 shadow root에 동기적으로 마운트)이 끝난 직후
// 이 wrapper가 스스로 실제 <textarea>를 만들어 host의 light DOM 자식으로 붙인다(원본과
// 동일한 속성 계약: name/id(editor- 접두어)/data-editor-mode/markdown="true"). 내부
// CM6 문서가 바뀔 때마다(YonaMarkdownEditor.vue가 composed:true로 shadow 경계를 넘겨
// 내보내는 input 이벤트) 이 light textarea도 같은 값으로 동기화하고 input/keyup을
// 재발행한다(원본의 syncTextareaFromEditor와 동일한 계약). 반대 방향(외부 코드가 raw
// textarea.value를 먼저 바꾼 뒤 `.value = ...`로 되돌려 반영하는 경로)을 위해 `value`
// getter/setter도 클래스에 직접 얹는다 - Vue의 defineExpose(getValue/setValue)는
// 메서드일 뿐 원본이 제공하던 `.value` 접근자 프로퍼티 자체는 아니므로 별도로 필요하다.
import { defineCustomElement } from "vue";
import YonaMarkdownEditor from "./YonaMarkdownEditor.vue";

interface YonaMarkdownEditorHost extends HTMLElement {
  getValue(): string;
  setValue(v: string): void;
}

const YonaMarkdownEditorElement = defineCustomElement(YonaMarkdownEditor);

// 여러 인스턴스가 한 페이지에 동시에 존재할 수 있다(원본 YonaMarkdownEditor.ts의
// instanceCounter와 동일한 이유 - 멘션 셀렉터 textarea[id^=editor-]는 접두어만 보므로
// 정확한 접미어 생성 방식에는 의존하지 않는다).
let instanceCounter = 0;

class CompatMarkdownEditorElement extends YonaMarkdownEditorElement {
  #lightTextarea: HTMLTextAreaElement | null = null;
  // 주의: light textarea 자신이 내보내는 input 이벤트도 light DOM을 타고 이 host까지
  // 버블링된다(light textarea가 host의 실제 자식이므로) - 그걸 다시 반응하면
  // #syncLightTextarea()가 또 dispatchEvent하고, 그게 또 버블링되어 무한 재귀에 빠진다
  // (실측: RangeError - Maximum call stack size exceeded). shadow 안에서 온
  // composed 이벤트는 이 host로 리타겟되어 event.target === this가 되지만, light
  // textarea 자신이 낸 이벤트는 event.target === 그 textarea 그대로이므로 이걸로
  // 구분해 후자는 무시한다.
  #onInternalInput = (event: Event): void => {
    if (event.target === this.#lightTextarea) {
      return;
    }
    this.#syncLightTextarea();
  };

  override connectedCallback(): void {
    super.connectedCallback();

    if (!this.#lightTextarea) {
      const name = this.getAttribute("name") ?? "";
      const editorMode = this.getAttribute("editor-mode") ?? "";
      const textarea = document.createElement("textarea");
      textarea.name = name;
      textarea.id = `editor-${name || "field"}-${++instanceCounter}`;
      textarea.setAttribute("data-editor-mode", editorMode);
      textarea.setAttribute("markdown", "true");
      textarea.style.display = "none";
      textarea.value = (this as unknown as YonaMarkdownEditorHost).getValue();
      this.appendChild(textarea);
      this.#lightTextarea = textarea;
    }

    this.addEventListener("input", this.#onInternalInput);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("input", this.#onInternalInput);
    if (this.#lightTextarea) {
      this.removeChild(this.#lightTextarea);
      this.#lightTextarea = null;
    }
    super.disconnectedCallback();
  }

  #syncLightTextarea(): void {
    if (!this.#lightTextarea) {
      return;
    }
    const value = (this as unknown as YonaMarkdownEditorHost).getValue();
    this.#lightTextarea.value = value;
    // 이미 light DOM에 있으므로(shadow 경계를 넘길 필요가 없다) composed 없이도 밖에서
    // 그대로 구독 가능하다 - 원본 syncTextareaFromEditor와 동일한 계약.
    this.#lightTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    this.#lightTextarea.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }

  /**
   * 원본(editor/)의 공개 `value` getter/setter와 동일한 계약. yona.Attachments.js의
   * `_syncMarkdownEditor(welTextarea)`가 `welTextarea.closest("...").value = welTextarea.value`
   * 형태로 대입하므로, 메서드(getValue/setValue)만으로는 부족하고 접근자 프로퍼티가
   * 반드시 필요하다.
   */
  get value(): string {
    return (this as unknown as YonaMarkdownEditorHost).getValue();
  }

  set value(newValue: string) {
    // setValue()가 CM6 트랜잭션을 동기적으로 dispatch하고, 그 updateListener가
    // syncTextareaFromEditor()를 통해 composed input 이벤트를 즉시(동기) 내보내므로
    // #onInternalInput -> #syncLightTextarea()가 이 호출이 끝나기 전에 이미 실행된다 -
    // 여기서 다시 부를 필요 없음(중복 호출 방지).
    (this as unknown as YonaMarkdownEditorHost).setValue(newValue);
  }
}

customElements.define("yona-markdown-editor-vue", CompatMarkdownEditorElement);
