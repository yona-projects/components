# yona 마크다운 도움말 패널 (Vue 3 SFC 파일럿)

yona의 `help/markdown.html`(마크다운 문법 도움말 아코디언 패널)을 **Vue 3 Composition
API + TypeScript(`<script setup lang="ts">`)** 로 다시 작성한 컴포넌트입니다.
`components/editor`/`editor2`(마크다운 에디터)와 별개로, "지금 상태에서 SFC로 뽑아볼 만한
것"의 첫 파일럿으로 골랐습니다 - 상태(열려 있는 탭 하나)와 외부 라이브러리 의존성이 전혀
없는 순수 정적 위젯이라 컴포넌트화 리스크가 가장 낮습니다.

## 원본 구조

`site/layout.html`의 `markdownEditor(name, value, editorMode)` 프래그먼트를 보면
`<yona-markdown-editor>` 바로 옆에 `<div th:replace="~{help/markdown}">`이 형제로
붙습니다 - 즉 도움말 패널은 에디터 컴포넌트 안이 아니라 **페이지 레벨에서 별도로 붙는
완전히 독립된 위젯**입니다. `help/markdown.html` 하단에는 클릭 시 `.active` 클래스를
토글하는 인라인 `<script>`가 있고(탭 하나 클릭 -> 그 콘텐츠만 열림, 다시 클릭 -> 닫힘),
10개 예시 중 8개는 `[markdown]` 속성이 붙어 사이트 전역 `yona.Markdown.js`(marked.js
클라이언트 렌더링)가 페이지 로드 시 실제 HTML로 바꿔치기하고, 나머지 2개(체크리스트/짧은
링크)는 애초에 결과 HTML을 직접 하드코딩해뒀습니다.

## 원본과 달라진 점

- **marked.js/hljs 의존성 제거**: 이 패널의 10개 예시는 절대 바뀌지 않는 고정 레퍼런스라
  (사용자 입력을 렌더링하는 게 아님), "입력 텍스트 + 결과 HTML"을 전부 정적으로
  하드코딩했습니다(`src/examples.ts`) - 원본도 이미 2/10은 이 방식이었으니 그 패턴을
  10개 전부로 일관되게 확장한 것뿐입니다. marked.js가 실제로 그 입력들에 대해 만들어낼
  출력과 동일하게 손으로 맞춰 썼습니다.
- **토글 로직을 순수 함수로 분리**: `src/toggle.ts`의 `nextActiveKey(current, clicked)`
  하나로 전체 상태 전이 규칙(같은 탭 재클릭 -> 닫힘, 다른 탭 클릭 -> 전환)을 표현하고
  단위 테스트(`test/toggle.test.ts`)로 검증합니다.
- **레거시 Bootstrap 2 그리드(`.row-fluid`/`.span6`) 제거**: 자체 flex 2단 레이아웃을
  씁니다(시각 결과는 동일, 전역 CSS 의존 없음).
- **`.markdown-help*`/`.markdown-wrap` CSS는 yona.css에서 값 그대로 이식**해 scoped
  스타일로 자기완결시켰습니다(editor2의 toolbar/preview CSS 이식과 동일한 원칙).

## yona에 실제로 꽂아 쓰려면: `defineCustomElement` 빌드

editor2와 동일한 패턴입니다 - 같은 소스(`MarkdownHelp.vue`)를 `vite.element.config.ts`의
`customElement` 옵션으로 다르게 컴파일해 `<yona-help-markdown>` 네이티브 커스텀
엘리먼트를 만듭니다.

```
npm run build:element
```

`dist-element/yona-help-markdown-element.js` 하나가 나옵니다(Vue 런타임 포함). yona에
꽂을 때는 `help/markdown.html` 자리에 `<yona-help-markdown></yona-help-markdown>`
태그 하나만 넣으면 됩니다(props 없음 - `title`은 선택적, 기본값 "마크다운 도움말").

**주의**: `markdownImages` 예시가 실제 yona 정적 에셋(`/assets/images/ico-like-small.png`)을
가리킵니다 - 원본도 마찬가지였습니다. 이 저장소를 격리 실행(개발 서버/스모크 테스트)할
때는 그 이미지가 404가 나는 게 정상이며, yona에 실제로 vendoring됐을 때만 정상 표시됩니다.

## 요구 사항

- Node.js `>= 18`

## 개발 서버

```
npm install
npm run dev
```

## 빌드 / 타입체크

```
npm run build        # index.html+App.vue 데모를 정적 산출물로(dist/)
npm run build:element  # <yona-help-markdown> 커스텀 엘리먼트로(dist-element/)
npm run typecheck
```

## 테스트

```
npm run test
```

`toggle.ts`의 상태 전이 규칙에 대한 순수 함수 단위 테스트 3개를 esbuild로 트랜스파일한 뒤
`node --test`로 실행합니다.

## 스모크 테스트

`smoke-test/`:
- `panel.mjs`: Vite 개발 서버를 띄운 뒤 Playwright로 초기 상태(전부 닫힘)/탭 클릭 시
  단일 오픈/재클릭 시 닫힘/다른 탭 클릭 시 자동 전환을 확인합니다.
- `element.mjs`: `npm run build:element`로 만든 `dist-element/`를 정적 HTML
  (`element.html`)에 로드해 shadowRoot attach + 같은 토글 동작을 확인합니다 -
  `npm run build:element`를 먼저 실행해야 합니다.
