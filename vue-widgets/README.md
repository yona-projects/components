# yona 위젯 Vue 3 SFC 파일럿 모음

yona의 위젯 몇 개를 **Vue 3 Composition API + TypeScript(`<script setup lang="ts">`)** 로
다시 작성한 비교용 구현들을 모아둔 프로젝트입니다. 원래 `editor2/`(마크다운 에디터)와
`help-markdown/`(마크다운 도움말 패널) 두 개의 완전히 독립된 npm 프로젝트였던 것을, 위젯이
늘어나기 시작하는 시점에 맞춰 **하나의 npm 프로젝트로 합쳤습니다**(`package.json`/
`node_modules`/`tsconfig.json`/Vue·Vite 버전을 공유). 이후 세 번째 위젯(`toast/`)도 처음부터
이 프로젝트 안에 추가했습니다. 원본(`components/editor`, 네이티브 Custom Element 버전)은
이 통합과 무관하게 그대로 유지됩니다.

## 디렉터리 구조

```
src/
  editor/         - 마크다운 에디터(commands.ts, mention.ts, preview.ts, toolbarSpec.ts,
                    YonaMarkdownEditor.vue, element.ts)
  help-markdown/  - 마크다운 도움말 패널(toggle.ts, examples.ts, MarkdownHelp.vue, element.ts)
  toast/          - 토스트 알림(format.ts, Toast.vue, element.ts)
  switch/         - 알림 on/off 스위치(YonaSwitch.vue, element.ts)
  dropdown/       - 커스텀 드롭다운(YonaDropdown.vue, element.ts - 시각 템플릿 없이
                    <slot>로 라이트 DOM을 투과하는 얇은 행동 레이어)
  App.vue         - 네 위젯(에디터/도움말/토스트/스위치)을 한 페이지에 나란히
                    마운트하는 개발/데모 하네스 - 드롭다운은 시각 템플릿이 없고
                    부트스트랩 CSS가 필요해 이 데모에는 포함하지 않았다(스모크
                    테스트로만 검증)
test/
  editor-*.test.ts, help-*.test.ts, toast-*.test.ts  - 위젯별 순수 함수 단위 테스트
  (파일명 접두어로 구분)
smoke-test/
  editor-toolbar.mjs, editor-element.mjs, help-panel.mjs, help-element.mjs,
  toast.mjs, toast-element.mjs, switch-element.mjs, dropdown-element.mjs
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
- **커스텀 엘리먼트 빌드는 ES 모듈(`type="module"`) 포맷**: 처음엔 iife로 만들었는데,
  Rollup 자체가 "iife/umd 포맷은 멀티 엔트리를 지원하지 않는다"는 제약이 있어(번들
  전체를 하나의 전역 스코프 함수로 감싸는 구조라 엔트리 간 청크를 나누거나 공유할 방법이
  없기 때문) 위젯마다 별도 `vite build` 호출이 필요했다. es 포맷으로 바꾸니 Vite가 멀티
  엔트리 + 청크 공유(Vue 런타임을 두 위젯이 `_plugin-vue_export-helper-*.js` 공용 청크로
  나눠 씀 - iife 시절엔 각자 중복 포함이었다)를 정식 지원해 `npm run build:elements`
  한 번으로 두 산출물이 다 나온다. 대가는 yona 쪽 `<script>` 태그에 `type="module"`이
  필요하다는 것뿐(최신 브라우저는 전부 지원) - 다만 **`file://`로 직접 열면 안 된다**(아래
  스모크 테스트 절 참고, module script의 상대 임포트가 file:// 오리진에서 CORS로 막힌다).

## 중요: Shadow DOM 커스텀 엘리먼트와 <form>/첨부파일 위젯 연동(마크다운 에디터)

