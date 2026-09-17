// editor/element.ts와 동일한 패턴. 이렇게 빌드하면 Vue 앱 부트스트랩 없이 기존 Thymeleaf
// 템플릿(help/markdown.html 자리)에 태그 하나로 그대로 꽂을 수 있다. props가 없고(title
// 하나뿐, 기본값으로 충분) 별도 명령형 API도 필요 없어 editor의 defineExpose(getValue/
// setValue) 같은 장치는 두지 않았다.
import { defineCustomElement } from "vue";
import MarkdownHelp from "./MarkdownHelp.vue";

customElements.define("yona-help-markdown", defineCustomElement(MarkdownHelp));
