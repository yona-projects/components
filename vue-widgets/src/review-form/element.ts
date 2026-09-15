// YonaReviewForm.vue를 defineCustomElement로 네이티브 커스텀 엘리먼트
// (<yona-review-form>)로 컴파일하는 진입점 - 다른 위젯들과 동일한 패턴.
// defineExpose(show/hide/toggle/isVisible/height/offset/configure)가 원본
// yona.CodeCommentBox의 공개 계약과 동일하다. 이 위젯은 <yona-markdown-editor-vue>/
// <yona-attachments>를 자식으로 참조하므로, 사용하는 페이지에 그 두 위젯의 스크립트도
// 함께 로드돼 있어야 한다(어댑터가 커스텀 엘리먼트로 이 인스턴스를 만들 때는 이미
// customElements.define이 끝난 뒤이므로 로드 순서는 문제되지 않는다).
import { defineCustomElement } from "vue";
import YonaReviewForm from "./YonaReviewForm.vue";

customElements.define("yona-review-form", defineCustomElement(YonaReviewForm));