옆에 나란히 놓고 비교하는 검증만으로는 안 드러나고, **실제 `<form>` 안에 넣고
`FormData`를 찍어보거나 첨부파일 위젯과 실제로 연동해봐야만 드러나는 함정**을 두 개
발견했다: `defineCustomElement`는 컴포넌트 전체(내부 `<textarea>` 포함)를 Shadow DOM
안에 마운트한다.
1. Shadow DOM 안의 폼 필드는 표준 사양상 조상 `<form>`의 제출/`FormData`에 자동으로
   포함되지 않는다.
2. `yona.Attachments.js`/`yona.CommentAttachmentsUpdate.js`는 (a) 첨부파일 카드 클릭 시
   raw `textarea.value`를 직접 계산하기 위해 `document.querySelector`로 실제
   `<textarea>`를 찾고, (b) 그 결과를 에디터에 반영하기 위해
   `welTextarea.closest("...").value = ...`처럼 `.value` 접근자 프로퍼티에 직접
   대입한다 - Shadow DOM 안의 Vue 인스턴스는 찾을 수도 다룰 수도 없다.

원본 Custom Element(`editor/`)가 애초에 textarea를 **light DOM**에 일부러 뒀던 이유가
바로 이 두 가지다. `src/editor/element.ts`에서 원본과 동일한 구조로 해결했다 -
`super.connectedCallback()`(Vue 앱을 shadow root에 동기적으로 마운트)이 끝난 직후
wrapper 클래스가 스스로 실제 `<textarea>`를 만들어 host의 **light DOM 자식**으로
붙인다(원본과 동일한 속성 계약: `name`/`id`(`editor-` 접두어)/`data-editor-mode`/
`markdown="true"`). 내부 CM6 문서가 바뀔 때마다(`YonaMarkdownEditor.vue`가
`composed: true`로 shadow 경계를 넘겨 내보내는 `input` 이벤트) 이 light textarea도
동기화한다. 반대 방향(외부 코드가 이 light textarea를 직접 조작한 뒤 `.value = ...`로
되돌려 반영)을 위해 `value` getter/setter도 클래스에 직접 얹었다(Vue의
`defineExpose(getValue/setValue)`는 메서드일 뿐 원본이 제공하던 `.value` 접근자
프로퍼티 자체는 아니다).

이 light DOM textarea 하나가 실제 `<form>` 자손 필드가 되므로 위 1)도 자연스럽게
해결된다 - 처음엔 `ElementInternals`(form-associated custom element)로 1)만 따로
해결했었지만, 그러면 2)는 여전히 안 풀리고 light DOM textarea를 어차피 추가해야 한다면
`ElementInternals`는 불필요해질 뿐 아니라 둘을 같이 쓰면 같은 `name`으로 `FormData`에
값이 중복으로 실리는 부작용이 있어 걷어냈다.

**주의(실제로 겪은 함정)**: light textarea가 발행하는 `input` 이벤트는 light DOM을 타고
host까지도 버블링된다(light textarea가 host의 실제 자식이므로) - 그 이벤트를 다시
"내부 변경"으로 착각해 반응하면 동기화 함수가 또 이벤트를 내보내는 무한 재귀에 빠진다
(실측: `RangeError: Maximum call stack size exceeded`). shadow 안에서 온 composed
이벤트는 host로 리타겟되어 `event.target === (host 자신)`이 되지만, light textarea
자신이 낸 이벤트는 `event.target`이 그 textarea 그대로이므로 이걸로 구분해 후자는
무시해야 한다.

회귀 방지용 스모크 테스트: `smoke-test/editor-form-participation.mjs`(초기값/
`setValue()`/실제 타이핑 세 경로 전부 `FormData`에 반영되는지), `smoke-test/
editor-attachment-sync.mjs`(첨부파일 위젯의 실제 사용 패턴 - `document.querySelector`로
찾기 → raw 조작 → `.value =`로 되돌려 반영 - 을 그대로 재현, P3-50류 회귀 없음까지 확인).

## toast 위젯

