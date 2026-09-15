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
  dialog/         - 전역 alert/confirm 모달(YonaDialog.vue, element.ts - 배경/메시지/
                    닫기 버튼은 Shadow DOM, 버튼만 명령형으로 라이트 DOM에 생성)
  typeahead/      - 자동완성 입력(YonaTypeahead.vue, element.ts - 메뉴는 Shadow DOM,
                    <input>만 <slot>으로 라이트 DOM 투과, :host{position:relative}로
                    위치 지정)
  attachments/    - 첨부파일 업로더(YonaAttachments.vue, element.ts - 드롭존/버튼/카드
                    목록은 Shadow DOM, 외부 <textarea>는 configure()로 명령형 연동)
  review-form/    - 플로팅 코드리뷰 댓글 상자(YonaReviewForm.vue, element.ts -
                    <Teleport>로 diff 테이블의 필요한 위치에 실제 라이트 DOM으로
                    옮겨 그리고, <yona-markdown-editor-vue>/<yona-attachments>를
                    자식으로 조합한다)
  pagination/     - 페이지네이션(pagination.ts 순수 함수 + YonaPagination.vue,
                    element.ts - 매번 새로 그리는 stateless 위젯, Toast와 같은 계열)
  login-dialog/   - 익명 사용자용 로그인 다이얼로그(YonaLoginDialog.vue, element.ts -
                    <Teleport to="body">로 review-form과 같은 이유(전역 CSS 상속)로
                    라이트 DOM에 그린다, fetch() 기반 제출)
  scroll-elevator/ - "맨 위로/맨 아래로 스크롤" 버튼(YonaScrollElevator.vue, element.ts -
                    <Teleport to="body">로 서드파티 jquery.elevator.css를 그대로
                    상속받는다, 서버 렌더 대상 없이 항상 새 엘리먼트를 만들어 붙임)
  page-slide/     - 2단 보기 모드의 슬라이드 iframe 패널(YonaPageSlide.vue,
                    element.ts - CSS는 인라인 스타일로 직접 재현, host에는
                    id를 주지 않는다(전역 #pageslide 규칙과 충돌 방지 - 어댑터가
                    클로저 변수로 엘리먼트를 캐싱))
  App.vue         - 네 위젯(에디터/도움말/토스트/스위치)을 한 페이지에 나란히
                    마운트하는 개발/데모 하네스 - 드롭다운/다이얼로그/타입어헤드/
                    어태치먼트/review-form/pagination/login-dialog/scroll-elevator/
                    page-slide는 시각 템플릿이 없거나 정적 마크업으로 데모하기
                    애매해서 이 데모에는 포함하지 않았다(스모크 테스트로만 검증)
test/
  editor-*.test.ts, help-*.test.ts, toast-*.test.ts, pagination.test.ts  - 위젯별
  순수 함수 단위 테스트(파일명 접두어로 구분)
smoke-test/
  editor-toolbar.mjs, editor-element.mjs, help-panel.mjs, help-element.mjs,
  toast.mjs, toast-element.mjs, switch-element.mjs, dropdown-element.mjs,
  dialog-element.mjs, typeahead-element.mjs, attachments-element.mjs,
  review-form-element.mjs, pagination-element.mjs, login-dialog-element.mjs,
  scroll-elevator-element.mjs, page-slide-element.mjs
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

## dialog 위젯

`yona.ui.Dialog.js`(네이티브 `<dialog>` + `showModal()`/`close()` 기반 사이트
전역 싱글턴 모달)를 다시 썼다. `$yona.alert()`/`$yona.confirm()`이 쓰는
`#yonaDialog`의 실제 대체 대상이다 - 프로젝트 이름 검증 실패, 멤버/라벨 삭제
확인 등 사이트 전체에서 광범위하게 쓰인다.

**다른 위젯들과 근본적으로 다른 설계**(dropdown과 같은 계열의 이유, 다른
블로커): 버튼 스타일(`showConfirm`의 `aButtonStyles`)을 호출부가 그때그때
임의의 전역 CSS 클래스(`ybtn-info`/`ybtn-danger`/`ybtn-default` 등 사이트 전체
버튼 디자인 시스템 아무거나)로 지정한다. Shadow DOM 안에 넣으면 이 임의
클래스들이 전역 CSS를 받지 못한다(그 디자인 시스템 전체를 컴포넌트 안에
복제하지 않는 한). 그래서 버튼만 `show()` 호출 시점에 명령형으로 만들어
라이트 DOM에 두고 이름 있는 슬롯(`slot="buttons"`)으로 투과시킨다 - 배경
(`::backdrop`)/메시지/설명/X 닫기 버튼 같은 고정된 나머지 껍데기(`.modal`/
`.yonaDialog`의 병합된 CSS)만 Vue가 Shadow DOM에서 소유한다. 커스텀 엘리먼트
host 자신에 접근하려고 dropdown과 동일하게 `useHost()`를 썼다.

**i18n**: `Messages()`는 `messages.js`(site/layout.html이 항상 먼저 로드)가
전역으로 노출하는 i18n 함수라, 다른 vanilla JS 파일들과 동일하게 그냥 전역으로
호출한다(격리된 스모크 테스트 환경처럼 없을 때만 "Confirm" 영어 기본값으로
안전하게 폴백).

**실대치 검증**: `site/layout.html`의 `#yonaDialog`를 실제로 `<yona-dialog>`로
교체해 검증했다 - (a) 프로젝트 설정 화면에서 실제로 잘못된 이름을 입력해
저장하면 실제 `$yona.showAlert()` 경로를 타고 실제 i18n 메시지("Enter name in
alphabetnumerical...")와 기본 확인 버튼(`ybtn ybtn-info`, 전역 CSS로 파란
배경까지 정확히 렌더링됨)이 뜨는지, (b) 실제 `$yona.confirm()`으로 커스텀
버튼(라벨/스타일 둘 다 호출부 지정) 두 개를 띄우고 그중 하나를 클릭하면
`fOnClickButton` 콜백이 정확한 `nButtonIndex`로 호출되는지, (c)
`$yona.alert`/`$yona.confirm`이 매번 `cloneNode`로 독립된 인스턴스를 만드는
원본 관례가 Vue 커스텀 엘리먼트를 클론해도 그대로 유지되는지(클론이
`document.body`에 연결되는 순간 완전히 새 Vue 인스턴스로 마운트됨, 기존
shadowRoot 상태를 물려받지 않음)까지 전부 실서버 화면에서 확인했다.

**하위 호환**: `yona.ui.Dialog.js`도 하이브리드 어댑터로 다시 썼다 - 컨테이너가
`<yona-dialog>`(태그명으로 판별)면 매 호출마다 클론해 그 위에 노출된
`show`/`hide`로 위임하고(원본의 `cloneNode` 관례 그대로 유지), 그렇지 않으면
원본 vanilla 구현이 처리한다.

## typeahead 위젯

