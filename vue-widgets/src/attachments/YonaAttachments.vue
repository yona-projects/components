<script setup lang="ts">
// yona.Attachments.js(+yona.Files.js의 XHR2 업로드 부분)를 Vue 3 SFC로 다시 쓴 버전.
// common/uploadForm.html(드롭존+업로드 버튼+첨부파일 카드 목록)의 실제 대체 대상이다.
//
// 다른 위젯들과 마찬가지로 전체를 무조건 Shadow DOM에 넣지 않는다 - 이번엔 두 가지를
// 구분했다:
// 1. 첨부파일 카드 마크업(site/layout.html의 <script id="tplAttachedFile">)은 처음엔
//    호출부마다 다른 커스텀 템플릿처럼 보였지만(yona.*.Write.js 각각이
//    htOptions.sTplFileItem을 받음), 실제로 이 템플릿을 오버라이드하는 호출부는
//    전수 조사 결과 0건이었다(전부 이 전역 템플릿을 그대로 읽어 쓴다) - 즉 실질적으로
//    닫힌 계약이라 Vue가 선언적으로 그대로 그린다(bootstrap.css/yona.css의
//    .attached-file 이식).
// 2. 반면 <textarea>(마크다운 에디터)는 이 컨테이너 밖 다른 위치에 있는 완전히 별개의
//    엘리먼트라(같은 폼 안이지만 형제 관계가 아님) 슬롯으로 투과시킬 수 없다 -
//    드롭다운/다이얼로그와 동일하게 `configure()` 명령형 API로 외부 참조를 주입받는다.
//
// 첨부파일 컨테이너 자체를 직접 querySelector로 파고드는 외부 코드는 없다(전수 grep
// 확인 - board/code.Diff/code.SvnDiff/issue/milestone.View.js 5곳 전부
// `elContainer._isYonaAttachment` expando만 확인) - 그래서 host 자신을 감싸는 데
// 아무 위험이 없다.
//
// yona.Files.js(XHR2 진행률/드래그/붙여넣기 엔진, pub-sub 이벤트 버스)는 그대로
// vanilla로 남겨두지 않고 이 컴포넌트가 자체적으로 업로드 로직을 소유한다 - 그
// 이벤트 버스를 구독하는 다른 소비자가 없고(아바타 업로드는 yona.Files.js를 독립적으로
// 직접 쓴다, 이 컴포넌트와 무관), 문자열 네임스페이스 기반 pub-sub을 Vue 반응형으로
// 옮길 실익이 없었다.
import { computed, onMounted, onUnmounted, ref, useHost, useTemplateRef } from "vue";
import { markersToFiles, type AttachmentMarker } from "./markers";

interface AttachedFile {
  submitId: string;
  id?: string;
  name: string;
  url?: string;
  mimeType?: string;
  size: number;
  progress: number;
}

interface ConfigureOptions {
  textarea?: HTMLTextAreaElement | null;
  uploadURL?: string;
  listURL?: string;
}

const host = useHost();
const fileInputRef = useTemplateRef<HTMLInputElement>("fileInputRef");

const files = ref<AttachedFile[]>([]);
const isDraggingOver = ref(false);
const hasFiles = computed(() => files.value.length > 0);

// XHR2(FormData/File API/ProgressEvent)는 이 앱이 지원하는 모든 현대 브라우저에서
// 항상 사용 가능하다(원본의 bXHR2/bDroppable/bPastable 피처 감지 - IE 폴백 분기는
// 이식하지 않았다, 이미 원본 자체가 "현재 모든 현대 브라우저는 이 경로"라고 문서화한
// 대상).
const dropHelpVisible = true;
const pasteHelpVisible = true;

let externalTextarea: HTMLTextAreaElement | null = null;
let uploadURL = "/files";
// 원본 AttachmentController에는 "/attachments" 엔드포인트 자체가 없다(GET /files가
// containerType/containerId 쿼리로 목록을 반환한다) - 이 기본값을 그대로 쓰는
// 소비자가 있으면 loadExistingAttachments()의 fetch가 항상 404 나서(에러는
// 조용히 무시되므로) 기존 첨부파일 목록이 안 뜨는 잠복 버그였다(2026-09-16
// label-editor 이후 재검증 세션에서 백엔드 컨트롤러 대조로 발견).
let listURL = "/files";
const temporaryFileIds: string[] = [];