`yona.ui.Toast.js`(+ `yona.Common.js`의 `notify()`)를 다시 작성했습니다. 원본은
`new yona.ui.Toast("#container")`가 돌려주는 `{ push(message, duration), clear() }`를
사이트 전역에서 단 하나(싱글턴)만 만들어 쓰는 구조입니다 - 이 컴포넌트도 같은 계약을
`defineExpose(push/clear)`로 제공합니다(`el.push(message, duration, title)`/`el.clear()`).

원본과 의도적으로 다른 점:
- 진입/퇴장 애니메이션(투명도를 수동으로 0→1로 켜고, `nDuration` 뒤 다시 0으로 줄인
  다음 `webkitTransitionEnd`에서 `remove()`)을 Vue의 `<TransitionGroup>`으로 대체했습니다 -
  배열에 넣고 빼는 것만으로 진입/퇴장 트랜지션이 자동 재생됩니다. `webkitTransitionEnd`는
  원본에서도 사실상 레거시 호환용이라 표준 `transitionend` 상당으로 교체한 셈입니다.
- 클릭으로 닫을 때도(원본은 즉시 제거, 페이드 없음) 나머지와 동일한 0.3초 페이드아웃을
  적용합니다 - TransitionGroup이 배열에서 빠지는 모든 항목에 동일한 leave 트랜지션을
  적용하는 것을 그대로 살렸습니다.
- `clear()`도 배열을 통째로 비우는 것만으로 구현했습니다(원본은 `innerHTML=""`로 즉시
  제거) - TransitionGroup이 각 항목의 퇴장 트랜지션을 재생합니다.
- CSS의 `opacity: 90 / 100`(yona.css 10382행)은 발견 당시 CSS 표준상 유효하지 않은 값
  (나눗셈은 `calc()` 밖에서 못 씀)이라 모든 브라우저가 무시하는 죽은 규칙이었습니다 -
  옮기지 않았습니다.

message/title 포맷팅(줄바꿈 → `<br>`, title 굵게 처리 - 원본 `notify(message, duration,
title)`과 `yona.ui.Toast.push()`의 `$yona.nl2br()`을 합친 것)은 `format.ts`의 순수 함수
`toastHtml()`로 뽑아 단위 테스트했습니다.

## switch 위젯

`yona.ui.Switch.js`(bootstrap-switch.js를 대체한 vanilla 구현)를 다시 작성했습니다.
유일한 실사용처는 `user/edit_notifications.html`의 알림 on/off 토글입니다. 원본과
마찬가지로 **체크박스 자신이 진실의 원천**입니다 - `service/yona.user.Setting.js`가
`document.querySelectorAll(".notiUpdate")`로 체크박스를 직접 찾아 `change` 리스너를
붙이므로, 이 컴포넌트는 체크박스를 대신하지 않고 `<slot>`으로 라이트 DOM에 그대로
투과시킵니다(에디터 위젯의 light-DOM textarea와 같은 이유 - Shadow DOM 안에 있으면
외부 코드가 못 찾는다). 실제 노드는 `<slot>` ref의 `assignedElements()`로 얻어와
checked/disabled를 읽고 change를 걸고 dispatch합니다.

**중요(실 대치 검증에서만 드러난 버그 두 개, 옆에 나란히 두는 비교로는 절대 안
드러남)**:
1. **커스텀 엘리먼트 호스트가 기본값 `display: inline`이라 생기는 레이아웃 붕괴**:
   원본 CSS(`.has-switch { display: inline-block; ... }`)는 Shadow DOM 안의 내부 div에만
   적용되고, 정작 호스트(`<yona-switch>`) 자신은 아무 스타일도 없으면 브라우저 기본값인
   `display: inline`으로 렌더진다. 이 상태에서 내부의 float 레이아웃(스위치 좌/우
   라벨)이 inline 호스트의 박스 바깥으로 새어나가, 실제 페이지의 옆 테이블 셀(`<th>`)과
   클릭 가능 영역이 겹쳐버리는 진짜 클릭 회귀가 있었다(Playwright로 실제 페이지에서
   클릭이 계속 다른 엘리먼트에 가로채이는 것으로 발견). `:host { display: inline-block; }`
   로 해결.
