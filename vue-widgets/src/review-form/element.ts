// 이 위젯은 <yona-markdown-editor-vue>/<yona-attachments>를 자식으로 참조하므로,
// 사용하는 페이지에 그 두 위젯의 스크립트도 함께 로드돼 있어야 한다.
import { defineCustomElement } from "vue";
import YonaReviewForm from "./YonaReviewForm.vue";

customElements.define("yona-review-form", defineCustomElement(YonaReviewForm));
