<script setup lang="ts">
// 카테고리/라벨 편집 다이얼로그는 각자 독립된 커스텀 엘리먼트지만, 셋 다 서버가
// 렌더링한 `div[data-category-name]`을 그때그때 다시 읽어 공유 진실 원천으로
// 삼는다 - 추가/수정 성공 시 항상 페이지를 새로고침하므로 별도 동기화가 필요 없다.
//
// **`<Teleport :to="host">` - 자기 자신에게 텔레포트**: 서버가 원본과 정확히
// 같은 자리(`.label-editor-wrap` 안, #copyLabel과 #labelsList 사이)에 놓은
// <yona-new-label-form>을 그 자리에 그대로 둬야 하는데, `.label-editor-wrap
// .new-label-wrap`처럼 조상 클래스를 요구하는 CSS가 있어 Shadow DOM에 그대로
// 그리면 스타일이 깨진다. host 자신을 Teleport 대상으로 쓰면 렌더링된 내용이
// host의 진짜 라이트 DOM 자식이 되어 CSS 상속을 받으면서도, host 자신의 위치는
// 전혀 바뀌지 않는다.
//
// **함정(스모크 테스트로 발견) - `<slot>` 없이는 화면에 안 그려진다**: 템플릿
// 최상위가 <Teleport> 하나뿐이면 shadow root가 사실상 비어(Teleport는 실제
// 노드를 shadow root 안에 남기지 않는 코멘트 앵커일 뿐) host의 라이트 DOM
// 자식이 flat tree에 편입되지 못해 전혀 렌더링되지 않는다. Teleport와 별도로
// 빈 `<slot></slot>`을 shadow root 쪽에 반드시 둬야 한다.
import { computed, onMounted, ref, useHost, useTemplateRef } from "vue";
import YonaColorPicker from "./YonaColorPicker.vue";
import { getRefinedHexColor, getContrastColor, type RgbColorParser } from "./color";
import { toRequestParams } from "./request";
import { msg } from "./messages";

declare const RGBColor: new (color: string) => { ok: boolean; toHex(): string };

interface YonaDialogEl extends HTMLElement {
  show(message: string, description?: string, options?: Record<string, unknown>): void;
}
interface YonaTypeaheadEl extends HTMLElement {
  configure(options: { source: string[] }): void;
}

const PRESET_COLORS = [
  "#f44336", "#e91e63", "#9c27b0", "#3f51b5", "#2196f3", "#03a9f4", "#00bcd4",
  "#009688", "#4caf50", "#8bc34a", "#cddc39", "#ffeb3b", "#ffc107", "#ff9800",
  "#ff5722", "#795548", "#9e9e9e",
];

const host = useHost();
const parse: RgbColorParser = (color) => new RGBColor(color);

const categoryText = ref("");
const nameText = ref("");
const colorText = ref("");
const colorsVisible = ref(false);
// yona.css의 `.label-preset-colors { display: none }`는 무조건 적용돼 v-show가
// 세팅하는 빈 인라인 스타일로는 못 이긴다 - 명시적으로 `display: block`을 줘야
// 한다(LoginDialog의 `.error` 박스와 같은 함정).
const colorsVisibleStyle = computed(() => ({ display: colorsVisible.value ? "block" : "none" }));
const nameStyle = ref<{ backgroundColor?: string }>({});
const nameContrastClass = ref<"white" | "dimgray" | "">("");

const nameInputRef = useTemplateRef<HTMLInputElement>("nameInputRef");
const categoryTypeaheadRef = useTemplateRef<YonaTypeaheadEl>("categoryTypeaheadRef");

let actionUrl = "";
// "확정 안 됨"과 "false로 확정"을 구분해야 해서 undefined를 별도 상태로 쓴다.
let newCategoryExclusive: boolean | undefined;

function getDialog(): YonaDialogEl | null {
  return document.querySelector("yona-dialog");
}
function alertMessage(message: string): void {
  getDialog()?.show(message);
}

function readCategories(): string[] {
  const categories: string[] = [];
  document.querySelectorAll<HTMLElement>("div[data-category-name]").forEach((el) => {
    const name = el.dataset.categoryName;
    if (name && categories.indexOf(name) < 0) {
      categories.push(name);
    }
  });
  return categories;
}

function isNewCategory(categoryName: string): boolean {
  return readCategories().indexOf(categoryName) < 0;
}

function getCategoryElement(categoryName: string): HTMLElement | null {
  return document.querySelector(`div.category-wrap[data-category-name="${CSS.escape(categoryName)}"]`);
}

function isLabelExists(categoryName: string, labelName: string): boolean {
  const categoryEl = getCategoryElement(categoryName);
  return !!(categoryEl && categoryEl.querySelector(`[data-label-name="${CSS.escape(labelName)}"]`));
}

function applyNamePreview(color: string): void {
  if (!color) {
    return;
  }
  nameStyle.value = { backgroundColor: color };
  nameContrastClass.value = getContrastColor(color);
}

function getRandomColorCodeInPreset(): string | false {
  const index = Date.now() % PRESET_COLORS.length;
  return getRefinedHexColor(PRESET_COLORS[index] ?? "", parse);
}