2. **`scoped` 블록 안의 `:host`/`:slotted()`가 customElement 빌드에서 조용히
   무효화됨**: Vue의 `scoped` CSS 변환이 일반 셀렉터에는 `[data-v-xxx]` 속성 셀렉터를
   뒤에 붙이는데, `:host`에 이 변환을 그대로 적용하면 `[data-v-xxx]:host`가 되어
   버린다 - `:host`는 반드시 compound selector의 맨 앞에 와야 한다는 CSS Shadow DOM
   스펙 규칙 때문에 이 형태는 아예 매치되지 않는 무효 셀렉터다. 브라우저는 이런 무효
   규칙을 에러 없이 조용히 무시하므로 빌드도 성공하고 콘솔에도 아무 신호가 없다 -
   실제로 요소를 붙여서 레이아웃을 재보기 전까지는 절대 못 알아챈다. `:slotted()`도
   같은 문제로 컴파일된 CSS에서 통째로 사라져(체크박스가 안 숨겨져 float 레이아웃이
   더 깨짐) 있었다. 해결: 이 두 규칙만 **scoped가 아닌 별도 `<style>` 블록**으로 뺐다
   (`YonaSwitch.vue` 참고) - 단, scoped를 안 거치므로 Vue 전용 단일 콜론 `:slotted()`가
   아니라 표준 CSS 이중 콜론 `::slotted()`를 직접 써야 한다(단일 콜론을 쓰면
   lightningcss가 빌드 시 "not recognized" 경고를 내고 그 규칙도 무효가 된다 - 이것도
   실측 확인).

이 두 버그는 하나의 공통 교훈으로 이어진다: **defineCustomElement + scoped 스타일을
쓰는 위젯은 host 자체의 box 모델에 관여하는 CSS(`display` 등)나 `:slotted()`가
필요하면, 그 규칙들은 scoped 블록 밖에 둬야 한다.** 에디터/토스트/도움말 패널은
Shadow DOM 안에서 전부 완결되는 레이아웃이라 이 문제를 겪지 않았다 - 처음으로
"호스트 자신의 표시 방식"과 "라이트 DOM 콘텐츠 스타일링"이 실제로 필요해진 위젯이
스위치였다.

## dropdown 위젯

`yona.ui.Dropdown.js`(Bootstrap dropdown 플러그인에 의존하지 않는 순수 커스텀
구현)를 다시 썼다. 실사용처는 이슈 일괄수정 패널(state/assignee/milestone/
label 5개 드롭다운, `issue/list.html`/`issue/partial_massupdate.html`), 프로젝트/
조직 멤버 권한 변경(`project/members.html`/`organization/members.html`), PR/SVN
diff 브랜치 선택(`pullrequest/view.html`/`code/svnDiff.html`) 등 여러 화면에 걸쳐
있다.

**다른 위젯들과 근본적으로 다른 설계**: 이 위젯은 전체를 Shadow DOM에 그리지
않는다 - 실제로 조사해보니 그러면 안 된다:
1. 드롭다운 열고/닫기(`.open` 클래스 토글)는 이 파일이 아니라 `yona.Common.js`의
   전역 `[data-toggle="dropdown"]` document 클릭 델리게이트가 담당한다. 그
   델리게이트는 `event.target.closest('[data-toggle="dropdown"]')`으로 버튼을
   찾는데, 버튼이 Shadow DOM 안에 있으면 클릭 이벤트가 host로 리타겟되어 절대
   못 찾는다.
2. `<li>` 항목 내용이 담당자 아바타/역할/브랜치명 등 호출부마다 다른 서버 렌더링
   마크업이라, Vue가 선언적으로 다시 그릴 고정 템플릿이 없다.

