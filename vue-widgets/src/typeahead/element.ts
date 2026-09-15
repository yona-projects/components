// YonaTypeahead.vue를 defineCustomElement로 네이티브 커스텀 엘리먼트(<yona-typeahead>)로
// 컴파일하는 진입점 - editor/help-markdown/toast/switch/dropdown/dialog와 동일한 패턴.
// 이 위젯은 정적 템플릿이 없어(다른 위젯과 달리) yona.ui.Typeahead.js 어댑터가 기존
// <input>을 감싸는 <yona-typeahead>를 직접 생성하고 defineExpose(configure)로 설정을
// 넘긴다.
import { defineCustomElement } from "vue";
import YonaTypeahead from "./YonaTypeahead.vue";

customElements.define("yona-typeahead", defineCustomElement(YonaTypeahead));
