// yona.Common.js의 _positionPopoverElement/_getPopoverContainer(툴팁/팝오버 공용
// 위치 계산)에서 순수 계산 부분만 뽑아낸 것 - DOM 측정(getBoundingClientRect)과
// DOM 삽입/스타일 적용은 컴포넌트가 담당하고, 여기서는 숫자만 계산한다.

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Offset {
  top: number;
  left: number;
}

// 원본: 컨테이너가 document.body면 페이지 스크롤 오프셋(window.pageXOffset/Y)을
// 더하고, dialog 컨테이너면 두 rect 다 뷰포트 기준이라 스크롤 오프셋이 필요 없다.
export function computeContainerRelativeOffset(triggerRect: Rect, container: "body" | Rect, pageOffset: { x: number; y: number }): Offset {
  if (container === "body") {
    return { top: triggerRect.top + pageOffset.y, left: triggerRect.left + pageOffset.x };
  }
  return { top: triggerRect.top - container.top, left: triggerRect.left - container.left };
}

// 원본 _positionPopoverElement의 switch(sPlacement) 부분 그대로 - 인식 안 되는
// 값(undefined 포함)은 원본과 동일하게 default(top) 분기로 떨어진다.
export function computeFloatPosition(offset: Offset, triggerSize: Size, floatSize: Size, placement: string | null | undefined): Offset {
  switch (placement) {
    case "bottom":
      return { top: offset.top + triggerSize.height, left: offset.left + triggerSize.width / 2 - floatSize.width / 2 };
    case "left":
      return { top: offset.top + triggerSize.height / 2 - floatSize.height / 2, left: offset.left - floatSize.width };
    case "right":
      return { top: offset.top + triggerSize.height / 2 - floatSize.height / 2, left: offset.left + triggerSize.width };
    default:
      return { top: offset.top - floatSize.height, left: offset.left + triggerSize.width / 2 - floatSize.width / 2 };
  }
}
