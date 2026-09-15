// YonaDialog.vue를 defineCustomElement로 네이티브 커스텀 엘리먼트(<yona-dialog>)로
// 컴파일하는 진입점 - editor/help-markdown/toast/switch/dropdown과 동일한 패턴.
// defineExpose(show/hide)가 원본 yona.ui.Dialog 인스턴스의 show()/hide()와 동일한
// 계약이다.
import { defineCustomElement } from "vue";
import YonaDialog from "./YonaDialog.vue";

customElements.define("yona-dialog", defineCustomElement(YonaDialog));
