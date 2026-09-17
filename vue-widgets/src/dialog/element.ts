// defineExpose(show/hide)가 원본 yona.ui.Dialog 인스턴스의 show()/hide()와 동일한 계약이다.
import { defineCustomElement } from "vue";
import YonaDialog from "./YonaDialog.vue";

customElements.define("yona-dialog", defineCustomElement(YonaDialog));
