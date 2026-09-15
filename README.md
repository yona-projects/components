# yona-projects/components

yona(https://github.com/yona-projects/yona)에서 쓰는 자체 제작 Web Component 모음 저장소입니다.
컴포넌트마다 독립된 하위 디렉터리에 자기완결적인 npm 패키지로 두는 것이 기본 원칙이지만
(공유 워크스페이스 도구 없이, 각 디렉터리가 자체 `package.json`/빌드 스크립트를 가짐),
같은 스택(Vue 3 SFC)으로 여러 위젯을 만들어보는 파일럿 단계에서는 `vue-widgets/`처럼
하나의 npm 프로젝트 안에 여러 위젯을 모아두기도 합니다 - 아래 컴포넌트 목록 참고.

## 원칙

- **yona 본체(Spring Boot/Kotlin/Gradle)와 완전히 분리**되어 있습니다. yona 저장소에는
  Node.js/npm 관련 파일이 전혀 없고, 이 저장소에서 로컬로 빌드한 산출물(단일 번들 파일)만
  yona의 `src/main/resources/static/javascripts/lib/<component>/`에 커밋되어 vendoring됩니다.
- 새 컴포넌트를 추가할 땐 기본적으로 `<component-name>/` 디렉터리를 새로 만들고 그 안에서
  완결되게 구성하세요. 다만 같은 프레임워크로 여러 위젯을 병행 실험하는 단계라면(예:
  `vue-widgets/`) `package.json`/`node_modules`/버전 관리를 하나로 공유하는 쪽이 더
  실용적일 수 있습니다 - 그 경우에도 위젯별 커스텀 엘리먼트 빌드 산출물(`dist-element/`
  안의 파일)만큼은 위젯당 1개로 분리해 서로 코드를 공유하지 않게 유지하세요.
- 각 컴포넌트 디렉터리의 README에 빌드 방법(Node 버전, `npm install && npm run build`)과
  산출물이 yona 쪽 어디로 복사되는지를 명시하세요.

## 컴포넌트 목록

- [`editor/`](./editor) — CodeMirror 6 기반 마크다운 에디터 Web Component
  (`<yona-markdown-editor>`). yona의 CodeMirror5 기반 마크다운 에디터+Tribute.js 조합을 대체.
  실사용 중인 원본 버전.
- [`vue-widgets/`](./vue-widgets) — 위 `editor/`를 포함해 yona 위젯 몇 개를 Vue 3
  Composition API + TypeScript SFC로 다시 작성한 비교용 파일럿 모음(마크다운 에디터,
  마크다운 도움말 패널). 아직 yona 본체에 vendoring되지 않았습니다.