그래서 호스트 자신이 원본 `.btn-group[data-name]` 컨테이너를 그대로 대신하고
(클래스/`data-name` 속성 유지), 버튼+목록 전체를 `<slot>`으로 라이트 DOM에
그대로 투과한다. Vue는 목록 클릭 시 라벨 텍스트/`active` 클래스/hidden input을
갱신하고 `onChange` 콜백을 호출하는 얇은 행동 레이어만 담당한다. 커스텀
엘리먼트 host 자신에 접근하려고 Vue 3.5+의 `useHost()`(defineCustomElement
전용 API)를 썼다 - 스위치의 `<slot ref>` + `assignedElements()`보다 더 직접적인
방법이라 별도 element.ts wrapper도 필요 없었다.

**실대치 검증**: `issue/list.html`의 state 드롭다운을 실제로 `<yona-dropdown>`로
교체해 이슈 일괄수정 패널에서 검증했다 - 체크박스 선택 시 버튼이 실제로
활성화되는지(`#mass-update-form button` 셀렉터가 라이트 DOM 버튼을 여전히
찾는지), 실제 클릭으로 전역 델리게이트가 `.open` 클래스를 붙이는지(핵심 우려
지점 - 정상 동작 확인), "닫힘" 클릭 시 실제 폼 제출 → 실제 이슈 상태 변경(닫힌
이슈 목록으로 실제 이동)까지 전부 실제 서버 왕복으로 확인했다.

**하위 호환**: `yona.ui.Dropdown.js` 자체를 하이브리드 어댑터로 다시 썼다 -
컨테이너가 `<yona-dropdown>`(태그명으로 판별)면 그 위에 노출된
`getValue`/`onChange`/`selectByValue`/`selectItem`으로 위임하고, 아직
마이그레이션되지 않은 나머지 화면(평범한 `div.btn-group`)은 원본 vanilla
구현이 그대로 처리한다 - 두 경로 다 동일한 공개 계약을 반환해 호출부
(`yona.issue.MassUpdate.js`/`yona.issue.Write.js`/`layout.html`의 자동 초기화
루프)는 코드를 전혀 바꿀 필요가 없다.

## 여기서 마감한 나머지 후보들

이 다섯 위젯(에디터/도움말/토스트/스위치/드롭다운) 이후 `yona.Attachments.js`
+`yona.Files.js`/`yona.CodeCommentBox.js`도 실제 마크업·연동 구조까지 조사했다.
전부 "Vue SFC로 깔끔하게 바꿀 수 있는 자기완결적 위젯"은 아니었다 - 위젯 후보를
평가할 때 참고할 반례로 이유를 남긴다.

- **`yona.ui.Tabs.js`**: 유일한 동작인 `_restoreTab()`이 legacy 버그(`"toggle" ==
  "tab"`가 항상 false로 평가됨, v1.6부터 그대로)로 처음부터 완전한 no-op이다 -
  포팅할 실제 로직이 없다.
- **`yona.CodeCommentBox.js` + `common/reviewForm.html`**: 위젯이 아니라
  `yona.code.Diff.js`(861줄, diff 뷰)에 결합된 DOM 재배치 오케스트레이션이다 - 페이지당
  하나뿐인 폼을 diff 테이블의 여러 위치로 옮겨 재사용하고, 벤더 에디터의 버그를
  `cloneNode` 트릭으로 우회한다. "템플릿을 선언적으로 다시 그리는" 종류의 문제가
  아니다.
- **`yona.Attachments.js`(750줄) + `yona.Files.js`(918줄)**: 이슈/게시글/코드리뷰/
  마일스톤/아바타 업로드 등 앱 전역에서 재사용되는 핵심 서비스다. 첨부파일 카드
  목록도 정적 템플릿이 아니라 `$yona.tmpl()`로 매 순간 동적 생성되고, 컨테이너를
  Shadow DOM으로 감싸면 이 서비스들이 쓰는 `elContainer.querySelector(...)`가 전부
  깨진다(에디터/스위치에서 이미 겪은 문제의 훨씬 큰 버전).
- **`yona.ui.Calendar.js`/`yona.ui.TomSelect.js`**: 각각 Flatpickr/Tom Select라는
  서드파티 라이브러리의 얇은 설정 래퍼일 뿐, Vue가 선언적으로 다시 그릴 자체
  템플릿이 없다(실제 위젯 UI는 라이브러리가 `document.body`에 직접 그린다).
