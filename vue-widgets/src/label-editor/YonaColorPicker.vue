<script setup lang="ts">
// yona.issue.LabelEditor.js에서 새 라벨 폼과 라벨 수정 다이얼로그에 중복돼
// 있던 "색상 프리셋 팔레트 + 커스텀 hex 입력" 로직을 하나로 합친 컴포넌트.
//
// 팔레트+hex 입력 자신의 시각 상태만 책임지고, 그 색을 다른 곳(라벨 이름
// 미리보기)에 어떻게 반영할지는 `preview` 이벤트로 부모에 위임한다. custom
// element로 등록하지 않는 이유도 같다 - 부모 SFC 안에서만 조합되는 내부 부품이다.
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

// 유효하면 "입력된 원문 그대로"로 미리보기한다(정제된 hex가 아님).
function onKeyUpColor(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  emit("update:modelValue", value);
  if (!isValidColorExpr(value, parse)) {
    return;
  }
  applySwatch(value);
  emit("preview", value);
}

// 무효하면 invalid 이벤트로 부모에 위임한다(부모가 alert 처리).
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
