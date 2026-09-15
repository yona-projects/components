// yona.issue.LabelEditor.js의 라벨 목록(#labelsList) 위임 클릭 처리 + 삭제
// 흐름만 뽑아 다시 썼다 - "트리거는 원래 살던 곳에 남는다"는 Dropdown 이후
// 확립된 경계 판단 그대로: 목록 자체(삭제/수정/카테고리수정 버튼)는 서버가
// 렌더링한 그대로 vanilla로 남고, 이 어댑터는 그 위임 리스너 + 세 커스텀
// 엘리먼트(<yona-label-edit-dialog>/<yona-category-edit-dialog>) 호출 +
// 삭제 성공 후 DOM 정리(행/빈 카테고리 제거)만 담당한다. 새 라벨 폼
// (<yona-new-label-form>)은 목록을 건드리지 않으므로 이 어댑터가 알 필요 없다.
import { getData } from "./data";
import { msg } from "./messages";
import { toRequestParams } from "./request";

interface YonaDialogEl extends HTMLElement {
  show(message: string, description?: string, options?: Record<string, unknown>): void;
}
interface YonaLabelEditDialogEl extends HTMLElement {
  show(data: { categoryId: string; labelName: string; labelColor: string; updateUri: string }): void;
}
interface YonaCategoryEditDialogEl extends HTMLElement {
  show(data: {
    projectId: string;
    categoryId: string;
    categoryName: string;
    categoryIsExclusive: boolean;
    categoryUpdateUri: string;
  }): void;
}

function getDialog(): YonaDialogEl | null {
  return document.querySelector("yona-dialog");
}

function getCategoryElement(categoryName: unknown): HTMLElement | null {
  if (typeof categoryName !== "string" && typeof categoryName !== "number") {
    return null;
  }
  return document.querySelector(`div.category-wrap[data-category-name="${CSS.escape(String(categoryName))}"]`);
}

function isEmptyCategory(categoryName: unknown): boolean {
  const categoryEl = getCategoryElement(categoryName);
  return !categoryEl || categoryEl.querySelectorAll("tr[data-label-id]").length === 0;
}

function removeLabelRow(categoryName: unknown, labelId: unknown): void {
  const labelRow = document.querySelector(`tr[data-label-id="${CSS.escape(String(labelId))}"]`);
  labelRow?.remove();

  if (isEmptyCategory(categoryName)) {
    getCategoryElement(categoryName)?.remove();
  }
}

async function requestRemoveLabel(target: HTMLElement): Promise<void> {
  const deleteUri = getData(target, "deleteUri") as string;

  const response = await fetch(deleteUri, { method: "post", body: toRequestParams({ _method: "delete" }) });
  if (!response.ok) {
    return;
  }
  removeLabelRow(getData(target, "categoryName"), getData(target, "labelId"));
}

function onClickDeleteButton(target: HTMLElement): void {
  // $yona.confirm(원본이 쓰는 것)은 aButtonLabels를 안 주면 [취소, 확인]
  // 두 버튼을 기본값으로 깐다(확인=index 1) - <yona-dialog>.show() 자체는
  // aButtonLabels 없이 부르면 확인 버튼 1개짜리 alert 모드가 되므로, 여기서
  // 명시적으로 같은 기본값을 재현해야 한다(YonaDialog.vue의 확립된 계약).
  getDialog()?.show(msg("label.confirm.delete"), "", {
    aButtonLabels: [msg("button.cancel"), msg("button.confirm")],
    fOnClickButton: ({ nButtonIndex }: { nButtonIndex: number }) => {
      if (nButtonIndex === 1) {
        requestRemoveLabel(target);
      }
    },
  });
}

function onClickEditLabelButton(target: HTMLElement): void {
  const dialog = document.querySelector<YonaLabelEditDialogEl>("yona-label-edit-dialog");
  dialog?.show({
    categoryId: String(getData(target, "categoryId") ?? ""),
    labelName: String(getData(target, "labelName") ?? ""),
    labelColor: String(getData(target, "labelColor") ?? ""),
    updateUri: String(getData(target, "updateUri") ?? ""),
  });
}

function onClickEditCategoryButton(target: HTMLElement): void {
  const dialog = document.querySelector<YonaCategoryEditDialogEl>("yona-category-edit-dialog");
  dialog?.show({
    projectId: String(getData(target, "projectId") ?? ""),
    categoryId: String(getData(target, "categoryId") ?? ""),
    categoryName: String(getData(target, "categoryName") ?? ""),
    categoryIsExclusive: getData(target, "categoryIsExclusive") === true,
    categoryUpdateUri: String(getData(target, "categoryUpdateUri") ?? ""),
  });
}

export function attachLabelListAdapter(list: HTMLElement): void {
  list.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-delete-uri]");
    if (target && list.contains(target)) {
      onClickDeleteButton(target);
    }
  });
  list.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-update-uri]");
    if (target && list.contains(target)) {
      onClickEditLabelButton(target);
    }
  });
  list.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-category-update-uri]");
    if (target && list.contains(target)) {
      onClickEditCategoryButton(target);
    }
  });
}
