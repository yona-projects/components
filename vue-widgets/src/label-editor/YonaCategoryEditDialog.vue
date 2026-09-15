<script setup lang="ts">
// yona.issue.LabelEditor.js의 카테고리 수정 다이얼로그(#editCategory) 부분만
// 뽑아 다시 썼다. 네이티브 <dialog> + <select data-toggle="tomselect">를 쓴다 -
// TomSelect 초기화는 이 컴포넌트가 아니라 site/layout.html의 전역
// DOMContentLoaded 스캐너(`document.querySelectorAll('[data-toggle="tomselect"]')`)
// 가 담당한다(1회성 스캔, MutationObserver 없음) - 그래서 이 다이얼로그를
// login-dialog와 동일하게 **처음부터(v-if로 감추지 않고) 항상 렌더링**해야
// DOMContentLoaded 시점에 이 <select>가 실제 라이트 DOM에 존재해 스캐너가
// 찾을 수 있다(<Teleport to="body">가 host 연결 시점에 동기적으로 실행되므로
// 시점상 문제 없음 - login-dialog에서 이미 검증된 패턴).
import { useTemplateRef } from "vue";
import { toRequestParams } from "./request";
import { msg } from "./messages";

interface YonaDialogEl extends HTMLElement {
  show(message: string, description?: string, options?: Record<string, unknown>): void;
}
interface TomSelectLike {
  setValue(value: string, silent?: boolean): void;
}

function getDialog(): YonaDialogEl | null {
  return document.querySelector("yona-dialog");
}
function alertMessage(message: string): void {
  getDialog()?.show(message);
}

const dialogRef = useTemplateRef<HTMLDialogElement>("dialogRef");
const nameInputRef = useTemplateRef<HTMLInputElement>("nameInputRef");
const exclusiveSelectRef = useTemplateRef<HTMLSelectElement & { tomselect?: TomSelectLike }>("exclusiveSelectRef");

interface CategoryData {
  projectId: string;
  categoryId: string;
  categoryName: string;
  categoryIsExclusive: boolean;
  categoryUpdateUri: string;
}
let current: CategoryData | null = null;

function show(data: CategoryData): void {
  current = data;
  if (nameInputRef.value) {
    nameInputRef.value.value = data.categoryName;
  }
  // 원본과 동일하게(P3-46 #5 후속 버그 수정) tomselect API로 값을 설정한다 -
  // 네이티브 select.value 대입은 TomSelect 초기화 후에는 표시에 반영되지 않는다.
  const select = exclusiveSelectRef.value;
  if (select?.tomselect) {
    select.tomselect.setValue(String(data.categoryIsExclusive));
  } else if (select) {
    select.value = String(data.categoryIsExclusive);
  }
  dialogRef.value?.showModal();
}

function hide(): void {
  dialogRef.value?.close();
}

function onDialogClick(event: MouseEvent): void {
  if (event.target === dialogRef.value) {
    hide();
    return;
  }
  const target = event.target as HTMLElement;
  if (target.closest?.('[data-dismiss="modal"]')) {
    hide();
  }
}

function showError(status: number, statusText: string, responseText: string, messageKey: string): void {
  if (responseText) {
    try {
      const error = JSON.parse(responseText) as Record<string, string>;
      let errorText = msg("label.failedTo", msg(messageKey));
      Object.keys(error).forEach((key) => {
        errorText += "\n" + error[key];
      });
      alertMessage(errorText);
      return;
    } catch {
      // JSON 파싱 실패 시 상태코드 기반 메시지로 폴백(원본과 동일).
    }
  }
  alertMessage(msg("error.failedTo", msg(messageKey), String(status), statusText));
}

async function onSubmit(): Promise<void> {
  if (!current || !nameInputRef.value || !exclusiveSelectRef.value) {
    return;
  }
  const requestData = {
    id: current.categoryId,
    name: nameInputRef.value.value.trim(),
    isExclusive: exclusiveSelectRef.value.value,
    "project.id": current.projectId,
  };

  try {
    const response = await fetch(current.categoryUpdateUri, { method: "put", body: toRequestParams(requestData) });
    if (!response.ok) {
      const text = await response.text();
      showError(response.status, response.statusText, text, "label.category.edit");
      return;
    }
    document.location.reload();
  } catch {
    alertMessage(msg("label.failedTo", msg("label.category.edit")));
  } finally {
    hide();
  }
}

defineExpose({ show, hide });
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialogRef" id="editCategory" class="modal yonaDialog" @click="onDialogClick">
      <div class="btn-dismiss"><button type="button" class="btn-transparent" data-dismiss="modal">&times;</button></div>
      <div class="message edit-label-category-form">
        <div class="center-txt">
          <input ref="nameInputRef" type="text" name="name" class="text category-name" :placeholder="msg('label.category')" />

          <div class="desc">
            <span>{{ msg("label.category.option") }}</span>
            <select ref="exclusiveSelectRef" name="isExclusive" data-toggle="tomselect" data-dropdown-css-class="tomselect-without-searchbox">
              <option value="false">{{ msg("label.category.option.multiple") }}</option>
              <option value="true">{{ msg("label.category.option.single") }}</option>
            </select>
          </div>
        </div>

        <div class="center-txt buttons mt20 mb20">
          <button type="button" class="ybtn ybtn-info btnSubmit" @click="onSubmit">{{ msg("button.save") }}</button>
          <button type="button" class="ybtn ybtn-default" data-dismiss="modal">{{ msg("button.cancel") }}</button>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>