`yona.ui.Typeahead.js`(Bootstrap bootstrap-typeahead.js에 의존하지 않는 순수
커스텀 자동완성 구현)를 다시 썼다. 프로젝트 태깅, 멤버 로그인ID 검색, 이슈
라벨 카테고리 자동완성 등 5개의 서로 다른 호출부(`yona.project.Home.js`/
`yona.site.MassMail.js`/`yona.project.Member.js`/`yona.issue.LabelEditor.js`/
`yona.organization.Member.js`)가 쓴다.

**다른 위젯들과 또 다른 종류의 블로커**: 이 위젯은 정적 Thymeleaf 템플릿이
아니라 **이미 존재하는 `<input>`에 생성자가 직접 인스턴스화**하는 방식이다
(`new yona.ui.Typeahead(existingInput, options)`) - 그래서 애초에 "교체할
고정된 마크업"이 없다. 탈출구: 생성자(어댑터) 자신이 그 자리에서 대상
input을 `<yona-typeahead>`로 감싸므로(idempotent - 이미 감싸져 있으면
재사용) 5개 호출부 코드는 전혀 바꾸지 않는다.

**메뉴는 dropdown/dialog와 달리 Shadow DOM에 전부 그린다**: dropdown의
`<li>`(담당자 아바타 등 호출부마다 다른 마크업)나 dialog의 버튼(호출부가
임의의 전역 CSS 클래스 지정)과 달리, 이 위젯의 메뉴는 **항상 같은 모양**이다
(문자열 배열 -> `<li><a>텍스트</a></li>`, 하이라이트는 `<strong>`뿐) - 열린
계약이 아니라 닫힌 계약이라 Vue가 선언적으로 그려도 안전하다(bootstrap.css의
`.dropdown-menu` CSS를 그대로 이식). `<input>` 자신만 `<slot>`으로 라이트
DOM에 남긴다(포커스/타이핑 상태 유지, 다른 코드의 참조 보존).

**위치 지정 단순화**: 원본은 메뉴가 입력창의 형제 엘리먼트였기 때문에
`offsetTop`/`offsetLeft`를 JS로 직접 계산해야 했다. 이 컴포넌트는 호스트
자신을 `:host { position: relative; }`로 만들어(스위치에서 검증한 `:host`
scoped 버그 회피 패턴 재사용) 메뉴를 순수 CSS(`top: 100%`)만으로 입력창
바로 아래에 놓는다 - 의도적인 개선이며, 실제 화면에서 픽셀 단위로 시각
검증했다.

**실대치 검증**: `site/layout.html`에 위젯 스크립트를 추가하고 실제
이슈 라벨 관리 화면(`issue/labelsform`)에서 검증했다 - (a) 카테고리
입력창이 실제로 `<yona-typeahead>`에 감싸지는지, (b) 새 카테고리("UrgentCat")를
실제로 생성(확인 다이얼로그 포함 - 원본 vanilla Dialog 그대로)한 뒤, (c)
카테고리 입력창에 "Urg"를 타이핑하면 서버가 실제로 렌더링한 `vars.categories`
기반으로 진짜 자동완성("UrgentCat")이 뜨는지, (d) 클릭 선택 시 입력값이
정확히 반영되는지까지 전부 실서버 화면에서 확인했다.

## attachments 위젯

`yona.Attachments.js`(+`yona.Files.js`의 XHR2 업로드 부분)를 다시 썼다.
`common/uploadForm.html`(드롭존+업로드 버튼+첨부파일 카드 목록)의 실제 대체
대상이고, 이슈/게시글/코드리뷰/마일스톤 작성 폼 등 앱 전역에서 쓰인다.

**처음엔 "위젯 경계가 아예 없다"고 판단했었다** - 실제로 쪼개보니 근거가
없었다:
1. **컨테이너 내부를 파고드는 외부 코드가 있다고 생각했으나 실제로는 0건**
   이었다 - 첨부파일 컨테이너를 참조하는 5개 파일(`board.View.js`/
   `code.Diff.js`/`code.SvnDiff.js`/`issue.View.js`/`milestone.View.js`)을
   전수 확인한 결과, 전부 컨테이너 자기 자신을 찾거나(`getElementById`/
   `querySelector(".upload-wrap")`) `._isYonaAttachment` expando만
   확인했다 - 내부 DOM을 참조하는 코드는 없었다.
2. **첨부파일 카드 마크업이 호출부마다 다른 커스텀 템플릿(`sTplFileItem`)
   이라고 생각했으나**, 실제로 이 옵션을 오버라이드하는 호출부는 0건이었다
   (전부 `site/layout.html`의 전역 `<script id="tplAttachedFile">`를 그대로
   읽어 쓴다) - 즉 실질적으로 닫힌 계약이라 Vue가 선언적으로 그대로 그린다.
3. **`<input type="file">`를 외부에서 직접 참조하는 코드도 0건**이었다.

그래서 컨테이너 전체(드롭존/버튼/카드 목록)를 Shadow DOM에서 Vue가 소유한다.
단 하나, `<textarea>`(마크다운 에디터)만 이 컨테이너 밖 다른 위치에 있는
완전히 별개의 엘리먼트라 슬롯으로 투과시킬 수 없다 - 드롭다운/다이얼로그와
동일하게 `configure({ textarea, ... })` 명령형 API로 외부 참조를 주입받는다.
`yona.Files.js`(XHR2 진행률/드래그/붙여넣기 엔진, 문자열 네임스페이스 pub-sub)는
그대로 vanilla로 남겨뒀다 - 이 컴포넌트는 그 이벤트 버스를 구독하지 않고
업로드 로직을 자체적으로 소유한다(아바타 업로드는 `yona.Files.js`를 독립적으로
직접 쓰는 별개 소비자라 영향 없음).

**실제 대치 검증 중 발견한 진짜 버그**: 원본은 붙여넣기(paste)가 업로드
컨테이너가 아니라 **실제 마크다운 에디터의 `<textarea>`에 포커스가 있을 때
동작**한다(`yona.Files.js`가 `welTextarea`에 직접 리스너를 붙임) - 처음엔
이 컴포넌트 자신의 템플릿 루트에 `@paste`를 걸었는데, 그러면 실제 사용
시나리오(에디터에 포커스를 두고 이미지 붙여넣기)에서 **절대 발동하지
않는다**(완전히 다른 DOM 위치라 이벤트가 전파될 경로 자체가 없음). `configure()`가
외부 textarea 참조를 받는 시점에 `addEventListener`로 직접 붙이도록 고쳤다 -
스모크 테스트에 회귀 방지 테스트를 추가했다(합성 `ClipboardEvent`를 textarea에
직접 디스패치해 카드가 실제로 생성되는지 확인).

