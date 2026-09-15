// YonaDropdown.vue를 defineCustomElement로 네이티브 커스텀 엘리먼트(<yona-dropdown>)로
// 컴파일하는 진입점 - editor/help-markdown/toast/switch와 동일한 패턴. 슬롯 기반이라
// 별도 wrapper 클래스가 필요 없다(스위치와 달리 host 자체에 라이트 DOM 자식을 새로
// 만들 필요가 없음 - hidden input은 SFC 안에서 useHost()로 직접 처리).
import { defineCustomElement } from "vue";
import YonaDropdown from "./YonaDropdown.vue";

customElements.define("yona-dropdown", defineCustomElement(YonaDropdown));
