<script setup lang="ts">
// yona.issue.LabelEditor.js의 라벨 수정 다이얼로그(#editLabel) 부분만 뽑아 다시
// 썼다. category-edit-dialog와 마찬가지로 <select data-toggle="tomselect">를
// 전역 스캐너가 초기화하도록 처음부터(v-if 없이) 항상 렌더링한다. 카테고리
// 드롭다운 옵션은 원본처럼 마운트 시점에 서버가 렌더링한 라벨 목록
// (`div[data-category-name]`)에서 한 번만 읽는다 - 새 카테고리 추가는 항상 전체
// 페이지 새로고침을 거치므로(YonaNewLabelForm 참고) 이 목록이 컴포넌트 생애
// 동안 바뀔 일이 없다.
//
// 색상 선택은 YonaColorPicker를 그대로 재사용한다(YonaNewLabelForm과 동일한
// 조합) - "같은 로직을 두 곳에 베끼지 않는다"는 이번 라운드의 핵심 리팩터링을
// 두 다이얼로그가 함께 누린다. 중복 라벨명/잘못된 색상 검증 에러는 이미 이식된
// <yona-popover>의 showPopoverError를 그대로 불러 쓴다(popover 위젯과의 실제
// 조합 - review-form이 review-form/attachments를 조합한 것과 같은 패턴).
import { onMounted, ref, useTemplateRef } from "vue";
import YonaColorPicker from "./YonaColorPicker.vue";
import { isValidColorExpr, getContrastColor, type RgbColorParser } from "./color";
import { toRequestParams } from "./request";
import { msg } from "./messages";

declare const RGBColor: new (color: string) => { ok: boolean; toHex(): string };

interface YonaDialogEl extends HTMLElement {
  show(message: string, description?: string, options?: Record<string, unknown>): void;
}
interface YonaPopoverEl extends HTMLElement {
  showPopoverError(target: HTMLElement, message: string, placement?: string): void;
}
interface TomSelectOption {
  value: string;
  text: string;
}
interface TomSelectLike {
  setValue(value: string, silent?: boolean): void;
  getValue(): string;
  options: Record<string, TomSelectOption>;
}

function getDialog(): YonaDialogEl | null {
  return document.querySelector("yona-dialog");
}
function alertMessage(message: string): void {
  getDialog()?.show(message);
}
function popoverErrorOn(target: HTMLElement | null, message: string): void {
  if (!target) {
    return;
  }
  const popover = document.querySelector<YonaPopoverEl>("yona-popover");
  popover?.showPopoverError(target, message, "bottom");
}

const parse: RgbColorParser = (color) => new RGBColor(color);

const dialogRef = useTemplateRef<HTMLDialogElement>("dialogRef");
const nameInputRef = useTemplateRef<HTMLInputElement>("nameInputRef");
const categorySelectRef = useTemplateRef<HTMLSelectElement & { tomselect?: TomSelectLike }>("categorySelectRef");
const nameStyle = ref<{ backgroundColor?: string }>({});
const nameContrastClass = ref<"white" | "dimgray" | "">("");
const colorText = ref("");

const categoryOptions = ref<{ id: string; name: string }[]>([]);

interface LabelData {
  categoryId: string;
  labelName: string;
  labelColor: string;
  updateUri: string;
}
let current: LabelData | null = null;

function readCategoryOptions(): { id: string; name: string }[] {
  const options: { id: string; name: string }[] = [];
  document.querySelectorAll<HTMLElement>("div[data-category-name]").forEach((el) => {
    const id = el.dataset.category;
    const name = el.dataset.categoryName;
    if (id && name) {
      options.push({ id, name });
    }
  });
  return options;
}

function getCategoryElementByName(categoryName: string | undefined): HTMLElement | null {
  if (!categoryName) {
    return null;
  }
  return document.querySelector(`div.category-wrap[data-category-name="${CSS.escape(categoryName)}"]`);
}

function isLabelExists(categoryName: string | undefined, labelName: string): boolean {
  const categoryEl = getCategoryElementByName(categoryName);
  return !!(categoryEl && categoryEl.querySelector(`[data-label-name="${CSS.escape(labelName)}"]`));
}

function applyNamePreview(color: string): void {
  if (!color) {
    return;
  }
  nameStyle.value = { backgroundColor: color };
  nameContrastClass.value = getContrastColor(color);
}