또한 `yona.Files.js._getUploader()`도 호출부(`yona.issue.Write.js` 등)가
`new yona.Attachments(...)`보다 **먼저** 무조건 호출하는 진입점이라, `<yona-attachments>`
컨테이너에도 자기 자신의 (이제는 못 찾는) 라이트 DOM 셀렉터 기반 리스너를 걸려고
시도해 컴포넌트 자신의 처리와 충돌(업로드 중복 등)할 뻔했다 - 태그명으로 판별해
그 경우엔 이벤트 연결만 건너뛰도록 했다(반환값 모양과 `data-namespace` 설정은
그대로 유지해 호출부의 나머지 흐름은 안 깨지게 함).

**실대치 검증**: `issue/create.html`의 `#upload` 컨테이너를 실제로
`<yona-attachments>`로 교체해 이슈 작성 폼에서 전체 플로우를 실서버로
확인했다 - 실제 파일 업로드(`/files` 실제 POST) → 완료된 카드 클릭 시 실제
마크다운 에디터(`<yona-markdown-editor>`)의 CM6에 링크가 동기화되는지 → 실제
폼 제출 → 저장된 이슈 페이지에 본문과 첨부파일 카드(다운로드 링크 포함)가
실제로 영속되어 나타나는지까지 전부 확인했다.

**하위 호환**: `yona.Attachments.js`도 하이브리드 어댑터로 다시 썼다 -
컨테이너가 `<yona-attachments>`(태그명으로 판별)면 `configure()`로 위임하고,
그렇지 않으면 원본 vanilla 구현이 처리한다.

## review-form 위젯

`yona.CodeCommentBox.js` + `common/reviewForm.html`을 다시 썼다. 페이지당
단 하나만 존재하는 "플로팅 코드리뷰 댓글 상자"로, 코드 diff 화면에서 새
라인/범위 댓글을 달 때든 기존 스레드에 답글을 달 때든 이 하나의 컴포넌트를
diff 테이블의 필요한 위치로 옮겨 재사용한다.

**처음엔 "diff 뷰에 결합된 DOM 재배치 오케스트레이션이라 위젯 경계가 없다"고
판단했었다** - 다시 쪼개보니 둘 다 실제로는 풀리는 문제였다:
1. **DOM 재배치**(원본은 `appendChild`로 폼을 diff 테이블의 여러 위치로 옮김)
   → Vue의 `<Teleport :to="...">`가 정확히 이 문제를 위한 선언적 기능이다.
   **핵심 발견(다른 위젯과 가장 다른 점)**: Teleport로 이동한 콘텐츠는 이
   컴포넌트의 Shadow DOM 밖, 목적지의 진짜 라이트 DOM이 된다 - 그래서
   review-form/write-comment-box 등의 CSS를 이 컴포넌트 안에 이식할 필요가
   전혀 없었다(전역 yona.css를 그대로 상속받는다 - 지금까지 만든 위젯 중
   유일하게 `<style>` 블록이 아예 없다). 같은 이유로 `yona.code.Diff.js`의
   전역 클릭 델리게이트(`closest(".review-form")`)도 shadow 경계 문제 없이
   그대로 작동한다.
2. **벤더 에디터 강제 재마운트**(원본 `_remountEditor`가 매번 `cloneNode`로
   새 인스턴스를 만듦 - 벤더 에디터가 disconnected/reconnected를 재초기화하지
   않는 버그를 우회하기 위한 것)는 위젯 자체의 한계가 아니라 원본 vanilla
   에디터의 버그를 우회하려던 것이었다 - 이미 만든 `<yona-markdown-editor-vue>`로
   바꾸고 `:key`를 매 `show()`마다 바꿔주면(Vue가 알아서 완전히 새 인스턴스로
   교체) 이 트릭 자체가 필요 없어진다(GitHub 등처럼 "닫으면 초안을 버리고
   다음엔 깨끗하게 시작"하는 원본의 의도된 동작과도 정확히 일치한다).

트리거 로직(언제/어디에 뜰지 결정, 드래그 선택으로 blockInfo 계산)은
`yona.code.Diff.js`(861줄, diff 렌더링) 소유라 건드리지 않았다 - toast/dialog와
동일한 패턴으로 `show(target, options)/hide()/toggle()/isVisible()/height()/
offset()/configure()` 공개 계약만 그대로 유지한다. 첨부파일 업로드 폼은 이미
만든 `<yona-attachments>`를, 마크다운 에디터는 `<yona-markdown-editor-vue>`를
자식 컴포넌트로 그대로 조합해 재사용한다(여러 컴포넌트가 서로 통신/조합해도
된다는 판단 - Teleport 이동 후에도 자식들은 여전히 실제 `<form>`의 라이트 DOM
자손이라 `FormData`/제출에 정상적으로 포함된다).

**실대치 검증 중 발견한 진짜 버그 세 개(옆에 나란히 두는 비교로는 절대 안
드러남)**:
1. **`yona.css`의 `.review-form { display: none; }`**: 원본은 `_show()`에서
   `welCommentWrap.style.display = "block"`으로 이 전역 규칙을 인라인 스타일로
   덮어썼다 - Vue의 `v-if`만으로는 이 규칙을 이길 수 없다(엘리먼트 자체가
   DOM에서 사라졌다 나타날 뿐, CSS 클래스가 여전히 `display: none`이라 다시
   보이지 않는다). 폼이 실제로 diff 테이블에 삽입은 되는데 화면에 아예 안
   보이는 채로 처음 발견했다(Playwright의 "element is not visible" 타임아웃으로
   재현). 원본과 동일하게 인라인 `style="display: block"`을 그대로 재현해
   해결했다.
2. **`common/reviewForm.html`의 `th:fragment` 시그니처 유실**: 이 템플릿은
   `code/diff.html`이 `~{'common/reviewForm' :: reviewForm(project, resourceType,
   action)}`로 직접 참조하는 Thymeleaf 프래그먼트다 - 마크업을 `<yona-review-form>`
   태그로 교체하면서 원본 div에 있던 `th:fragment="reviewForm(project,
   resourceType, action)"` 속성을 옮기지 않으면 "template or fragment could not
   be resolved" 예외로 diff 페이지 자체가 렌더링 중 깨진다(로그인한 사용자만
   이 조건절을 타므로 익명 사용자로 확인하면 발견되지 않는다 - 실제로 이
   함정에 먼저 걸렸다). 새 루트 태그에 그대로 옮겨 해결.
3. **CSRF 히든 필드 누락**: 원본이 쓰던 `th:action="@{...}"` 폼은 Spring의
   `RequestDataValueProcessor` + thymeleaf-spring6의 `SpringActionTagProcessor`가
   `_csrf` 히든 필드를 자동으로 주입해준다(`layout.html`의 loginDialog 폼과
   동일한 메커니즘) - 이 컴포넌트는 순수 `:action` 바인딩이라 그 자동 주입을
   받지 못해 실제 폼 제출이 매번 403으로 거부됐다(Playwright로 실제 제출까지
   해봐야만 드러남 - 폼 자체는 정상으로 보인다). 서버가 렌더링 시점에 이미
   알고 있는 실제 토큰(`${_csrf.parameterName}`/`${_csrf.token}`)을
   avatarUrl/actionUrl과 동일하게 `data-csrf-param`/`data-csrf-token` 속성으로
   넘겨받아 히든 필드로 직접 재현해 해결했다.

