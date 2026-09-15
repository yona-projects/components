// yona-markdown-editor 4단계(미리보기 서버 렌더링 재연동).
//
// 옛 yobi.ui.MarkdownEditor.js의 _previewRenderer()(2026-09-11 조사, `git show
// 03b5111a3:src/main/resources/static/javascripts/common/yobi.ui.MarkdownEditor.js`로 확인한
// 구현)를 CM6/네이티브 fetch 기반으로 그대로 이식한다:
//   - 300ms 디바운스(연타/연속 타이핑 시 렌더 요청을 마지막 한 번으로 합친다)
//   - 요청 순번 비교(레이스 가드) - 오래된 응답이 최신 내용을 덮어쓰지 않도록 fetch를 실제로
//     보내는 시점에 순번을 매기고, 응답이 왔을 때 그 순번이 여전히 최신인지 확인한다.
//   - POST {body: <현재 문서>, breaks: true}, 응답 HTML을 패널에 그대로 삽입한 뒤 그 안의
//     `pre code` 요소마다 전역 window.hljs.highlightElement()를 호출한다(하이라이팅 라이브러리
//     자체는 컴포넌트가 번들링하지 않고 전역 객체를 그대로 참조 - 자체 호스팅 중복 방지 원칙).
//
// CSRF: 이 POST는 안전하지 않은 메서드(POST)이지만, yona site/layout.html의 전역 fetch() 패치
// (P3-legal/P3-44 - window.fetch 자체를 감싸 쿠키의 XSRF-TOKEN을 X-XSRF-TOKEN 헤더로 자동
// 첨부)가 이미 모든 fetch() 호출에 적용되므로 컴포넌트가 CSRF 토큰을 직접 알거나 다룰 필요가
// 없다.
//
// 스타일: 사이트 전역 `.markdown-wrap` 콘텐츠 스타일(yobi.css)과 highlight.js 테마
// (`/javascripts/lib/highlight/styles/default.css`)는 둘 다 전역 <link>로 문서 최상위에
// 로드되어 Shadow DOM 경계를 넘지 못한다(CSS 규칙은 shadow 경계를 넘어 셀렉터 매칭이 되지
// 않는다 - 상속 가능한 속성만 예외). 사용자 확정(2026-09-11, 4단계 완료 시점): 두 스타일시트의
// 실제 규칙을 컴포넌트 자체 Shadow DOM 스타일로 그대로 옮겨 적는 "전체 재현"을 택했다(3단계
// 툴바와 동일 원칙). 실제 CSS는 toolbar.ts의 style 문자열(.preview-wrap 하위) 참고.

/** 요청 순번을 매기고 "이 응답이 여전히 최신 요청에 대한 것인가"를 판정하는 순수 로직. */
export class RequestSequencer {
  private latest = 0;

  /** 새 요청을 보내기 직전에 호출해 그 요청의 순번을 받는다. */
  next(): number {
    this.latest += 1;
    return this.latest;
  }

  /** seq가 여전히 가장 최근에 발급한 순번과 같은지(= 그 사이 더 최신 요청이 없었는지). */
  isCurrent(seq: number): boolean {
    return seq === this.latest;
  }
}

export interface HljsLike {
  highlightElement(element: Element): void;
}

export interface PreviewControllerOptions {
  /** markdownEditor 프래그먼트의 data-markdown-render-url. 없으면(project 컨텍스트 없는 화면)
   * scheduleRender가 아무 것도 하지 않는다(A.4 - 방어적으로 조용히 무시). */
  renderUrl: string | null;
  /** 렌더링된 HTML을 삽입할 대상 엘리먼트. */
  panel: HTMLElement;
  /** 테스트 용도로만 조정 - 실제 컴포넌트는 항상 기본값(300ms, 옛 구현과 동일)을 쓴다. */
  debounceMs?: number;
  /** 테스트 용도로만 조정 - 기본값은 전역 window.hljs를 그대로 참조한다. */
  getHljs?: () => HljsLike | undefined;
  /** 테스트 용도로만 조정 - 기본값은 전역(패치된) fetch를 그대로 쓴다. */
  fetchImpl?: typeof fetch;
}

export class PreviewController {
  private readonly renderUrl: string | null;
  private readonly panel: HTMLElement;
  private readonly debounceMs: number;
  private readonly getHljs: () => HljsLike | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly sequencer = new RequestSequencer();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: PreviewControllerOptions) {
    this.renderUrl = options.renderUrl;
    this.panel = options.panel;
    this.debounceMs = options.debounceMs ?? 300;
    this.getHljs =
      options.getHljs ??
      (() => (typeof window !== "undefined" ? (window as unknown as { hljs?: HljsLike }).hljs : undefined));
    this.fetchImpl = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  }

  /**
   * 미리보기가 켜져 있는 동안 호출한다(켜지는 시점 1회 + 켜진 채로 문서가 바뀔 때마다).
   * 300ms 안에 다시 호출되면 이전 예약은 취소되고 마지막 호출의 markdownText만 렌더링된다.
   */
  scheduleRender(markdownText: string): void {
    if (!this.renderUrl) {
      return;
    }

    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.render(markdownText);
    }, this.debounceMs);
  }

  /** 컴포넌트가 disconnected될 때 남은 디바운스 타이머를 정리한다. */
  dispose(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async render(markdownText: string): Promise<void> {
    const renderUrl = this.renderUrl;
    if (!renderUrl) {
      return;
    }

    // 순번은 실제로 요청을 보내는 시점에 매긴다(옛 _previewRenderer()의 `nThisRequestSeq =
    // ++nRequestSeq`가 setTimeout 콜백 안, 즉 디바운스가 끝난 직후에 있었던 것과 동일).
    const seq = this.sequencer.next();

    let html: string;
    try {
      const response = await this.fetchImpl(renderUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ body: markdownText, breaks: true }),
      });
      if (!response.ok) {
        return;
      }
      html = await response.text();
    } catch {
      // 네트워크 오류 등 - 옛 구현도 에러 콜백이 없어(success만 등록) 조용히 무시했다.
      return;
    }

    // 레이스 가드: 이 요청보다 나중에 발급된(=더 최신 문서 내용을 담은) 요청이 이미 있으면
    // 이 응답은 버린다 - 오래된 응답이 최신 내용을 덮어쓰지 않도록.
    if (!this.sequencer.isCurrent(seq)) {
      return;
    }

    this.panel.innerHTML = html;
    const hljs = this.getHljs();
    if (hljs) {
      this.panel.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
    }
  }
}