// 실제 페이지의 전역 TomSelect 스캐너(site/layout.html, 이 컴포넌트 소유가
// 아님)는 DOMContentLoaded 시점에 <select>를 스냅샷하고, 이후 Vue가 <option>을
// 추가해도 다시 스캔하지 않는다 - categoryOptions를 show() 시점(사용자가 실제로
// 편집 버튼을 눌러야 호출됨, DOMContentLoaded보다 한참 뒤)에 채우면 TomSelect가
// 이미 빈 <select>로 굳어버린 뒤라 tomselect.options/getValue()가 영원히
// 비어있게 되고, 그 결과 모든 PUT 요청의 category.id가 빈 문자열로 나가
// 수정 자체가 항상 실패한다(실대치 검증으로 실측 발견 - 서버가 400으로 거부).
// YonaCategoryEditDialog처럼 마운트 시점에 한 번만 채워야 DOMContentLoaded
// 스캔 전에 실제 <option>들이 라이트 DOM에 존재한다.
onMounted(() => {
  categoryOptions.value = readCategoryOptions();
});

function show(data: LabelData): void {
  current = data;
  colorText.value = data.labelColor;

  if (nameInputRef.value) {
    nameInputRef.value.value = data.labelName;
  }

  const select = categorySelectRef.value;
  if (select?.tomselect) {
    select.tomselect.setValue(data.categoryId);
  } else if (select) {
    select.value = data.categoryId;
  }

  dialogRef.value?.showModal();
  applyNamePreview(data.labelColor);
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

function onColorPreview(color: string): void {
  applyNamePreview(color);
}
// 원본 _onBlurEditColor는 색상이 무효해도 아무 알림도 안 띄운다(그냥
// _updateInputBySelectedColor가 falsy를 받아 조용히 no-op) - 이것이 alert를
// 띄우는 새 라벨 폼의 _onBlurInputColor와의 실제 차이(YonaColorPicker는 둘이
// 공유하지만 이 비대칭은 그대로 보존해야 한다). 실제 색상 검증 알림은 제출
// 시점(onSubmit의 popoverErrorOn)에서만 뜬다.
function onColorInvalid(_value: string): void {
  // 의도적으로 아무 것도 하지 않음(원본과 동일).
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
  if (!current || !nameInputRef.value || !categorySelectRef.value) {
    return;
  }

  const colorValue = colorText.value.trim();
  const name = nameInputRef.value.value.trim();
  // 원본과 동일하게: 요청 바디의 category.id는 네이티브 select.value를 그대로
  // 쓰고(TomSelect가 선택 변경 시 네이티브 select 값도 함께 동기화한다),
  // 카테고리 "이름" 조회만 tomselect.options[getValue()]로 별도로 한다.
  const categoryId = categorySelectRef.value.value;
  const tomselect = categorySelectRef.value.tomselect;
  const selectedOption = tomselect ? tomselect.options[tomselect.getValue()] : undefined;
  const categoryName = selectedOption ? selectedOption.text : undefined;

  const isLabelNameChanged = name !== current.labelName;
  if (isLabelNameChanged && isLabelExists(categoryName, name)) {
    popoverErrorOn(nameInputRef.value, msg("label.error.duplicated.in.category", categoryName || ""));
    return;
  }

  if (!isValidColorExpr(colorValue, parse)) {
    popoverErrorOn(document.querySelector<HTMLElement>(".edit-label-form .input-label-color"), msg("label.error.color", colorValue));
    return;
  }

  const requestData = { name, color: colorValue, "category.id": categoryId };

  try {
    const response = await fetch(current.updateUri, { method: "put", body: toRequestParams(requestData) });
    if (!response.ok) {
      const text = await response.text();
      showError(response.status, response.statusText, text, "label.edit");
      return;
    }
    document.location.reload();
  } catch {
    alertMessage(msg("label.failedTo", msg("label.edit")));
  } finally {
    hide();
  }
}

defineExpose({ show, hide });
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialogRef" id="editLabel" class="modal yonaDialog" @click="onDialogClick">
      <div class="btn-dismiss"><button type="button" class="btn-transparent" data-dismiss="modal">&times;</button></div>
      <div class="message edit-label-form">
        <div class="center-txt">
          <select ref="categorySelectRef" name="category.id" data-toggle="tomselect">
            <option v-for="category in categoryOptions" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select>

          <input
            ref="nameInputRef"
            type="text"
            name="name"
            class="text input-label-name"
            maxlength="250"
            :placeholder="msg('label.name')"
            :style="nameStyle"
            :class="nameContrastClass"
          />

          <YonaColorPicker
            v-model="colorText"
            edit-variant
            :preset-colors="[
              '#FF7770', '#F18CA7', '#FFB399', '#F1D55C', '#A5D870', '#32CDA1',
              '#9985D8', '#40A0EB', '#6BC4E9', '#DCBD98', '#8C8C9C', '#7A9CB4',
            ]"
            @preview="onColorPreview"
            @invalid="onColorInvalid"
          />
        </div>
        <div class="center-txt buttons mt20 mb20">
          <button type="button" class="ybtn ybtn-info btnSubmit" @click="onSubmit">{{ msg("button.save") }}</button>
          <button type="button" class="ybtn ybtn-default" data-dismiss="modal">{{ msg("button.cancel") }}</button>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>