function getCsrfHeaders(): Record<string, string> {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? { "X-XSRF-TOKEN": decodeURIComponent(match[1] ?? "") } : {};
}

function getSubmitId(): string {
  const now = new Date();
  return (
    "" +
    now.getSeconds() +
    now.getMilliseconds() +
    "-" +
    now.getFullYear() +
    "-" +
    (now.getMonth() + 1) +
    "-" +
    now.getDate() +
    "-" +
    now.getHours() +
    "-" +
    now.getMinutes()
  );
}

function isHtml5Video(mimeType: string | undefined): boolean {
  return ["video/mp4", "video/ogg", "video/webm"].indexOf((mimeType || "").toString().trim().toLowerCase()) >= 0;
}

// 원본 _getLinkText
function getLinkText(file: AttachedFile): string {
  const mimeType = file.mimeType || "";
  const linkText = `[${file.name}](${file.url}) `;
  if (mimeType.substring(0, 5) === "image") {
    return "!" + linkText;
  }
  if (isHtml5Video(mimeType)) {
    const wrap = document.createElement("div");
    const video = document.createElement("video");
    video.className = "video-js";
    video.setAttribute("data-setup", "{}");
    video.setAttribute("controls", "controls");
    const source = document.createElement("source");
    source.setAttribute("src", file.url ?? "");
    source.setAttribute("type", mimeType);
    video.appendChild(source);
    wrap.appendChild(video);
    wrap.appendChild(document.createTextNode(linkText));
    return wrap.innerHTML;
  }
  return linkText;
}

function getTempLinkText(name: string): string {
  return `<!--_${name}_-->`;
}

// 원본 _syncMarkdownEditor - textarea.closest("yona-markdown-editor,
// yona-markdown-editor-vue")로 CodeMirror 쪽에도 강제 반영한다.
function syncMarkdownEditor(textarea: HTMLTextAreaElement): void {
  const editor = textarea.closest("yona-markdown-editor, yona-markdown-editor-vue") as
    | (HTMLElement & { value: string })
    | null;
  if (editor) {
    editor.value = textarea.value;
  }
}

function setCursorPosition(textarea: HTMLTextAreaElement, pos: number): void {
  textarea.setSelectionRange(pos, pos);
}

function insertLinkToTextarea(link: string): void {
  if (!externalTextarea) return;
  const pos = externalTextarea.selectionStart ?? externalTextarea.value.length;
  const text = externalTextarea.value;
  externalTextarea.value = text.substring(0, pos) + link + text.substring(pos);
  setCursorPosition(externalTextarea, pos + link.length);
  syncMarkdownEditor(externalTextarea);
}

function clearLinkInTextarea(link: string): void {
  if (!externalTextarea) return;
  let raw = externalTextarea.value.split(link).join("");
  raw = raw.split(link.trim()).join("");
  externalTextarea.value = raw;
  syncMarkdownEditor(externalTextarea);
}

function replaceLinkInTextarea(link1: string, link2: string): void {
  if (!externalTextarea) return;
  const curPos = externalTextarea.selectionStart ?? 0;
  const gap = link2.length - link1.length - 1;
  externalTextarea.value = externalTextarea.value.split(link1).join(link2);
  if (gap > 0) {
    setCursorPosition(externalTextarea, curPos + gap);
  }
  syncMarkdownEditor(externalTextarea);
}

function addUploadFileIdToForm(id: string): void {
  if (temporaryFileIds.indexOf(id) === -1) {
    temporaryFileIds.push(id);
  }
  updateHiddenInput();
}

function removeUploadFileIdFromForm(id: string): void {
  const index = temporaryFileIds.indexOf(id);
  if (index !== -1) {
    temporaryFileIds.splice(index, 1);
  }
  updateHiddenInput();
}

