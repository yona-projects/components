# yona-markdown-editor

CodeMirror 6 기반 마크다운 에디터 Web Component(`<yona-markdown-editor>`). yona의
EasyMDE(CodeMirror5)+Tribute.js 조합을 대체합니다.

## 상태

- `spike/` — 0단계(Shadow DOM+CM6 go/no-go 검증) 실험 코드. 정식 컴포넌트가 아닙니다.
  Chromium/Firefox/WebKit 3개 엔진에서 Shadow DOM 안에 CM6를 마운트해도 스타일/캐럿/선택/
  타이핑/구문강조가 전부 정상 동작함을 확인 완료(0단계 통과 — Shadow DOM 채택 확정).
- 정식 컴포넌트 소스(`src/`)는 아직 없습니다(1단계부터 시작).

## 빌드 (예정)

```
npm install
npm run build
```

산출물은 `yona/src/main/resources/static/javascripts/lib/yona-markdown-editor/`로 수동 복사해
커밋합니다(yona 저장소의 Gradle 빌드/CI와는 무관 — 이 저장소에서 로컬로 빌드한 결과물만 넘김).
