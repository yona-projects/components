// Toast.vue를 defineCustomElement로 네이티브 커스텀 엘리먼트(<yona-toast>)로 컴파일하는
// 진입점 - editor/help-markdown과 동일한 패턴. defineExpose(push/clear)가 Vue 3.4+부터
// 커스텀 엘리먼트 인스턴스에 그대로 노출되므로 el.push(message, duration, title)/
// el.clear()로 원본 yona.ui.Toast 인스턴스의 push()/clear()와 동일하게 호출한다.
import { defineCustomElement } from "vue";
import Toast from "./Toast.vue";

customElements.define("yona-toast", defineCustomElement(Toast));
