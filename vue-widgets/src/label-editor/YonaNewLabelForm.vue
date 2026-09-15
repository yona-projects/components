<script setup lang="ts">
// yona.issue.LabelEditor.js의 "새 라벨 추가" 폼(#frmNewLabel) 부분만 뽑아 다시 썼다.
// 카테고리/라벨 편집 다이얼로그(YonaCategoryEditDialog/YonaLabelEditDialog)는 각자
// 독립된 커스텀 엘리먼트다 - 셋 다 서버가 렌더링한 같은 라벨 목록(#labelsList, 이
// 컴포넌트들의 소유가 아니다)을 공유 진실 원천으로 읽는다(카테고리 목록/중복 검사
// 전부 `div[data-category-name]`을 그때그때 다시 읽는다 - 추가/수정 모두 성공 시
// 원본처럼 페이지를 그대로 새로고침하므로 별도의 상태 동기화 이벤트가 필요 없다).
//
// **`<Teleport :to="host">` - "나 자신에게 텔레포트"**: 이 폼은 review-form/
// login-dialog처럼 "다른 곳으로 옮기거나 항상 body에 붙는" 위젯이 아니라 서버가
// 정확히 원본과 같은 자리(`.label-editor-wrap` 안, #copyLabel과 #labelsList
// 사이)에 놓아둔 <yona-new-label-form>을 그 자리에 그대로 둬야 한다 - 그런데
// `.label-editor-wrap .new-label-wrap`처럼 조상 클래스를 요구하는 CSS가 있어
// Shadow DOM에 그대로 그리면 이식이 필요했다. host 자신을 Teleport 대상으로 쓰면
// (`useHost()`가 돌려주는 엘리먼트 자체에 Teleport) 렌더링된 내용이 host의 진짜
// 라이트 DOM 자식이 되면서도 host 자신의 위치(서버가 정한 자리)는 전혀 안 바뀐다 -
// document.body로 보내는 것과 같은 "CSS 상속" 효과를 내면서 원본 위치까지
// 그대로 지킨다. review-form/login-dialog의 Teleport 활용을 한 단계 더 확장한
// 것이다.
//
// **함정(스모크 테스트로 실측 발견) - `<slot>` 없이는 화면에 아예 안 그려진다**:
// 템플릿의 최상위가 <Teleport> 하나뿐이면 이 컴포넌트의 shadow root는 사실상
// 빈 채로 남는다(Teleport는 shadow root 안에 아무 실제 노드도 남기지 않는 코멘트
// 앵커일 뿐이다). Shadow DOM 합성 규칙상 host의 라이트 DOM 자식(Teleport로 옮겨온
// 이 폼도 포함)은 shadow root 안에 그 자식을 담을 `<slot>`이 없으면 "flat tree"에
// 편입되지 못해 전혀 렌더링되지 않는다(getComputedStyle이 모든 속성에 빈 문자열을
// 반환하는 것으로 실측 확인 - display:none과 달리 layout 계산 자체가 안 일어난다).
// 그래서 Teleport와 별도로 빈 `<slot></slot>`을 shadow root 쪽에 반드시 둬야
// host의 라이트 DOM 자식들이 실제로 화면에 그려진다.
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
// 실제 yona.css의 `.label-preset-colors { display: none; }`는 무조건(클래스
// 조건 없이) 적용되는 규칙이라, v-show가 세팅하는 빈 인라인 스타일(보일 때는
// display를 비워 클래스 캐스케이드에 맡김)로는 못 이긴다 - 인라인 스타일 자체에
// 명시적으로 `display: block`을 줘야 한다(LoginDialog의 `.error` 박스에서
// 이미 겪은 것과 같은 함정 - 실대치 검증으로 실측 확인, 원본도
// `elements.colorsWrap.style.display = "block"`으로 인라인 스타일을 직접 준다).
const colorsVisibleStyle = computed(() => ({ display: colorsVisible.value ? "block" : "none" }));
const nameStyle = ref<{ backgroundColor?: string }>({});
const nameContrastClass = ref<"white" | "dimgray" | "">("");

const nameInputRef = useTemplateRef<HTMLInputElement>("nameInputRef");
const categoryTypeaheadRef = useTemplateRef<YonaTypeaheadEl>("categoryTypeaheadRef");

let actionUrl = "";
// 원본 vars.isNewCategoryExclusive: "확정 안 됨"과 "false로 확정"을 구분해야 해서
// undefined를 별도 상태로 쓴다(원본의 delete로 지우는 방식과 동일한 의도).
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

// 원본 _onFocusInputName
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
      // JSON 파싱 실패 시 상태코드 기반 메시지로 폴백(원본과 동일).
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
    // 원본 _reloadLabelList: 성공 시 항상 페이지를 다시 불러온다(PJAX가 아니라
    // 실제 hard reload - 새 카테고리가 생겼을 때 목록 마크업 전체를 다시 그리는
    // 로직을 별도로 재구현하지 않기 위한 원본의 의도적 단순화, 그대로 유지).
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