**실대치 검증**: 실제 프로젝트를 만들고 실제 git 커밋 2개(파일 내용이 실제로
다른 diff)를 만든 뒤, 그 커밋의 실제 diff 페이지에서 실제 라인 번호를 클릭해
(`code/diff.html`의 실제 인라인 스크립트가 실제 `htBlockInfo`를 구성해
`show()`를 호출하는 경로) `<yona-review-form>`이 실제 `<tr class="comment-form">`
으로 정확히 teleport되는지, 실제 마크다운 에디터에 타이핑한 내용이 실제 폼
제출로 서버에 영속되는지(POST → 302 리다이렉트 → 새 댓글이 실제로 diff 페이지에
렌더링되고 사이드바 Review 카운트까지 갱신됨)까지 전부 실서버 화면에서
확인했다.

**하위 호환**: `yona.CodeCommentBox.js`도 하이브리드 어댑터로 다시 썼다 -
`#review-form` 컨테이너가 `<yona-review-form>`(태그명으로 판별)면
`show`/`hide`/`isVisible`/`height`/`offset`으로 위임하고, 그렇지 않으면 원본
vanilla 구현이 처리한다.

## pagination 위젯

`yona.Pagination.js`(`Pagination.update(elTarget, totalPages, options)`)를
다시 썼다. 게시글/이슈/PR/검색결과 등 12개 파일·18개 호출부에서 쓰이는,
이 세션에서 검토한 후보 중 실사용 빈도가 가장 높은 위젯이었다. 원본이
매 `update()` 호출마다 `target.innerHTML = ''`로 지우고 통째로 다시 그리던
stateless 구조라(toast와 같은 계열) `<Teleport>`도 라이트 DOM 탈출구도
필요 없었다 - Vue가 내부 reactive 상태로 선언적으로 다시 그리는 것으로
그대로 대응된다.

**순수 로직부터 TDD로 시작**: URL 파싱/페이지 번호 계산/입력값 보정을
`pagination.ts`로 뽑아 컴포넌트보다 먼저 테스트(`test/pagination.test.ts`,
18개)를 작성했다 - 원본의 미묘한 특성까지 그대로 검증한다: `rxDigit`
(`/^.[0-9]*$/`)은 주석("positive만 찾는다")과 달리 실제로는 "첫 글자는
아무거나 + 나머지는 전부 숫자"만 검사해 `"-5"`도 통과하고, `isNumeric`은
16진수/음수 문자열도 숫자로 판정한다(jQuery `$.isNumeric()`과 동일한
트릭) - 테스트 작성 중 처음 짠 검증 케이스(`"not-a-number"`가 에러를
던질 것)가 실제로는 틀렸다는 것도 이 과정에서 발견했다(rxDigit 자체가
막아 URL에서 다시 읽어오므로 에러 경로에 도달하지 않음 - `"x5"`처럼
rxDigit은 통과하지만 isNumeric은 실패하는 값이라야 실제로 에러가 난다).

**원본과 의도적으로 다른 점 두 가지(관찰 가능한 페이지 이동 동작은 동일,
순수 UX 정확성 개선)**:
1. 입력창 min/max 클램프를 원본은 `keydown`에서 처리해 실제로는 "한 타
   늦게"(막 입력된 글자가 반영되기 전 값을 검사) 동작했다 - `input`
   이벤트로 옮겨 실제 입력된 값을 즉시 보정한다.
2. 클릭 시 전체 선택(원본은 document 전역 델리게이트가
   `input[name="pageNum"]`을 하드코딩해 `paramNameForPage`를
   커스터마이즈한 4개 화면(`site/postList.html`의 `"page"` 등)에서는
   실행 경로 자체를 타지 못했다) - 인스턴스 자신의 클릭 핸들러로 처리해
   이름과 무관하게 항상 실행되게 했다. 단, 실측 확인 결과 `type="number"`
   입력창은 최신 브라우저에서 `.select()`/`selectionStart`가 전부
   무동작(null)이라(원본도 동일한 브라우저 플랫폼 제약을 겪는다) 시각적
   차이는 없고 "핸들러가 항상 걸린다"는 구조적 정확성만 개선됐다.

**실측 중 발견한 사소한 버그**: 선언되지 않은 host 속성(어댑터가 원본
`target`의 `id`를 그대로 복사해 넘기는 것 포함)을 Vue가 기본적으로
템플릿 루트까지 흘려보내는(attrs fallthrough) 바람에, host의
`id="pagination"`이 shadow DOM 내부 루트 div에도 그대로 복제됐다(동작에는
영향 없음 - shadow DOM은 별도 ID 스코프라 `document.getElementById`는
못 찾지만, shadow 관통 셀렉터를 쓰는 도구에는 불필요한 혼동을 준다).
`defineOptions({ inheritAttrs: false })`로 해결.

**실대치 검증**: 실제 프로젝트에 게시글 20개를 REST API로 만들어(페이지
크기 15 고정이라 2페이지 확보) 실제 게시글 목록(`{owner}/{project}/posts`)
에서 확인했다 - 1페이지에서 prev가 실제로 비활성(off) 마크업인지, 실제
"다음 페이지" 링크 클릭으로 실제 `pageNum=2` URL로 네비게이션되고 2페이지
(마지막)에서 next가 비활성되는지, 입력창에 값을 넣고 실제 Enter로 실제
1페이지로 복귀하는지까지 전부 실서버 화면에서 확인했다.

**하위 호환**: `yona.Pagination.js`도 하이브리드 어댑터로 다시 썼다 -
대상이 이미 `<yona-pagination>`이면 그대로, 아니면(그리고 커스텀
엘리먼트가 로드돼 있으면) idempotent하게 감싸서(Typeahead와 동일한
"기존 엘리먼트를 그 자리에서 감싼다" 패턴) `update()`로 위임하고,
그렇지 않으면 원본 vanilla 구현이 처리한다.

## login-dialog 위젯

`yona.LoginDialog.js`(`site/layout.html`의 익명 사용자용 `#loginDialog`,
네이티브 `<dialog>`)를 다시 썼다. `[data-login="required"]`가 붙은 트리거
6곳(로그인 링크, 댓글 작성 폼 등)에서 사이트 전역으로 뜬다.

