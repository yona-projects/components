# yona 위젯 Vue 3 SFC 파일럿 모음

yona의 위젯 몇 개를 **Vue 3 Composition API + TypeScript(`<script setup lang="ts">`)** 로
다시 작성한 비교용 구현들을 모아둔 프로젝트입니다. 원래 `editor2/`(마크다운 에디터)와
`help-markdown/`(마크다운 도움말 패널) 두 개의 완전히 독립된 npm 프로젝트였던 것을, 위젯이
늘어나기 시작하는 시점에 맞춰 **하나의 npm 프로젝트로 합쳤습니다**(`package.json`/
`node_modules`/`tsconfig.json`/Vue·Vite 버전을 공유). 원본(`components/editor`, 네이티브
Custom Element 버전)은 이 통합과 무관하게 그대로 유지됩니다.

## 디렉터리 구조

```
src/
  editor/         - 마크다운 에디터(commands.ts, mention.ts, preview.ts, toolbarSpec.ts,
                    YonaMarkdownEditor.vue, element.ts)
  help-markdown/  - 마크다운 도움말 패널(toggle.ts, examples.ts, MarkdownHelp.vue, element.ts)
  App.vue         - 두 위젯을 한 페이지에 나란히 마운트하는 개발/데모 하네스
test/
  editor-*.test.ts, help-*.test.ts  - 위젯별 순수 함수 단위 테스트(파일명 접두어로 구분)
smoke-test/
  editor-toolbar.mjs, editor-element.mjs, help-panel.mjs, help-element.mjs
```

각 위젯의 소스 자체(컴포넌트 로직, 원본과 달라진 점 등)는 옮기기 전 각각의 README에
있던 설명과 동일합니다 - git 이력에 `editor2/README.md`, `help-markdown/README.md`로
남아있습니다.

## 하나로 합치며 바뀐 점 / 바뀌지 않은 점

- **공유**: `package.json`(의존성 한 벌), `node_modules`, `tsconfig.json`, Vue/Vite
  버전. `npm install`/`npm run typecheck`/`npm run test`도 이제 한 번씩만 실행하면 두
  위젯 전부를 커버합니다.
- **여전히 독립**: 커스텀 엘리먼트 빌드 산출물(`dist-element/*.js`)은 위젯당 1개 파일로,
  서로 코드를 공유하지 않습니다(각자 Vue 런타임을 포함한 자체 완결 번들 - 원래 커스텀
  엘리먼트가 쓰이는 방식과 동일, yona 템플릿에도 위젯별로 별도 `<script>` 태그로 로드).
- **빌드 명령 자체는 위젯마다 한 번씩**: Vite/Rollup이 "출력 포맷이 iife/umd면 멀티
  엔트리를 지원하지 않는다"는 제약이 있어(`vite.element.config.ts`의 `VUE_WIDGET_TARGET`
  환경변수로 어느 위젯을 빌드할지 고르는 이유), 한 번의 `vite build` 호출로 두 산출물을
  동시에 뽑아낼 수는 없습니다. `npm run build:elements`가 내부적으로 그 설정 파일을
  `editor`/`help` 두 값으로 순차 호출해 이 제약을 감춥니다 - 사용자 입장에서는 명령
  하나로 두 산출물이 다 나옵니다.

## 요구 사항

- Node.js `>= 18`

## 개발 서버

```
npm install
npm run dev
```

`src/App.vue`가 두 위젯을 한 페이지에 마운트합니다(에디터가 위, 도움말 패널이 아래 -
원본 yona 화면에서 markdownEditor 프래그먼트 옆에 help/markdown 프래그먼트가 나란히
있는 배치와 동일).

## 빌드

```
npm run build           # 데모 앱 전체를 정적 산출물로(dist/)
npm run build:elements  # 두 위젯 각각을 <yona-markdown-editor-vue>/<yona-help-markdown>
                         # 네이티브 커스텀 엘리먼트로(dist-element/, 위젯당 1개 파일)
npm run typecheck
```

## yona에 실제로 꽂아 쓰려면

`npm run build:elements`가 만든 `dist-element/yona-markdown-editor-vue-element.js`와
`dist-element/yona-help-markdown-element.js`를 각각 yona 저장소에 vendoring하고,
템플릿에 해당 태그(`<yona-markdown-editor-vue>`/`<yona-help-markdown>`)를 넣으면 됩니다
(각 위젯 구현의 세부 props/계약은 git 이력의 개별 README 참고). 두 커스텀 엘리먼트는
서로 무관하므로 한쪽만 먼저 반영해도 문제 없습니다.

**주의**: 도움말 패널의 `markdownImages` 예시가 실제 yona 정적 에셋
(`/assets/images/ico-like-small.png`)을 가리킵니다 - 이 저장소를 격리 실행(개발
서버/스모크 테스트)할 때는 그 이미지가 404가 나는 게 정상이며, yona에 실제로
vendoring됐을 때만 정상 표시됩니다.

## 테스트

```
npm run test
```

두 위젯의 순수 함수 단위 테스트(에디터 46개 + 도움말 패널 3개 = 49개)를 esbuild로
트랜스파일한 뒤 `node --test`로 한 번에 실행합니다.

## 스모크 테스트

`smoke-test/`:
- `editor-toolbar.mjs`: Vite 개발 서버로 App.vue를 띄운 뒤 9개 툴바 커맨드 + 미리보기
  placeholder 확인.
- `editor-element.mjs`: `dist-element/yona-markdown-editor-vue-element.js`를 정적 HTML
  (`editor-element.html`)에 로드해 shadowRoot attach/getValue()·setValue()/light-DOM
  textarea 동기화 확인.
- `help-panel.mjs`: 같은 개발 서버에서 도움말 패널 아코디언(초기 전부 닫힘/탭 클릭 시
  단일 오픈/재클릭 시 닫힘/다른 탭 클릭 시 자동 전환) 확인.
- `help-element.mjs`: `dist-element/yona-help-markdown-element.js`를 정적 HTML
  (`help-element.html`)에 로드해 같은 토글 동작 확인.

`element.mjs` 두 개는 `npm run build:elements`를 먼저 실행해야 합니다.
