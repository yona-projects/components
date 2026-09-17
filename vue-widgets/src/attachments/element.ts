// 컨테이너 밖에 있는 엘리먼트(외부 textarea 등)는 슬롯으로 받을 수 없으므로
// defineExpose(configure)를 통한 명령형 API로 주입받는다.
import { defineCustomElement } from "vue";
import YonaAttachments from "./YonaAttachments.vue";

customElements.define("yona-attachments", defineCustomElement(YonaAttachments));