**설계 결정 - review-form과 같은 이유로 `<Teleport to="body">`**: 이
다이얼로그는 review-form과 달리 다른 위치로 옮겨 다닐 필요가 없다(항상
화면 중앙 고정). 그런데도 Teleport를 그대로 썼다 - 이번엔 "동적 위치
이동"이 아니라 "CSS 포팅 회피" 목적이다. 원본 폼은 `.modal`(bootstrap.css)/
`.loginDialog`/`.login-form-wrap`/`.frm-wrap`/`.ybtn`/`.oauth-login-btn`/
`.auth-provider-logo`/`.yona-shake` 등 15개 이상의 전역 클래스에 기대는데,
Shadow DOM에 그대로 두면(Dialog/Toast/Switch처럼) 전부 이식해야 했다 -
Teleport로 옮기면 전역 yona.css/bootstrap.css를 그대로 상속받아 포팅이
전혀 필요 없다(review-form 이후 두 번째로 `<style>` 블록이 아예 없는
위젯). Teleport가 "다른 위치로 옮겨야 하는 위젯"뿐 아니라 "CSS를 그대로
상속받고 싶은 위젯" 일반에도 재사용 가능한 패턴임을 확인한 사례다.

**CSRF 재검증(이전 조사에서 review-form과 같은 403 함정을 예상했으나
실제로는 아니었다)**: 원본이 `th:action` 폼(Thymeleaf 자동 CSRF 히든
필드 주입)을 쓴 이유는 "익명 사용자에게 sitewide로 렌더링되는 유일한
순수 HTML action= 서버 렌더링 폼"이었기 때문이라고 원본 주석에 적혀
있지만, 실제 제출 로직(`_onSubmitForm`)은 네이티브 폼 제출이 아니라
`preventDefault()` 후 `fetch()`로 직접 POST한다 - `site/layout.html`의
전역 `window.fetch` 몽키패치(스크립트 로드 순서상 이 파일보다 먼저
실행됨)가 XSRF-TOKEN 쿠키를 X-XSRF-TOKEN 헤더로 이미 자동 첨부해주므로
CSRF 히든 필드 자체가 애초에 불필요했다 - 이 컴포넌트도 동일하게
`fetch()`로 제출하면 그만이라 review-form보다 오히려 쉬웠다.

**실측 중 발견한 진짜 버그(review-form의 `.review-form { display: none; }`
와 동일한 패턴)**: `yona.css`의 `.loginDialog .error { display: none; }`를
원본은 `showError()`에서 `elLoginError.style.display = "block"`으로
인라인 스타일로 직접 덮어썼다 - Vue의 `v-show`(보일 때 빈 값으로 되돌림)만
으로는 이 전역 규칙을 이기지 못해, 실대치 검증 중 실제 로그인 실패
시나리오에서 에러 메시지가 텍스트는 정확히 반영됐는데 화면에 전혀 안
보이는 채로 재현됐다(`getComputedStyle().display`가 `"none"`으로 확인).
`:style="{ display: errorVisible ? 'block' : 'none' }"`로 원본과 동일하게
인라인 강제해 해결했다.

**테스트 중 발견한 플랫폼 제약**: `document.location.reload`는 네이티브
메서드라 JS에서 재할당해도 조용히 무시되고 실제 리로드가 그대로 일어난다
(실측 확인) - 스모크 테스트에서 로그인 성공 케이스는 스텁으로 가로채는
대신 실제 페이지 리로드 발생 자체를 `waitForLoadState`로 검증하고, 요청
URL/헤더/바디 검증은 리로드가 없는 실패 시나리오 쪽에서 안전하게 했다.

**실대치 검증**: 실제 익명 세션에서 홈 화면의 실제 "Log in" 링크를 클릭해
다이얼로그가 실제 `document.body`의 라이트 DOM 자식으로 teleport되어
열리는지, 실제 틀린 비밀번호로 실제 서버 403 응답 + 실제 i18n 에러
메시지("Your log in ID, E-mail or password is not valid.") + 실제 shake
애니메이션이 재생되는지, 실제 올바른 비밀번호로 실제 로그인에 성공해
페이지가 실제로 리로드되고 로그인 상태로 전환되는지(로그인 후에는
`sec:authorize="isAnonymous()"`에 의해 `#loginDialog` 자체가 사라지는
것까지)를 전부 실서버 화면에서 스크린샷으로 확인했다.

**하위 호환**: `yona.LoginDialog.js`도 하이브리드 어댑터로 다시 썼다 -
`#loginDialog`가 `<yona-login-dialog>`(태그명으로 판별)면 트리거
델리게이트(`[data-login="required"]`)만 페이지 쪽에 남기고 `show(target)`
으로 위임하며(트리거가 입력창이면 blur하는 원본 정책도 위임 인자로
그대로 전달), 그렇지 않으면 원본 vanilla `_initElement`/`_attachEvent`
전체가 처리한다.

## scroll-elevator 위젯

