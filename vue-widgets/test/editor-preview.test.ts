// yona-markdown-editor 4단계(미리보기) preview.ts 단위 테스트.
//
// RequestSequencer(순수 로직)와 PreviewController(fetch/panel/hljs를 전부 주입 가능하게 설계된
// 얇은 DOM 글루)를 Node 환경에서 직접 검증한다 - Shadow DOM 안에서 실제로 버튼을 눌러 패널이
// 토글되는지는 Playwright가 1차 검증 수단(commands.test.ts와 동일한 분리 원칙).
import { test } from "node:test";
import assert from "node:assert/strict";
import { RequestSequencer, PreviewController, type HljsLike } from "../src/editor/preview.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 실제 HTMLElement 없이 panel/hljs가 필요로 하는 최소 동작만 흉내낸다. */
function fakePanel() {
  const highlighted: Element[] = [];
  const codeBlocks: Element[] = [];
  const panel = {
    innerHTML: "",
    querySelectorAll(selector: string) {
      assert.equal(selector, "pre code");
      return {
        forEach(cb: (el: Element) => void) {
          codeBlocks.forEach(cb);
        },
      };
    },
  } as unknown as HTMLElement;

  return { panel, highlighted, codeBlocks };
}

function fakeHljs(highlighted: Element[]): HljsLike {
  return {
    highlightElement(el: Element) {
      highlighted.push(el);
    },
  };
}

function jsonResponse(html: string) {
  return { ok: true, text: async () => html };
}

test("RequestSequencer.isCurrent is true only for the most recently issued sequence number", () => {
  const seq = new RequestSequencer();
  const first = seq.next();
  assert.equal(seq.isCurrent(first), true);

  const second = seq.next();
  assert.equal(seq.isCurrent(first), false);
  assert.equal(seq.isCurrent(second), true);
});

test("scheduleRender does nothing when renderUrl is null (defensive no-op)", async () => {
  const { panel } = fakePanel();
  let fetchCalls = 0;
  const controller = new PreviewController({
    renderUrl: null,
    panel,
    debounceMs: 5,
    fetchImpl: (async () => {
      fetchCalls += 1;
      throw new Error("fetch should not be called when renderUrl is null");
    }) as unknown as typeof fetch,
  });

  controller.scheduleRender("hello");
  await delay(30);

  assert.equal(fetchCalls, 0);
  assert.equal(panel.innerHTML, "");
});

test("rapid scheduleRender calls within the debounce window collapse into a single request for the latest text", async () => {
  const { panel } = fakePanel();
  const bodies: string[] = [];
  const controller = new PreviewController({
    renderUrl: "/markdown/owner/proj",
    panel,
    debounceMs: 20,
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return jsonResponse("<p>rendered</p>");
    }) as unknown as typeof fetch,
  });

  controller.scheduleRender("a");
  controller.scheduleRender("ab");
  controller.scheduleRender("abc");

  await delay(60);

  assert.equal(bodies.length, 1);
  assert.deepEqual(JSON.parse(bodies[0] as string), { body: "abc", breaks: true });
  assert.equal(panel.innerHTML, "<p>rendered</p>");
});

test("a successful response highlights every pre code block found in the panel", async () => {
  const { panel, highlighted, codeBlocks } = fakePanel();
  codeBlocks.push({} as Element, {} as Element);

  const controller = new PreviewController({
    renderUrl: "/markdown/owner/proj",
    panel,
    debounceMs: 5,
    getHljs: () => fakeHljs(highlighted),
    fetchImpl: (async () => jsonResponse("<pre><code>x</code></pre>")) as unknown as typeof fetch,
  });

  controller.scheduleRender("```\nx\n```");
  await delay(30);

  assert.equal(panel.innerHTML, "<pre><code>x</code></pre>");
  assert.equal(highlighted.length, 2);
});

test("a stale response (older request resolving after a newer one) does not overwrite the newer content", async () => {
  const { panel } = fakePanel();
  const resolvers: Array<(value: { ok: boolean; text: () => Promise<string> }) => void> = [];

  const controller = new PreviewController({
    renderUrl: "/markdown/owner/proj",
    panel,
    debounceMs: 5,
    fetchImpl: (() =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      })) as unknown as typeof fetch,
  });

  controller.scheduleRender("draft one");
  await delay(20); // let the first debounce fire and the fetch start (request #1 in flight)

  controller.scheduleRender("draft two");
  await delay(20); // let the second debounce fire and the fetch start (request #2 in flight)

  assert.equal(resolvers.length, 2);

  // 응답은 요청 순서와 반대로 도착한다(레이스 컨디션 시뮬레이션): 더 최신인 두 번째 요청이
  // 먼저 응답하고, 오래된 첫 번째 요청이 그 다음에 응답한다.
  resolvers[1]?.(jsonResponse("<p>draft two rendered</p>"));
  await delay(10);
  assert.equal(panel.innerHTML, "<p>draft two rendered</p>");

  resolvers[0]?.(jsonResponse("<p>draft one rendered (stale)</p>"));
  await delay(10);

  // 오래된 응답이 이미 반영된 최신 내용을 덮어쓰지 않아야 한다.
  assert.equal(panel.innerHTML, "<p>draft two rendered</p>");
});
