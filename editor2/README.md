# yona-markdown-editor (Vue 3 SFC판)

`../editor`(네이티브 Custom Element + Shadow DOM 버전)를 그대로 복사해 **Vue 3
Composition API + TypeScript(`<script setup lang="ts">`)** 로 다시 작성한 비교용
구현입니다. 원본은 그대로 유지되며, 이 디렉터리는 "같은 기능을 다른 프레임워크로 만들면
어떤 모습이 되는가"를 보여주기 위한 것으로, yona 본체에는 아직 vendoring되지 않습니다.

## 원본과 달라진 점

- **Shadow DOM 없음 → `scoped` 스타일**: Vue SFC의 관용적 스코핑(컴파일 시 자동 부여되는
  `data-v-*` 속성 선택자)을 그대로 씁니다. 원본의 `::part()` 테마 계약은 Shadow DOM 전제라
  의미가 없어 제거했고, `--yona-md-*` CSS 커스텀 프로퍼티 계약(부모가 색상/치수를 오버라이드)만
  유지합니다.
- **값 계약: `v-model`이 1차 API**: 원본의 공개 `value` getter/setter(명령형 API) 대신
  `modelValue` prop + `update:modelValue` emit으로 양방향 바인딩을 지원합니다. 명령형 접근이
  필요한 소비자를 위해 `defineExpose({ getValue, setValue })`도 함께 내보냅니다(원본 getter/
  setter와 동일한 계약).
- **`renderUrl`/`mentionUrl`은 명시적 prop**: 원본이 `closest('[data-toggle="markdown-editor"]')`로
  조상 DOM에서 읽던 것은 Thymeleaf 프래그먼트 통합을 위한 우회였습니다. Vue 컴포넌트는 이를
  그냥 prop으로 받습니다.
- **`useId()`로 인스턴스별 textarea id 생성**: 원본의 모듈 스코프 카운터(`instanceCounter`)
  대신 Vue 3.5+의 `useId()`(SSR-safe)를 씁니다.
- **`toolbar.ts`(DOM을 직접 만들어 붙이던 코드) → `toolbarSpec.ts`(순수 데이터) + 템플릿
  `v-for`**: Vue는 imperative DOM 생성 대신 선언적 템플릿이 관용적이므로, 버튼 spec만 데이터로
  남기고 실제 렌더링은 `YonaMarkdownEditor.vue`의 `<template>`이 담당합니다.

## 원본과 동일하게 재사용한 부분

`commands.ts`(9개 툴바 커맨드 순수 로직), `mention.ts`(멘션 자동완성 순수 로직 + CM6 확장
팩토리), `preview.ts`(디바운스+레이스가드 미리보기 컨트롤러)는 애초에 프레임워크에 의존하지
않으므로 **원본과 완전히 동일한 파일**을 그대로 재사용합니다. 포팅이 필요했던 부분은 오직
Custom Element 껍데기(연결/해제 라이프사이클, 폼 통합, 툴바 DOM 생성)뿐이었습니다. 단위
테스트(`test/*.test.ts`)도 이 파일들을 대상으로 하므로 원본과 동일합니다.

CM6 패키지 버전은 원본과 동일하게 pin되어 있습니다. 임의로 올리지 마세요.

## 요구 사항

- Node.js `>= 18`

## 개발 서버

```
npm install
npm run dev
```

`src/App.vue`가 `YonaMarkdownEditor.vue`를 `v-model`로 마운트하는 최소 데모입니다.

## 빌드

```
npm run build
```

`vue-tsc --noEmit`로 타입 검사한 뒤 Vite 라이브러리 모드로 `YonaMarkdownEditor.vue`를
빌드합니다(`vue`는 peer로 취급 - 번들에 포함되지 않음). `npm run typecheck`로 타입 검사만
따로 돌릴 수 있습니다.

## 테스트

```
npm run test
```

`commands.ts`/`mention.ts`/`preview.ts`에 대한 순수 함수 단위 테스트(46개, 원본과 동일)를
esbuild로 트랜스파일한 뒤 `node --test`로 실행합니다.

## 스모크 테스트

`smoke-test/`는 Vite 개발 서버를 띄운 뒤 Playwright로 9개 툴바 커맨드 + 미리보기 placeholder를
확인합니다(원본 `editor/smoke-test/toolbar.mjs`와 동일한 시나리오, `<yona-markdown-editor>`
커스텀 엘리먼트의 `.value` 대신 `App.vue`가 테스트 편의상 `window.__yonaEditor`에 노출한
`getValue()`/`setValue()`를 사용).