function getFirstItemColorInCategory(categoryName: string): string | false {
  const categoryEl = getCategoryElement(categoryName);
  const targetItem = categoryEl ? categoryEl.querySelector(".issue-label") : null;
  const color = targetItem ? getComputedStyle(targetItem).backgroundColor : undefined;
  return getRefinedHexColor(color || "", parse);
}

function onFocusName(): void {
  colorsVisible.value = true;
  const categoryName = categoryText.value.trim();
  const labelColor = isNewCategory(categoryName) ? getRandomColorCodeInPreset() : getFirstItemColorInCategory(categoryName);

  if (colorText.value.length === 0 && labelColor) {
    colorText.value = labelColor;
    applyNamePreview(labelColor);
  }
}

function onColorPreview(color: string): void {
  applyNamePreview(color);
}
function onColorInvalid(value: string): void {
  alertMessage(msg("label.error.color", value));
}

function preventSubmitOnEnter(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    event.preventDefault();
  }
}

function isFormValid(): boolean {
  if (categoryText.value.length === 0 || nameText.value.length === 0 || colorText.value.length === 0) {
    alertMessage(msg("label.failedTo", msg("label.add")) + "\n" + msg("label.error.empty"));
    return false;
  }
  if (getRefinedHexColor(colorText.value, parse) === false) {
    alertMessage(msg("label.failedTo", msg("label.add")) + "\n" + msg("label.error.color", colorText.value));
    return false;
  }
  return true;
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
      // JSON 파싱 실패 시 상태코드 기반 메시지로 폴백.
    }
  }
  alertMessage(msg("error.failedTo", msg(messageKey), String(status), statusText));
}

async function requestAddLabel(requestData: Record<string, unknown>): Promise<void> {
  if (isLabelExists(requestData.categoryName as string, requestData.labelName as string)) {
    alertMessage(msg("label.error.duplicated"));
    return;
  }

  let response: Response;
  try {
    response = await fetch(actionUrl, { method: "post", body: toRequestParams(requestData) });
  } catch {
    alertMessage(msg("label.failedTo", msg("label.add")));
    return;
  }

  if (!response.ok) {
    const text = await response.text();
    showError(response.status, response.statusText, text, "label.add");
    return;
  }

  const result = await response.json().catch(() => null);
  if (result && typeof result === "object") {
    // 성공 시 항상 페이지를 새로고침한다(PJAX 아님) - 새 카테고리가 생겼을 때
    // 목록 마크업 전체를 다시 그리는 로직을 별도로 재구현하지 않기 위한
    // 의도적 단순화.
    document.location.reload();
    return;
  }
  alertMessage(msg("label.error.creationFailed"));
}

function onSubmit(): void {
  if (!isFormValid()) {
    return;
  }

  const categoryName = categoryText.value.trim();

  if (isNewCategory(categoryName) && typeof newCategoryExclusive === "undefined") {
    getDialog()?.show(msg("label.category.new.confirm", categoryName), "", {
      aButtonLabels: [msg("label.category.option.multiple"), msg("label.category.option.single")],
      aButtonStyles: ["confirm-button-vertical", "confirm-button-vertical"],
      fOnClickButton: ({ nButtonIndex }: { nButtonIndex: number }) => {
        newCategoryExclusive = nButtonIndex === 1;
        onSubmit();
      },
    });
    return;
  }

  requestAddLabel({
    labelName: nameText.value.trim(),
    labelColor: getRefinedHexColor(colorText.value.trim(), parse),
    categoryName: categoryName,
    categoryIsExclusive: newCategoryExclusive,
  });

  newCategoryExclusive = undefined;
}

onMounted(() => {
  if (host) {
    actionUrl = host.getAttribute("data-action") ?? "";
  }
  categoryTypeaheadRef.value?.configure({ source: readCategories() });
});

defineExpose({});
</script>

<template>
  <slot></slot>
  <Teleport :to="host" :disabled="!host">
    <form class="new-label-wrap" @submit.prevent="onSubmit">
      <strong class="form-legend">{{ msg("label.new") }}</strong>
      <div class="form-wrap">
        <div>
          <yona-typeahead ref="categoryTypeaheadRef">
            <input
              v-model="categoryText"
              type="text"
              name="category"
              class="input-label mr5"
              maxlength="250"
              autocomplete="off"
              :placeholder="msg('label.category')"
              @keypress="preventSubmitOnEnter"
            />
          </yona-typeahead>
          <input
            ref="nameInputRef"
            v-model="nameText"
            type="text"
            name="name"
            class="input-label"
            maxlength="250"
            autocomplete="off"
            :placeholder="msg('label.name')"
            :style="nameStyle"
            :class="nameContrastClass"
            @focus="onFocusName"
          />
        </div>
        <YonaColorPicker
          v-model="colorText"
          :style="colorsVisibleStyle"
          :preset-colors="PRESET_COLORS"
          @preview="onColorPreview"
          @invalid="onColorInvalid"
        />
      </div>
      <button type="submit" class="ybtn ybtn-primary btn-submit">{{ msg("label.add") }}</button>
    </form>
  </Teleport>
</template>
