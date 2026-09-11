# yona-projects/components

yona(https://github.com/yona-projects/yona)에서 쓰는 자체 제작 Web Component 모음 저장소입니다.
모노레포 구조 — 컴포넌트마다 독립된 하위 디렉터리에 자기완결적인 npm 패키지로 둡니다
(공유 워크스페이스 도구 없이, 각 디렉터리가 자체 `package.json`/빌드 스크립트를 가짐).

## 원칙

- **yona 본체(Spring Boot/Kotlin/Gradle)와 완전히 분리**되어 있습니다. yona 저장소에는
  Node.js/npm 관련 파일이 전혀 없고, 이 저장소에서 로컬로 빌드한 산출물(단일 번들 파일)만
  yona의 `src/main/resources/static/javascripts/lib/<component>/`에 커밋되어 vendoring됩니다.
- 새 컴포넌트를 추가할 땐 `<component-name>/` 디렉터리를 새로 만들고 그 안에서 완결되게
  구성하세요(다른 컴포넌트와 코드 공유가 꼭 필요해지기 전까지는 워크스페이스화하지 않습니다).
- 각 컴포넌트 디렉터리의 README에 빌드 방법(Node 버전, `npm install && npm run build`)과
  산출물이 yona 쪽 어디로 복사되는지를 명시하세요.

## 컴포넌트 목록

- [`editor/`](./editor) — CodeMirror 6 기반 마크다운 에디터 Web Component
  (`<yona-markdown-editor>`). yona의 EasyMDE+Tribute.js 조합을 대체.
