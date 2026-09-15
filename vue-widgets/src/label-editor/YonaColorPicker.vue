<script setup lang="ts">
// yona.issue.LabelEditor.js에서 두 번(새 라벨 폼 / 라벨 수정 다이얼로그) 거의 동일하게
// 반복되던 "색상 프리셋 팔레트 + 커스텀 hex 입력" 로직을 하나의 재사용 컴포넌트로
// 뽑았다 - 원본은 _onClickBtnPresetColor/_onKeyUpInputColor/_onBlurInputColor와
// _onClickBtnPresetColorOnEditForm/_onKeyUpEditColor/_onBlurEditColor로 완전히
// 중복돼 있었다(사용자 승인 - 여러 컴포넌트로 분할해도 된다는 지시에 따라 이번에
// 처음으로 "같은 로직을 두 번 베끼지 않고 하나로 합치는" 리팩터링을 겸했다).
//
// 이 컴포넌트는 자기 자신(팔레트+hex 입력)의 시각적 상태만 책임진다 - "이 색을
// 다른 곳(라벨 이름 미리보기)에 어떻게 반영할지"는 부모의 관심사라 `preview`
// 이벤트로 위임한다(review-form이 에디터/첨부파일을 자식으로 조합하면서도 각자의
// 책임을 분리한 것과 동일한 경계 판단). custom element로 등록하지 않고 일반 Vue
// SFC로만 두는 이유도 같다 - 부모 SFC 안에서만 조합되는 순수 내부 부품이다.
import { ref, useTemplateRef, watch } from "vue";
import { getRefinedHexColor, isValidColorExpr, getPrefixedCSSText, type RgbColorParser } from "./color";
import { msg } from "./messages";

declare const RGBColor: new (color: string) => { ok: boolean; toHex(): string };

const props = defineProps<{
  presetColors: string[];
  modelValue: string;
  // yona.css의 `.label-preset-colors`는 기본 display:none이고 `.edit` 수식자가
  // 붙으면 항상 보이는 레이아웃이 된다(라벨 수정 다이얼로그가 이 형태) - 새 라벨
  // 폼 쪽은 이 수식자 없이 부모가 v-show로 이름 입력 포커스 시에만 보여준다.
  editVariant?: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "preview", color: string): void;
  (e: "invalid", message: string): void;
}>();

const parse: RgbColorParser = (color) => new RGBColor(color);

const activeIndex = ref<number | null>(null);
const colorInputRef = useTemplateRef<HTMLInputElement>("colorInputRef");

function applySwatch(hex: string): void {
  if (colorInputRef.value) {
    colorInputRef.value.style.cssText = getPrefixedCSSText(`box-shadow: inset 25px 0 0 ${hex} !important`);
  }
}

// 원본 _onClickBtnPresetColor
function onClickPreset(color: string, index: number): void {
  const refined = getRefinedHexColor(color, parse);
  if (!refined) {
    return;
  }
  activeIndex.value = index;
  emit("update:modelValue", refined);
  applySwatch(refined);
  emit("preview", refined);
}

// 원본 _onKeyUpInputColor - 유효하면 "입력된 원문 그대로"로 미리보기(정제된 hex가
// 아님 - 원본과 동일한 특성).
function onKeyUpColor(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  emit("update:modelValue", value);
  if (!isValidColorExpr(value, parse)) {
    return;
  }
  applySwatch(value);
  emit("preview", value);
}

// 원본 _onBlurInputColor - 무효하면 invalid 이벤트(부모가 alert 처리), 유효하면
// 정제된 hex로 미리보기.
function onBlurColor(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  if (value.length < 1) {
    return;
  }
  if (!isValidColorExpr(value, parse)) {
    emit("invalid", value);
    return;
  }
  const refined = getRefinedHexColor(value, parse) as string;
  emit("update:modelValue", refined);
  applySwatch(refined);
  emit("preview", refined);
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      applySwatch(value);
    }
  },
  { immediate: true },
);

defineExpose({ focus: () => colorInputRef.value?.focus() });
</script>

<template>
  <div class="label-preset-colors" :class="{ edit: editVariant }">
    <button
      v-for="(color, index) in presetColors"
      :key="index"
      type="button"
      class="issue-label btn-preset-color"
      :class="{ active: activeIndex === index }"
      :style="{ backgroundColor: color }"
      @click="onClickPreset(color, index)"
    ></button>
    <input
      ref="colorInputRef"
      type="text"
      class="input-small input-label-color"
      :value="modelValue"
      :placeholder="msg('label.customColor')"
      @keyup="onKeyUpColor"
      @blur="onBlurColor"
    />
  </div>
</template>
