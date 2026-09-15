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
import { defineCustomElement } from "vue";
import YonaMarkdownEditor from "./YonaMarkdownEditor.vue";

customElements.define("yona-markdown-editor-vue", defineCustomElement(YonaMarkdownEditor));