- **`yona.ui.Mergely.js`**: 파일 자체 헤더 주석에 명시된 완전한 죽은 코드다 -
  인스턴스화 호출 0건, 대상 마크업(`#compare`/`#mergely`) 0건, 심지어 의존 라이브러리
  (`$.fn.mergely`)조차 저장소에 존재하지 않는다.

`yona.ui.Dialog.js`/`yona.ui.Dropdown.js`/`yona.ui.Typeahead.js`는 처음엔 이 목록에
넣었었다(전역 버튼 CSS 클래스/전역 dropdown 델리게이트/정적 템플릿 부재 문제) - 하지만
셋 다 스위치/에디터에서 이미 검증한 "열린 부분은 라이트 DOM에 남기고 Vue는 얇은 행동
레이어만 맡는다"는 탈출구로 풀리는 문제였다. `yona.ui.Dropdown.js`는 위 "dropdown
위젯" 절에서 실제로 구현·실대치 검증까지 마쳤다 - Dialog/Typeahead는 같은 탈출구가
적용된다는 것만 확인했고 아직 구현하지 않았다(다음 후보).

## 요구 사항

- Node.js `>= 18`

## 개발 서버

```
npm install
npm run dev
```

`src/App.vue`가 네 위젯을 한 페이지에 마운트합니다(에디터/도움말 패널이 위 -
원본 yona 화면에서 markdownEditor 프래그먼트 옆에 help/markdown 프래그먼트가 나란히
있는 배치와 동일 -, 토스트는 버튼으로 트리거해보는 데모).

## 빌드

```
npm run build           # 데모 앱 전체를 정적 산출물로(dist/)
npm run build:elements  # 다섯 위젯을 <yona-markdown-editor-vue>/<yona-help-markdown>/
                         # <yona-toast>/<yona-switch>/<yona-dropdown> 네이티브 커스텀
                         # 엘리먼트로 한 번에(dist-element/, es 모듈 포맷 - 엔트리 5개 +
                         # 위젯들이 공유하는 청크 - 청크 파일명은 빌드마다 바뀔 수 있다)
npm run typecheck
```

## yona에 실제로 꽂아 쓰려면

`npm run build:elements`가 만든 `dist-element/` 안의 파일 **전부**(엔트리 5개
`yona-markdown-editor-vue-element.js`/`yona-help-markdown-element.js`/
`yona-toast-element.js`/`yona-switch-element.js`/`yona-dropdown-element.js` + 공유
청크 - 엔트리들이 상대 경로 `import`로 참조하므로 같은 디렉터리에 같이 있어야
한다)를 yona 저장소에 vendoring하고, 템플릿에 해당 태그(`<yona-markdown-editor-vue>`/
`<yona-help-markdown>`/`<yona-toast>`/`<yona-switch>`/`<yona-dropdown>`)와
**`<script type="module">`**을 넣으면 됩니다(각 위젯 구현의 세부
props/계약은 git 이력의 개별 README 및 이 파일의 각 위젯 절 참고). 커스텀 엘리먼트들은
서로 무관하므로 일부만 먼저 반영해도 문제 없습니다 - 공유 청크만 같이 복사하면 됩니다.

**주의**: 도움말 패널의 `markdownImages` 예시가 실제 yona 정적 에셋
(`/assets/images/ico-like-small.png`)을 가리킵니다 - 이 저장소를 격리 실행(개발
서버/스모크 테스트)할 때는 그 이미지가 404가 나는 게 정상이며, yona에 실제로
vendoring됐을 때만 정상 표시됩니다.

## 테스트

```
npm run test
```

네 위젯의 순수 함수 단위 테스트(에디터 46개 + 도움말 패널 3개 + 토스트 4개 = 53개 -
스위치는 라이트 DOM 체크박스 조작이 핵심이라 순수 함수로 뽑을 로직이 없어 전부
스모크 테스트로만 검증)를
esbuild로 트랜스파일한 뒤 `node --test`로 한 번에 실행합니다.

