# yona-markdown-editor

CodeMirror 6 기반 마크다운 에디터 Web Component(`<yona-markdown-editor>`). yona의
EasyMDE(CodeMirror5)+Tribute.js 조합을 대체합니다.

> **이 저장소는 yona 본체(Gradle/CI)와 완전히 무관합니다.**
> 컴포넌트를 수정할 때마다 **여기서 로컬로 빌드**한 뒤, **산출물(`dist/yona-markdown-editor.min.js`)만
> yona 저장소에 수동으로 복사·커밋**합니다. yona 저장소에는 이 컴포넌트의 소스도, node_modules도,
> npm 설정도 절대 들어가지 않습니다 — 오직 빌드된 단일 번들 파일만 vendoring됩니다.

## 상태

- `spike/` — 0단계(Shadow DOM+CM6 go/no-go 검증) 실험 코드. 정식 컴포넌트가 아닙니다.
  Chromium/Firefox/WebKit 3개 엔진에서 Shadow DOM 안에 CM6를 마운트해도 스타일/캐럿/선택/
  타이핑/구문강조가 전부 정상 동작함을 확인 완료(0단계 통과 — Shadow DOM 채택 확정).
- `src/`, `package.json`, `build.mjs` — 1단계(빌드 인프라) 완료. `<yona-markdown-editor>`
  Custom Element가 등록되고 Shadow DOM이 attach되는 최소 골격까지만 존재합니다.
  CM6 EditorView 마운트, light DOM `<textarea>` 동기화, 툴바, 미리보기, 멘션 자동완성은
  전부 이후 단계(2~5단계) 범위이며 아직 구현되어 있지 않습니다.

CM6 패키지 버전(`@codemirror/state` `6.7.4` / `view` `6.43.11` / `commands` `6.11.0` /
`lang-markdown` `6.5.2`)은 0단계 스파이크(`spike/package-lock.json`)에서 실제로 설치·검증된
정확한 버전을 그대로 pin한 것입니다. 임의로 최신 버전으로 올리지 마세요 — 올릴 필요가 생기면
별도로 검증(Playwright 3엔진 스모크 재실행)한 뒤 pin을 갱신하세요.

## 요구 사항

- Node.js `>= 18` (esbuild 0.24.x 요구 사항, `package.json`의 `engines` 필드와 동일)

## 빌드

```
npm install
npm run build
```

`dist/yona-markdown-editor.min.js`(+ `.map`)가 생성됩니다. `npm run typecheck`로 타입 검사만
별도로 돌릴 수 있습니다(빌드 자체에는 타입 검사가 포함되어 있지 않음 — esbuild는 타입을 지우기만
합니다).

## yona 쪽 반영 절차 (2단계부터 적용)

1. 이 디렉터리에서 컴포넌트 소스를 수정합니다.
2. `npm install && npm run build`로 로컬 빌드해 `dist/yona-markdown-editor.min.js`를 갱신합니다.
3. 그 파일 하나를
   `yona/src/main/resources/static/javascripts/lib/yona-markdown-editor/yona-markdown-editor.min.js`
   경로로 수동 복사합니다.
4. yona 저장소에서 그 복사된 파일을 커밋합니다(이 저장소의 커밋과는 별개의 커밋).

1단계(현재)에서는 아직 컴포넌트가 눈에 보이는 동작을 하지 않으므로 yona 쪽 복사는 하지
않았습니다 — 2단계(셸: 폼 통합 + 기본 편집)에서 처음 연결합니다.

## 스모크 테스트

`smoke-test/`에 최소 정적 HTML + Playwright 스크립트가 있습니다(1단계 검증용). 콘솔 에러 없이
`<yona-markdown-editor>`가 로드되고 `shadowRoot`가 attach되는지만 확인하는 용도이며, 정식
회귀 테스트 스위트가 아닙니다.
