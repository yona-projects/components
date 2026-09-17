// `<template>`에서 Messages()를 직접 호출하면 Vue SFC 컴파일러가 이를 스크립트
// 바인딩으로 인식하지 못해 `_ctx.Messages(...)`로 컴파일하고 런타임에 깨진다
// (`_ctx.Messages`가 undefined). `<script setup>`의 로컬 함수(msg)로 감싸
// 템플릿은 그 함수만 참조하게 한다. label-editor 세 컴포넌트가 메시지 키를
// 공유하므로 한 번만 이 모듈에 모았다.
export type MessagesFn = (key: string, ...args: string[]) => string;

const FALLBACKS: Record<string, string> = {
  "label.new": "Add new label",
  "label.category": "Category",
  "label.category.option": "In this category, you can choose",
  "label.category.option.multiple": "multiple labels",
  "label.category.option.single": "only a single label",
  "label.category.new.confirm": "{0} is a new category.<br>In this category, you can choose",
  "label.category.edit": "Edit category",
  "label.name": "Name",
  "label.customColor": "Label Color",
  "label.add": "Add label",
  "label.edit": "Edit label",
  "label.error.empty": "Category, Color, and Name are required fields.",
  "label.error.color": "Please define the label color using HEX or RGB values.",
  "label.error.duplicated": "Failed to create a new label. The label may already exist.",
  "label.error.duplicated.in.category": "A label with the same name already exists in the category {0}.",
  "label.error.creationFailed": "Failed to create a new label. A server error may have occurred or the request may be invalid.",
  "label.failedTo": "Failed to {0}.",
  "error.failedTo": "Failed to {0}<br>({1} {2})",
  "button.save": "Save",
  "button.cancel": "Cancel",
  "button.confirm": "Confirm",
  "label.confirm.delete":
    "Once you delete this label, instances of this label attached to issues will also be removed. Do you still want to delete this label?",
};

function format(template: string, args: string[]): string {
  return template.replace(/\{(\d+)\}/g, (_match, index) => args[Number(index)] ?? "");
}

export function msg(key: string, ...args: string[]): string {
  const globalMessages = (globalThis as { Messages?: MessagesFn }).Messages;
  if (typeof globalMessages === "function") {
    return globalMessages(key, ...args);
  }
  const fallback = FALLBACKS[key];
  return fallback ? format(fallback, args) : key;
}