## 스모크 테스트

`smoke-test/`:
- `editor-toolbar.mjs`: Vite 개발 서버로 App.vue를 띄운 뒤 9개 툴바 커맨드 + 미리보기
  placeholder 확인.
- `editor-element.mjs`: `dist-element/yona-markdown-editor-vue-element.js`를 정적 HTML
  (`editor-element.html`, `<script type="module">`)에 로드해 shadowRoot
  attach/getValue()·setValue()/light-DOM textarea 동기화 확인.
- `editor-form-participation.mjs`: 실제 `<form>` 안에 넣고 `FormData`로 초기값/
  `setValue()`/실제 타이핑 세 경로 전부 제출값에 실리는지 확인(위 "Shadow DOM 커스텀
  엘리먼트와 <form>/첨부파일 위젯 연동" 절 회귀 방지).
- `editor-attachment-sync.mjs`: 첨부파일 위젯의 실제 사용 패턴(`document.querySelector`로
  light DOM textarea 찾기 → raw 조작 → `.value =`로 되돌려 반영)을 그대로 재현해
  `getValue()`에 반영되는지, P3-50류 회귀(나중에 CM6가 스스로 되돌리지 않는지)가 없는지
  확인.
- `help-panel.mjs`: 같은 개발 서버에서 도움말 패널 아코디언(초기 전부 닫힘/탭 클릭 시
  단일 오픈/재클릭 시 닫힘/다른 탭 클릭 시 자동 전환) 확인.
- `help-element.mjs`: `dist-element/yona-help-markdown-element.js`를 정적 HTML
  (`help-element.html`, `<script type="module">`)에 로드해 같은 토글 동작 확인.
- `toast.mjs`: 같은 개발 서버에서 토스트(push() 직후 표시/title 굵게 렌더링/클릭하면
  사라짐/duration 경과 후 자동 소멸/clear()로 전부 제거) 확인.
- `toast-element.mjs`: `dist-element/yona-toast-element.js`를 정적 HTML
  (`toast-element.html`, `<script type="module">`)에 로드해 같은 동작 확인.
- `switch-element.mjs`: `dist-element/yona-switch-element.js`를 정적 HTML
  (`switch-element.html`, `<script type="module">`)에 로드해 (a) 슬롯된 체크박스가
  document 레벨에서 여전히 검색 가능한지(라이트 DOM 유지 확인), (b) `.switch-left`/
  `.switch-right` 클릭과 스페이스바로 실제 토글되는지, (c) 그때마다 라이트 DOM
  체크박스에 진짜 `change` 이벤트가 발생하는지 확인.
- `dropdown-element.mjs`: `dist-element/yona-dropdown-element.js`를 정적 HTML
  (`dropdown-element.html`, `<script type="module">`)에 로드해 (a) 토글 버튼이
  document 레벨에서 여전히 검색 가능한지, (b) `data-selected=true` 기본값이 마운트
  시 자동 선택되는지, (c) 실제 항목 클릭으로 라벨/active 클래스/hidden input이
  갱신되는지, (d) `getValue`/`onChange`/`selectByValue` defineExpose API가 정상
  동작하는지 확인.

`*-element.mjs` 다섯 개는 `npm run build:elements`를 먼저 실행해야 합니다. 또한 es 모듈
포맷이라 `element.html`을 `file://`로 직접 열면 module script의 상대 임포트(공유 청크)가
CORS로 막힙니다(실측 확인) - 그래서 세 스크립트 다 Vite 개발 서버로 `dist-element/`가
포함된 프로젝트 루트를 잠깐 정적 서빙한 뒤 `http://localhost:<port>/smoke-test/
*-element.html`로 접속합니다(빌드/변환 없이 있는 그대로 서빙 - `npm run dev`와 달리
HMR 클라이언트가 끼어들지 않음).
