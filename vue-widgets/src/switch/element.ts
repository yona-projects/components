// YonaSwitch.vue를 defineCustomElement로 네이티브 커스텀 엘리먼트(<yona-switch>)로
// 컴파일하는 진입점 - editor/help-markdown/toast와 동일한 패턴. 명령형 API가 필요
// 없어(체크박스 자체가 진실의 원천, 컴포넌트는 슬롯 안의 그 체크박스를 직접 조작한다)
// wrapper 클래스도 defineExpose도 두지 않았다.
import { defineCustomElement } from "vue";
import YonaSwitch from "./YonaSwitch.vue";

customElements.define("yona-switch", defineCustomElement(YonaSwitch));