`yona.ScrollElevator.js`(jquery.elevator.js를 대체한 vanilla 구현)를 다시
썼다. "맨 위로/맨 아래로 스크롤" 버튼으로, `board/view.html`/`issue/view.html`
2곳에서만 쓰인다(실사용 빈도는 낮지만 후보 조사에서 "서버 마크업 없이
완전히 자체 DOM을 생성해 body에 붙이고 `destroy()`까지 제공하는 가장 깨끗한
위젯 형태"로 꼽혔다).

**다른 위젯과 다른 점 - 감쌀 대상 엘리먼트가 아예 없다**: Pagination/
Typeahead는 서버가 미리 그려둔 컨테이너를 그 자리에서 감싸는 패턴이었는데,
이 위젯은 원본부터 `document.body.appendChild(container)`로 처음부터
DOM을 만들어 붙이는 구조라 감쌀 대상 자체가 없다 - 하이브리드 어댑터가
직접 `<yona-scroll-elevator>`를 만들어 body에 추가하는 방식으로 대응했다.

**`<Teleport to="body">` 사용 이유(review-form/login-dialog와 같은 이유 -
CSS 포팅 회피)**: 이 위젯의 스타일은 전부 `jquery.elevator.css`(413줄,
`board/view.html`/`issue/view.html`이 각자 `<link>`로 로드하는 서드파티
플러그인 CSS - yona.css가 아니다)에 있다. Shadow DOM에 그대로 두면(Toast
처럼) 이 CSS 전체를 이식해야 했다 - Teleport로 옮기면 host 페이지가 이미
로드해둔 `jquery.elevator.css`를 그대로 상속받아 포팅이 전혀 필요 없다.
원본도 어차피 body에 직접 append하던 위젯이라 위치상 손실도 없다.

**공개 계약**: 원본의 `{destroy: fn}` 리턴값 계약을 그대로 유지한다 -
컴포넌트 자신의 `destroy()`는 스크롤 리스너 해제만 담당하고(Vue의
`onUnmounted`와 대칭), 어댑터가 반환하는 `destroy`는 그 위에 host
엘리먼트 자체를 `remove()`해 원본처럼 완전히 흔적 없이 사라지게 한다.

**실대치 검증**: 실제 프로젝트에 실제 게시글을 하나 작성해 실제
`board/view.html`에서 확인했다 - 실제 `shape: 'rounded', glass: true`
옵션이 클래스에 반영되는지, 실제 클릭으로 실제 페이지 최하단/최상단까지
스크롤되는지까지 전부 실서버 화면에서 스크린샷으로 확인했다(우측 하단에
glass 스타일 버튼이 원본과 동일하게 렌더링됨).

**하위 호환**: `yona.ScrollElevator.js`도 하이브리드 어댑터로 다시 썼다 -
커스텀 엘리먼트가 로드돼 있으면 `<yona-scroll-elevator>`를 만들어 옵션을
data-*로 넘기고 body에 추가한 뒤 `{destroy}`를 반환하며, 그렇지 않으면
원본 vanilla 구현이 처리한다.

## page-slide 위젯

`yona.twoColumnMode.js`(service/)의 `_pageslide*` 함수군(jquery.pageslide.js를
대체한 vanilla 구현)만 뽑아 다시 썼다 - 게시판/이슈 "2단 보기" 모드에서 제목을
클릭하면 화면 오른쪽에서 슬라이드해 들어오는 iframe 패널이다.

**범위 - 같은 파일의 나머지는 옮기지 않는다**: `yona.twoColumnMode.js`는 이
패널 외에도 2단 보기 체크박스 상태 저장(localStorage), 제목 클릭 델리게이트
부착, 클릭한 게시글 하이라이트, `history.pushState` 연동, NProgress 호출까지
한 파일에 다 있다 - 이건 "2단 보기"라는 페이지 기능 자체의 오케스트레이션이지
패널 위젯의 일부가 아니다(review-form에서 트리거 로직을 `yona.code.Diff.js`에
그대로 남겨둔 것과 동일한 경계 판단). 이 컴포넌트는 패널 자체
(`show`/`hide`/`isVisible`)만 담당하고, 나머지는 어댑터(페이지 쪽 vanilla
코드)가 그대로 소유한다.

**CSS를 이식하지 않고 인라인 스타일로 직접 재현**: 원본은 `#pageslide`라는
id 선택자로 yona.css에 딱 한 번 정의된 스타일(position:fixed/width:50%/
box-shadow/배경 로딩 gif)을 쓴다. 규칙이 딱 하나뿐이라 포팅보다 인라인
`:style`로 값을 그대로 재현하는 편이 더 간단해 별도 `<style>` 블록이 없다.

**실측 중 발견한 진짜 함정 - "하위 호환 id"가 오히려 버그였다**: 처음엔
review-form/login-dialog처럼 원본 `document.getElementById("pageslide")`
호환을 위해 Vue 컴포넌트의 host에도 그대로 `id="pageslide"`를 줬다 - 그런데
yona.css의 전역 `#pageslide { display: none; ... }` 규칙이 id 선택자로
**host 자체**에 그대로 적용돼(컴포넌트 내부에서 인라인 스타일을 아무리
재현해도 host 자신이 그 id로 display:none이 되면 shadow 트리 전체가
렌더링 자체가 안 된다) 기능은 다 동작하는데(`isVisible()` true, iframe src
정상) 화면에는 전혀 안 보이는 채로 실측 중 재현됐다. `display: contents`로
host를 덮어써도 Vue가 host의 style 속성 변경을 감지해 class/style을 안쪽
엘리먼트와 병합해버리는(`inheritAttrs`와 별개로 항상 병합 대상) 2차 문제까지
있었다 - 근본 해결은 컴포넌트를 고치는 게 아니라 **애초에 host에 그 id를
주지 않는 것**이었다. 이 위젯은 `document.getElementById`가 다른 파일에서
전혀 참조되지 않는(같은 파일 안 2곳뿐) 완전히 내부적인 상태라, 어댑터가
DOM id 대신 클로저 변수(`_pageslideVueEl`)로 엘리먼트를 직접 캐싱하도록
바꿔 충돌 자체를 없앴다.

**실대치 검증**: 실제 프로젝트에 게시글 2개를 만들어 실제 `board/list.html`
에서 확인했다 - 실제 "2단 보기" 체크박스를 켜고 실제 게시글 제목을 클릭하면
실제 패널이 화면 우측 절반에 열리고 실제 게시글 URL로 iframe이 채워지는지,
실제 브라우저 URL이 `history.pushState`로 바뀌는지, 같은 제목 재클릭으로
실제 토글되어 닫히는지, 다른 제목 클릭으로 실제로 다시 열리며 iframe이
갱신되는지까지 전부 실서버 화면에서 스크린샷으로 확인했다(패널이 열리면
화면 우측 절반을 실제로 덮는 것도 원본과 동일하게 재현됨 - 재클릭 검증 시
가려지지 않은 좌측 부분을 클릭해야 했던 것도 원본과 동일한 실제 레이아웃
특성).

**하위 호환**: `yona.twoColumnMode.js`도 하이브리드 어댑터로 다시 썼다 -
`_getPageslideElement`/`_isPageslideVisible`/`_pageslideOpen`/`_pageslideClose`가
커스텀 엘리먼트 존재 여부로 분기해 `show`/`hide`/`isVisible`로 위임하고,
`.left-menu` 복원처럼 위젯이 모르는 페이지 고유 관심사는 어댑터 쪽에
그대로 남겼다.

## 진짜로 여기서 마감한 후보들

열세 위젯(에디터/도움말/토스트/스위치/드롭다운/다이얼로그/타입어헤드/
어태치먼트/review-form/pagination/login-dialog/scroll-elevator/page-slide)을
거치며 배운 것: "위젯 경계가 없다"는 판단은 거의 항상 검증 부족이었다 -
Dialog/Dropdown/Typeahead/Attachments/review-form 다섯 다 처음엔 이
목록에 있었지만 전부 실제로 구현·실대치 검증까지 마쳤다(pagination/
login-dialog/scroll-elevator/page-slide는 처음부터 위젯 경계가 명확해 이
목록에 있던 적이 없다). 아래는 그중 실제로 조사해도 위젯 경계 자체가
없거나(Tabs/Mergely는 아예 죽은 코드) 자체 템플릿이 없는(Calendar/TomSelect)
`yona.ui.*` 계열 경우만 남았다.

**`common/`/`service/` 전체(77개 파일)를 대상으로 한 최신 전수조사**는
[docs/widget-candidates.md](docs/widget-candidates.md)에 별도로 정리했다 -
LoginDialog/ScrollElevator/Tooltip·Popover 시스템/Label 관리 패널/PageSlide
오버레이 등 아직 착수하지 않은 후보와 우선순위, 그리고 신규 위젯이 아니라
"이미 이식된 위젯을 확장/재사용해야 하는" 통합 기회까지 담겨 있다. 아래
목록은 그 문서가 나오기 전, `yona.ui.*` 네임스페이스만 좁게 조사했던 결과다.

- **`yona.ui.Tabs.js`**: 유일한 동작인 `_restoreTab()`이 legacy 버그(`"toggle" ==
  "tab"`가 항상 false로 평가됨, v1.6부터 그대로)로 처음부터 완전한 no-op이다 -
  포팅할 실제 로직이 없다.
- **`yona.ui.Calendar.js`/`yona.ui.TomSelect.js`**: 각각 Flatpickr/Tom Select라는
  서드파티 라이브러리의 얇은 설정 래퍼일 뿐, Vue가 선언적으로 다시 그릴 자체
  템플릿이 없다(실제 위젯 UI는 라이브러리가 `document.body`에 직접 그린다).
- **`yona.ui.Mergely.js`**: 파일 자체 헤더 주석에 명시된 완전한 죽은 코드다 -
  인스턴스화 호출 0건, 대상 마크업(`#compare`/`#mergely`) 0건, 심지어 의존 라이브러리
  (`$.fn.mergely`)조차 저장소에 존재하지 않는다.

## (지난 판단 기록) Dialog/Dropdown/Typeahead/review-form도 한때 "마감 후보"였다

`yona.ui.Dialog.js`/`yona.ui.Dropdown.js`/`yona.ui.Typeahead.js`/
`yona.CodeCommentBox.js`는 처음엔 마감 목록에 넣었었다(전역 버튼 CSS 클래스/
전역 dropdown 델리게이트/정적 템플릿 부재/diff 뷰 결합 DOM 재배치 문제) -
하지만 넷 다 스위치/에디터에서 이미 검증한 "열린 부분은 라이트 DOM에 남기고
Vue는 얇은 행동 레이어만 맡는다"는 탈출구(review-form은 `<Teleport>`)로
풀리는 문제였다. 넷 다 위 각 위젯 절에서 실제로 구현·실대치 검증까지
마쳤다 - 이 시점에서 확인 가능한 `yona.ui.*`/`yona.CodeCommentBox.js` 위젯
후보는 모두 소진했다.

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
npm run build:elements  # 열세 위젯을 <yona-markdown-editor-vue>/<yona-help-markdown>/
                         # <yona-toast>/<yona-switch>/<yona-dropdown>/<yona-dialog>/
                         # <yona-typeahead>/<yona-attachments>/<yona-review-form>/
                         # <yona-pagination>/<yona-login-dialog>/<yona-scroll-elevator>/
                         # <yona-page-slide> 네이티브 커스텀 엘리먼트로 한 번에
                         # (dist-element/, es 모듈 포맷 - 엔트리 13개 + 위젯들이
                         # 공유하는 청크 - 청크 파일명은 빌드마다 바뀔 수 있다)
npm run typecheck
```

## yona에 실제로 꽂아 쓰려면

`npm run build:elements`가 만든 `dist-element/` 안의 파일 **전부**(엔트리 13개
`yona-markdown-editor-vue-element.js`/`yona-help-markdown-element.js`/
`yona-toast-element.js`/`yona-switch-element.js`/`yona-dropdown-element.js`/
`yona-dialog-element.js`/`yona-typeahead-element.js`/`yona-attachments-element.js`/
`yona-review-form-element.js`/`yona-pagination-element.js`/
`yona-login-dialog-element.js`/`yona-scroll-elevator-element.js`/
`yona-page-slide-element.js` + 공유 청크 - 엔트리들이 상대 경로 `import`로
참조하므로 같은 디렉터리에 같이 있어야 한다)를 yona 저장소에 vendoring하고,
템플릿에 해당 태그(`<yona-markdown-editor-vue>`/`<yona-help-markdown>`/
`<yona-toast>`/`<yona-switch>`/`<yona-dropdown>`/`<yona-dialog>`/
`<yona-typeahead>`/`<yona-attachments>`/`<yona-review-form>`/`<yona-pagination>`/
`<yona-login-dialog>`/`<yona-scroll-elevator>` - 단, `<yona-typeahead>`는 정적
템플릿에 직접 쓰지 않고 `yona.ui.Typeahead.js` 어댑터가, `<yona-pagination>`도
정적 템플릿에 쓰지 않고 `yona.Pagination.js` 어댑터가 기존
`<div id="pagination">`을 그 자리에서 감싸며, `<yona-scroll-elevator>`/
`<yona-page-slide>`도 정적 템플릿에 쓰지 않고 각각 `yona.ScrollElevator.js`/
`yona.twoColumnMode.js` 어댑터가 직접 만들어 붙인다)와
**`<script type="module">`**을 넣으면 됩니다(각 위젯
구현의 세부 props/계약은 git 이력의 개별 README 및 이 파일의 각 위젯 절 참고).
커스텀 엘리먼트들은 서로 무관하므로 일부만 먼저 반영해도 문제 없습니다 - 공유
청크만 같이 복사하면 됩니다.

**주의**: 도움말 패널의 `markdownImages` 예시가 실제 yona 정적 에셋
(`/assets/images/ico-like-small.png`)을 가리킵니다 - 이 저장소를 격리 실행(개발
서버/스모크 테스트)할 때는 그 이미지가 404가 나는 게 정상이며, yona에 실제로
vendoring됐을 때만 정상 표시됩니다.

## 테스트

```
npm run test
```

다섯 위젯의 순수 함수 단위 테스트(에디터 46개 + 도움말 패널 3개 + 토스트 4개 +
pagination 20개 = 73개 - 스위치/드롭다운/다이얼로그/타입어헤드/어태치먼트/
review-form은 라이트 DOM 조작이나 DOM 생성/Teleport 자체가 핵심이라 순수
함수로 뽑을 로직이 마땅치 않아 전부 스모크 테스트로만 검증)를 esbuild로
트랜스파일한 뒤 `node --test`로 한 번에 실행합니다. pagination은 이 다섯
중 유일하게 컴포넌트보다 순수 함수(`pagination.ts`) 테스트를 먼저 작성한
뒤 구현한 위젯이다(TDD) - 테스트를 먼저 쓰는 과정에서 원본 정규식의 실제
동작(주석과 다름)을 미리 검증 케이스로 못박아 두게 됐다.

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
- `dialog-element.mjs`: `dist-element/yona-dialog-element.js`를 정적 HTML
  (`dialog-element.html`, `<script type="module">`)에 로드해 (a) 버튼 지정 없는
  기본(alert) `show()`가 기본 확인 버튼 1개를 라이트 DOM에 만드는지, (b) 메시지
  개행이 `<br>`로 변환되는지, (c) 커스텀 버튼(라벨/스타일) `show()`가 정확한
  클래스/라벨로 버튼을 만드는지, (d) 버튼 클릭 시 `fOnClickButton` 콜백이 정확한
  `nButtonIndex`로 호출되고 `false` 반환 시 안 닫히는지, (e) X 닫기 버튼/배경
  클릭으로도 닫히는지 확인.
- `typeahead-element.mjs`: `dist-element/yona-typeahead-element.js`를 정적 HTML
  (`typeahead-element.html`, `<script type="module">` + `configure()` 호출)에
  로드해 (a) 입력 필드가 document 레벨에서 여전히 검색 가능한지, (b) 타이핑 시
  필터링/정렬/하이라이트가 정확한지, (c) 화살표 키로 활성 항목이 이동하는지,
  (d) Enter/클릭으로 선택 시 입력값이 반영되고 실제 `change` 이벤트가 발생하는지,
  (e) ESC로 메뉴가 닫히는지 확인.
- `attachments-element.mjs`: `dist-element/yona-attachments-element.js`를 정적
  HTML(`attachments-element.html`, `<script type="module">` + `configure()`
  호출)에 로드해 (a) 실제 파일 업로드(모킹된 `/files` 응답) 후 카드가 complete
  상태가 되는지, (b) hidden input에 실제 id가 반영되는지, (c) 카드 클릭 시
  실제 마크다운 링크가 외부 textarea에 삽입되는지, (d) 삭제 버튼 클릭 시 실제
  삭제 요청이 발생하고 카드/링크/hidden input이 정리되는지, (e) **외부
  textarea에 직접 붙여넣기했을 때** 실제로 업로드가 트리거되는지(실대치에서
  발견한 리스너 위치 버그의 회귀 방지) 확인.
- `review-form-element.mjs`: `dist-element/yona-review-form-element.js`를 정적
  HTML(`review-form-element.html`, `<script type="module">` + `data-*` 속성)에
  로드해 (a) 새 범위/라인 댓글용 임시 `<tr class="comment-form">`가 실제로
  생성되고 라이트 DOM으로 teleport되는지, (b) top/bottom 배치에 따른 화살표
  클래스가 맞는지, (c) blockInfo → hidden 필드 변환(`aBlockWords` 제외 포함)이
  정확한지, (d) 자식으로 넣은 에디터/첨부파일 위젯이 실제로 렌더링되는지,
  (e) 기존 스레드로의 답글(`data-thread-id`)이 `.comment-thread-wrap`으로
  정확히 teleport되는지(Teleport가 다음 reactive tick에 렌더링하는 타이밍
  고려), (f) `show()`를 반복 호출해도 매번 완전히 새 에디터 인스턴스로
  교체되는지(초안 미유지 확인), (g) `hide()` 시 새로 만든 임시 `<tr>`만
  제거되고 기존 스레드 wrap은 유지되는지, (h) `toggle()`/닫기 버튼 클릭까지
  공개 API 전체 확인.
- `pagination-element.mjs`: `dist-element/yona-pagination-element.js`를 정적
  HTML(`pagination-element.html`, `<script type="module">`)에 로드해 (a)
  `update(totalPages, options)` 렌더링(입력값/파라미터명/총 페이지 수 표시),
  (b) current가 firstPage/totalPages와 같을 때 prev/next가 각각 자동으로
  off 마크업이 되는지, (c) `paramNameForPage` 커스텀이 input name에 반영되고
  클릭 핸들러도 이름과 무관하게 실행되는지, (d) 입력값이 min/max를 벗어나면
  즉시 보정되는지, (e) `submit` 콜백 모드에서 prev/next 클릭·입력 시 실제
  네비게이션 없이 콜백만 호출되는지, (f) 동기 모드에서 실제로 next 링크
  클릭/입력 후 Enter로 실제 브라우저 URL이 `pageNum` 파라미터와 함께
  네비게이션되는지(모킹 없이 real navigation) 확인.
- `login-dialog-element.mjs`: `dist-element/yona-login-dialog-element.js`를 정적
  HTML(`login-dialog-element.html`, `<script type="module">` + `[data-login="required"]`
  트리거)에 로드해 (a) `<Teleport to="body">`로 `<dialog>`가 실제 body 직계
  자식이 되고 shadow DOM 안에는 없는지, (b) `show()` 재호출 시 이전 입력값이
  초기화되고 Messages()로 실제 i18n 라벨이 반영되는지, (c) 트리거가 입력창/
  텍스트영역이면 `show()` 호출로 실제 blur되는지, (d) 배경 클릭·X 닫기 버튼
  클릭으로 실제 닫히는지, (e) `useSocialLoginOnly=true`면 로컬 로그인 필드
  대신 경고 문구만 보이는지, (f) 실제 `fetch()` 제출이 네트워크 에러/서버
  JSON 에러 메시지(Messages()로 변환)/성공(실제 페이지 리로드) 세 경로 모두
  올바르게 동작하는지(성공 케이스는 `document.location.reload`를 JS로 가로챌
  수 없다는 실측 결과에 따라 실제 리로드 발생 자체를 확인) 확인.
- `scroll-elevator-element.mjs`: `dist-element/yona-scroll-elevator-element.js`를
  정적 HTML(`scroll-elevator-element.html`, `<script type="module">` +
  `data-*` 옵션)에 로드해 (a) `<Teleport to="body">`로 실제 body 직계 자식이
  되는지, (b) `data-shape`/`data-glass`/기본 `align`이 클래스에 정확히
  반영되는지, (c) 실제 스크롤 위치(최상단/중간/최하단)에 따라 위아래 버튼
  크기 클래스(jq-sml/jq-mid/jq-big)가 정확히 전환되는지, (d) 실제 클릭으로
  실제 페이지가 최상단/최하단까지 스크롤되는지(모킹 없이 real scroll), (e)
  `tooltips` 옵션에 따라 `title` 속성/내부 span 중 올바른 방식으로 표시되는지,
  (f) `destroy()` 호출 + host 제거로 실제로 완전히 사라지는지 확인.
- `page-slide-element.mjs`: `dist-element/yona-page-slide-element.js`를 정적
  HTML(`page-slide-element.html`, `<script type="module">`)에 로드해 (a)
  `show(href, direction)` 호출 즉시 `isVisible()`이 true가 되지만 iframe은
  아직 없고(300ms 지연 재현) 그 뒤 실제로 채워지는지, (b) `direction`에 따라
  `left`/`right` 배치가 정확한지, (c) `hide()`로 실제로 사라지는지, (d) 지연
  중 `hide()`하면 타이머가 취소돼 iframe이 끝내 안 채워지는지, (e) 이미 열린
  상태에서 재호출하면 이전 iframe이 즉시 제거되고 새 iframe이 새 src로
  채워지는지 확인.

`*-element.mjs` 열세 개는 `npm run build:elements`를 먼저 실행해야 합니다. 또한 es 모듈
포맷이라 `element.html`을 `file://`로 직접 열면 module script의 상대 임포트(공유 청크)가
CORS로 막힙니다(실측 확인) - 그래서 세 스크립트 다 Vite 개발 서버로 `dist-element/`가
포함된 프로젝트 루트를 잠깐 정적 서빙한 뒤 `http://localhost:<port>/smoke-test/
*-element.html`로 접속합니다(빌드/변환 없이 있는 그대로 서빙 - `npm run dev`와 달리
HMR 클라이언트가 끼어들지 않음).
