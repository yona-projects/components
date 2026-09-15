// YonaAttachments.vue를 defineCustomElement로 네이티브 커스텀 엘리먼트
// (<yona-attachments>)로 컴파일하는 진입점 - 다른 위젯들과 동일한 패턴.
// defineExpose(configure)로 외부 textarea 참조/업로드 URL 등을 주입받는다(드롭다운/
// 다이얼로그/타입어헤드와 동일한 이유 - 컨테이너 밖에 있는 엘리먼트는 슬롯으로 못
// 받으므로 명령형 API로 받는다).
import { defineCustomElement } from "vue";
import YonaAttachments from "./YonaAttachments.vue";

customElements.define("yona-attachments", defineCustomElement(YonaAttachments));
