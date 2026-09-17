// 슬롯 기반이라 별도 wrapper 클래스가 필요 없다(스위치와 달리 host 자체에 라이트 DOM
// 자식을 새로 만들 필요가 없음 - hidden input은 SFC 안에서 useHost()로 직접 처리).
import { defineCustomElement } from "vue";
import YonaDropdown from "./YonaDropdown.vue";

customElements.define("yona-dropdown", defineCustomElement(YonaDropdown));