// 원본은 hidden input(name=temporaryUploadFiles)을 welToAttach(targetFormId 또는
// elContainer)의 첫 자식으로 만든다 - 여기서는 host(라이트 DOM) 자신의 자식으로
// 명령형으로 만든다(에디터의 light-DOM textarea, 드롭다운의 hidden input과 동일한
// 이유 - 실제 <form> 제출에 실려야 한다).
let hiddenInputEl: HTMLInputElement | null = null;
function updateHiddenInput(): void {
  if (!host) return;
  if (!hiddenInputEl) {
    hiddenInputEl = document.createElement("input");
    hiddenInputEl.type = "hidden";
    hiddenInputEl.name = "temporaryUploadFiles";
    host.insertBefore(hiddenInputEl, host.firstChild);
  }
  hiddenInputEl.value = temporaryFileIds.join(",");
}

function findFile(predicate: (f: AttachedFile) => boolean): AttachedFile | undefined {
  return files.value.find(predicate);
}

function uploadSingleFile(file: File, presetSubmitId?: string): void {
  const submitId = presetSubmitId ?? getSubmitId();
  const entry: AttachedFile = {
    submitId,
    name: file.name === "image.png" ? `${submitId}.png` : file.name,
    size: file.size,
    progress: 0,
  };
  files.value.unshift(entry);

  const formData = new FormData();
  formData.append("filePath", file, entry.name);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", uploadURL);
  const headers = getCsrfHeaders();
  Object.keys(headers).forEach((key) => xhr.setRequestHeader(key, headers[key] ?? ""));

  if (xhr.upload) {
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const target = findFile((f) => f.submitId === submitId);
        if (target) {
          target.progress = Math.ceil((event.loaded / event.total) * 100);
        }
      }
    });
  }

  xhr.addEventListener("load", () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      let response: { id: string; name: string; url: string; mimeType: string; size: number };
      try {
        response = JSON.parse(xhr.responseText);
      } catch {
        onErrorUpload(submitId, "invalid response");
        return;
      }
      onSuccessUpload(submitId, response);
    } else {
      onErrorUpload(submitId, xhr.statusText || String(xhr.status));
    }
  });
  xhr.addEventListener("error", () => onErrorUpload(submitId, "network error"));

  xhr.send(formData);
}

function onSuccessUpload(submitId: string, response: { id: string; name: string; url: string; mimeType: string; size: number }): void {
  const target = findFile((f) => f.submitId === submitId);
  if (!target) return;

  addUploadFileIdToForm(response.id);
  target.id = response.id;
  target.name = response.name;
  target.url = response.url;
  target.mimeType = response.mimeType;
  target.size = response.size;
  target.progress = 100;

  // 붙여넣기(이미지)만 업로드 전에 임시 표시(HTML 주석, submitId 기준)를 미리 넣어둔다
  // (onPaste 참고) - 파일 선택/드래그 업로드는 애초에 아무것도 안 넣으므로 이 치환은
  // 조용히 no-op(원본과 동일 - split/join 기반이라 대상이 없으면 아무 변화 없음).
  replaceLinkInTextarea(getTempLinkText(submitId), getLinkText(target));
}

function onErrorUpload(submitId: string, message: string): void {
  const index = files.value.findIndex((f) => f.submitId === submitId);
  if (index !== -1) {
    files.value.splice(index, 1);
  }
  // 붙여넣기로 미리 넣어둔 임시 표시를 정리한다(submitId 기준 - insert/replace와 동일한
  // 키). 파일 선택/드래그 업로드는 애초에 아무것도 안 넣었으므로 조용히 no-op.
  clearLinkInTextarea(getTempLinkText(submitId));
  // eslint-disable-next-line no-console
  console.error("파일 업로드 실패:", message);
}

function onChangeFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const uploadFiles = input.files;
  if (uploadFiles) {
    Array.from(uploadFiles).forEach((file) => uploadSingleFile(file));
  }
  input.value = "";
}

function onDragOver(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  isDraggingOver.value = true;
}

function onDragLeave(event: DragEvent): void {
  event.preventDefault();
  isDraggingOver.value = false;
}

function onDrop(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  isDraggingOver.value = false;
  const dropFiles = event.dataTransfer?.files;
  if (!dropFiles || dropFiles.length === 0) return;
  Array.from(dropFiles).forEach((file) => uploadSingleFile(file));
}

function onPaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.kind === "file" && item.type.indexOf("image") === 0) {
      const submitId = getSubmitId();
      const pastedFile = item.getAsFile();
      if (!pastedFile) continue;
      const fileName = `${submitId}.png`;
      // 붙여넣기는 원본과 동일하게 업로드 완료 전에 임시 표시(HTML 주석, submitId 기준 -
      // onSuccessUpload의 replaceLinkInTextarea와 동일한 키를 써야 나중에 치환된다)를
      // 먼저 넣는다.
      insertLinkToTextarea(getTempLinkText(submitId));
      const renamed = new File([pastedFile], fileName, { type: pastedFile.type });
      uploadSingleFile(renamed, submitId);
      event.preventDefault();
    }
  }
}

function onClickItem(file: AttachedFile, event: MouseEvent): void {
  if (!file.id) return; // 업로드 중(temporary)인 카드는 클릭 무시
  const target = event.target as HTMLElement;
  if (target.closest(".btn-delete")) {
    deleteFile(file);
  } else {
    insertLinkToTextarea(getLinkText(file));
  }
}

function deleteFile(file: AttachedFile): void {
  if (!file.url) return;
  fetch(file.url, { method: "post", body: new URLSearchParams({ _method: "delete" }) })
    .then((response) => {
      if (!response.ok) {
        return Promise.reject(response);
      }
      removeUploadFileIdFromForm(file.id ?? "");
      clearLinkInTextarea(getLinkText(file));
      const index = files.value.indexOf(file);
      if (index !== -1) {
        files.value.splice(index, 1);
      }
    })
    .catch(() => {
      // eslint-disable-next-line no-console
      console.error("첨부파일 삭제 실패");
    });
}

function humanFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0}B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)}${units[unitIndex]}`;
}

// yona.CommentAttachmentsUpdate.js 흡수(댓글 수정 폼) 대응 - 서버가 이미
// commentAttachmentsByCommentId 모델 속성으로 첨부파일 목록을 갖고 있는데, 백엔드
// AccessControl.isAllowedAttachment()가 ISSUE_COMMENT/NONISSUE_COMMENT 컨테이너
// 타입을 지원하지 않아(아래 loadExistingAttachments가 쓰는 GET /files 경로가
// 항상 403) resourceType/resourceId 기반 조회를 쓸 수 없다(백엔드 보안 코드
// 수정은 이 세션 스코프 밖) - 그래서 서버가 이미 렌더링해둔 마커 엘리먼트를
// host의 라이트 DOM 자식으로 그대로 두고 마운트 시점에 한 번만 읽어 files를
// 직접 채운다(추가 네트워크 요청 없음). 순수 변환은 markers.ts(TDD)에 있다.
function readInitialAttachmentMarkers(): AttachmentMarker[] {
  if (!host) return [];
  return Array.from(host.querySelectorAll<HTMLElement>(":scope > .attached-file-marker")).map((el) => ({
    id: el.dataset.id ?? "",
    name: el.dataset.name ?? "",
    href: el.dataset.href ?? "",
    mime: el.dataset.mime ?? "",
    size: el.dataset.size ?? "",
  }));
}

function loadExistingAttachments(resourceType: string, resourceId?: string): void {
  const params = new URLSearchParams({ containerType: resourceType || "", containerId: resourceId || "" });
  fetch(`${listURL}?${params}`)
    .then((response) => (response.ok ? response.json() : Promise.reject(response)))
    .then((data: { attachments?: AttachedFile[]; tempFiles?: AttachedFile[] }) => {
      (data.attachments || []).forEach((file) => {
        files.value.push({ ...file, submitId: file.id ?? getSubmitId(), progress: 100 });
      });
      if (!resourceId) {
        (data.tempFiles || []).forEach((file) => {
          files.value.push({ ...file, submitId: file.id ?? getSubmitId(), progress: 100 });
        });
      }
    })
    .catch(() => {
      /* 목록 조회 실패는 원본과 동일하게 조용히 무시(별도 에러 UI 없음) */
    });
}

// 원본 yona.Files.js._attachEvent: 붙여넣기는 업로드 컨테이너가 아니라 실제 마크다운
// 에디터의 <textarea>에 포커스가 있을 때 동작한다(dragover/drop도 컨테이너뿐 아니라
// textarea 자체에 드롭하는 경우까지 지원한다) - 이 컨테이너 자신에 건 이벤트만으로는
// 절대 재현되지 않는 별개의 대상이라, 외부 textarea 참조를 받는 시점에 직접
// addEventListener로 붙인다.
function attachExternalTextareaEvents(textarea: HTMLTextAreaElement): void {
  textarea.addEventListener("paste", onPaste);
  textarea.addEventListener("dragover", onDragOver);
  textarea.addEventListener("drop", onDrop);
}

function detachExternalTextareaEvents(textarea: HTMLTextAreaElement): void {
  textarea.removeEventListener("paste", onPaste);
  textarea.removeEventListener("dragover", onDragOver);
  textarea.removeEventListener("drop", onDrop);
}

function configure(options: ConfigureOptions & { resourceType?: string; resourceId?: string } = {}): void {
  if (externalTextarea) {
    detachExternalTextareaEvents(externalTextarea);
  }
  externalTextarea = options.textarea ?? null;
  if (externalTextarea) {
    attachExternalTextareaEvents(externalTextarea);
  }
  uploadURL = options.uploadURL ?? uploadURL;
  listURL = options.listURL ?? listURL;

  const resourceType = options.resourceType ?? host?.getAttribute("data-resource-type") ?? undefined;
  const resourceId = options.resourceId ?? host?.getAttribute("data-resource-id") ?? undefined;
  if (resourceType) {
    loadExistingAttachments(resourceType, resourceId);
  }
}

onMounted(() => {
  updateHiddenInput();
  const markers = readInitialAttachmentMarkers();
  if (markers.length > 0) {
    files.value = markersToFiles(markers);
  }
});

onUnmounted(() => {
  hiddenInputEl?.remove();
  if (externalTextarea) {
    detachExternalTextareaEvents(externalTextarea);
  }
});

defineExpose({ configure });
</script>

<template>
  <div
    class="upload-wrap content-footer"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="attach-wrap">
      <span v-if="dropHelpVisible" class="help help-droppable" style="display: inline">첨부할 파일을 끌어다 놓거나</span>
      <div class="btn-wrap">
        <div class="nbtn medium white fake-file-wrap">
          <i class="yobicon-upload"></i> <span>업로드</span>
          <input ref="fileInputRef" type="file" class="file" name="filePath" multiple @change="onChangeFile" />
        </div>
      </div>
      <span class="plain">버튼을 클릭해서 선택하세요</span>
      <span v-if="pasteHelpVisible" class="help help-pastable" style="display: inline">클립보드 이미지를 붙여 넣을 수도 있습니다</span>
    </div>

    <ul class="attached-files unstyled" :style="{ display: hasFiles ? 'block' : 'none' }">
      <li
        v-for="file in files"
        :key="file.submitId"
        class="attached-file"
        :class="{ complete: !!file.id, temporary: !file.id }"
        :id="file.id ? undefined : file.submitId"
        :data-id="file.id"
        :data-name="file.name"
        :data-href="file.url"
        :data-mime="file.mimeType"
        @click="onClickItem(file, $event)"
      >
        <i class="yobicon-supportrequest"></i>
        <i class="mimetype" :class="{ 'yobicon-video2': isHtml5Video(file.mimeType) }" :style="{ display: isHtml5Video(file.mimeType) ? '' : undefined }"></i>
        <strong class="name">{{ file.name }}</strong>
        <span class="size">{{ humanFileSize(file.size) }}</span>
        <div class="pull-right">
          <div class="progress upload-progress"><div class="bar orange" :style="{ width: file.progress + '%' }"></div></div>
        </div>
        <button type="button" class="btn-transparent btn-delete pull-right">&times;</button>
        <span class="pull-right nbtn small white btn-insert">클릭해서 삽입</span>
      </li>
    </ul>
    <p class="right-txt help" :style="{ display: hasFiles ? 'block' : 'none' }">
      <i class="yobicon-supportrequest"></i> 표시된 파일은 글을 저장하면 첨부됩니다.
    </p>
    <div class="upload-drop-here" :style="{ display: isDraggingOver ? 'block' : 'none' }">
      <div class="msg-wrap"><div class="msg">파일을 여기에 놓으세요</div></div>
    </div>
  </div>
</template>

<style>
/* :host는 scoped 블록 안에 두면 무효 셀렉터가 되어 조용히 사라진다(스위치/드롭다운/
   다이얼로그/타입어헤드 위젯에서 이미 실측 확인). */
:host {
  display: block;
}
</style>

<style scoped>
/* yona.css의 .upload-wrap/.attach-wrap/.attached-file/.upload-drop-here 및
   .nbtn(+.medium/.white 조합만 - 이 위젯이 실제 쓰는 고정 조합) 그대로 이식 -
   이 위젯은 전부 Shadow DOM에서 렌더링되므로 전역 CSS가 안 닿는다. */
.upload-wrap {
  padding: 10px !important;
  position: relative;
}
.upload-wrap .help {
  display: none;
}
.upload-wrap .attach-wrap {
  text-align: center;
}
.upload-wrap .attach-wrap .btn-wrap {
  display: inline-block !important;
  margin: 0 5px;
  vertical-align: top;
}
.upload-wrap .attach-wrap .plain {
  display: inline-block;
  line-height: 30px;
}
.upload-wrap .attached-files {
  padding: 0;
  margin-bottom: 0;
  margin-top: 15px;
  border-top: 1px solid #e0e0e0;
  padding: 15px 0px;
  list-style: none;
}
.attached-file {
  display: inline-block;
  height: 30px;
  line-height: 30px;
  border: 1px solid #ccc;
  background: #fafafa;
  padding: 0 10px;
  margin: 5px 4px;
  cursor: pointer;
  overflow: hidden;
  transition-duration: 0.5s;
}
.attached-file:hover {
  border: 1px solid #f36c22;
}
.attached-file i {
  display: none;
  margin-right: 3px;
  vertical-align: middle;
  color: #3a7ee5;
}
.attached-file .name {
  display: inline-block;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  transition-duration: 0.5s;
}
.attached-file .size {
  font-size: 11px;
  vertical-align: middle;
}
.attached-file .progress {
  display: inline-block;
  width: 100px;
  height: 7px;
  margin: 0;
  overflow: hidden;
}
.attached-file .btn-delete {
  width: 30px;
  height: 30px;
  font-size: 1.5em;
  font-weight: bold;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.attached-file .btn-delete:hover {
  color: #f36c22;
}
.attached-file .btn-insert {
  display: none;
  line-height: 20px;
  margin-top: 2px;
  margin-right: 10px;
  box-shadow: none;
}
.attached-file .btn-insert:hover {
  background: #fff;
  color: #f36c22;
}
.attached-file.complete .progress {
  display: none;
}
.attached-file.complete .btn-delete {
  display: inline-block;
}
.attached-file.complete .btn-insert {
  display: block;
}
.attached-file.temporary i {
  display: inline-block;
}
.upload-drop-here {
  position: absolute;
  top: 2px;
  left: 2px;
  right: 2px;
  bottom: 2px;
  border: 3px dashed #ffb23d;
  background: rgba(255, 255, 255, 0.8);
  z-index: 9999;
  pointer-events: none;
}
.upload-drop-here .msg-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.upload-drop-here .msg {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  text-align: center;
  transform: translateY(-50%);
}
.nbtn {
  text-align: center;
  font-weight: bold;
  font-size: 11px;
  line-height: 18px;
  border: 0;
  padding: 0;
  margin-right: 5px;
  white-space: nowrap;
  color: #fff;
  background-color: #707070;
  box-shadow: inset 0px -1px 1px rgba(0, 0, 0, 0.3);
  border-radius: 2px;
  display: inline-block;
  cursor: pointer;
}
.nbtn.white {
  color: #222;
  background-color: #fff;
}
.nbtn.white:hover {
  background-color: #e6e6e6;
  color: #f36c22;
}
div.nbtn.medium {
  padding: 6px 20px;
}
.nbtn.small {
  font-size: 10px;
  padding: 3px 10px;
}
.fake-file-wrap {
  position: relative;
  display: block;
  clear: both;
  overflow: hidden;
  cursor: pointer;
}
.fake-file-wrap:hover {
  background: #e6e6e6;
}
.fake-file-wrap .file {
  position: absolute;
  z-index: 2;
  cursor: pointer;
  top: 0;
  left: 5px;
  min-width: 100px;
  width: 100%;
  opacity: 0;
}
</style>
