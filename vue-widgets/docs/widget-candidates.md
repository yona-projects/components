# 위젯 전환 후보 전수조사 (2026-09-15)

`src/main/resources/static/javascripts/`의 `common/`(33개 파일) + `service/`(44개 파일),
총 77개 JS 파일을 전부 다시 읽고 grep으로 실사용처를 확인해 Vue 3 SFC 위젯 전환 후보를
재조사한 결과다. common/은 이 세션에서 두 번째 전수조사(첫 조사에서 놓친 Tooltip/Popover
시스템을 새로 발견), service/는 이번이 첫 조사다.

**이미 이식 완료(11개, 별도 문서화 안 함 - `../README.md` 참고)**: 마크다운 에디터, 도움말
패널, 토스트(`yona.ui.Toast.js`), 스위치(`yona.ui.Switch.js`), 드롭다운(`yona.ui.Dropdown.js`),
다이얼로그(`yona.ui.Dialog.js`), 타입어헤드(`yona.ui.Typeahead.js`), 첨부파일
(`yona.Attachments.js`), review-form(`yona.CodeCommentBox.js`), pagination
(`yona.Pagination.js`), **login-dialog(`yona.LoginDialog.js`, 2026-09-15 완료 - 아래
1번이었던 항목)**.

## 진짜 위젯 후보 (권장 착수 순서)

착수 난이도가 낮고 리스크가 명확한 것부터 나열했다 - 반드시 이 순서를 지킬 필요는 없지만,
지금까지 이 세션에서 "쉬운 것부터 실전 감각을 쌓고 review-form처럼 큰 것에 도전" 해온
패턴과 맞는다.

### ~~1. `yona.LoginDialog.js`~~ — 이식 완료(`../README.md`의 "login-dialog 위젯" 절 참고)

실제로는 예상보다 쉬웠다(CSRF 재검증 결과 review-form과 같은 403 함정이 없었음이 확인됨) -
대신 review-form의 `.review-form { display: none; }`와 똑같은 패턴의 버그
(`.loginDialog .error { display: none; }`를 `v-show`만으로는 못 이김)를 실측 중 새로
발견해 고쳤다. 자세한 내용은 README 참고.

### 2. `yona.ScrollElevator.js` (154줄) — 난이도 낮음

서버 마크업 없이 완전히 자체 DOM을 생성해 `document.body`에 붙이고 `destroy()`까지
제공하는 가장 깨끗한 위젯 형태(Toast와 동일한 프로그래밍적 마운트 패턴). 외부 의존
없음. 실사용은 `board/view.html`/`issue/view.html` 2곳뿐이라 재사용 이득은 크지 않지만,
포팅 자체는 이 목록에서 가장 빠르게 끝낼 수 있다.

### 3. PageSlide 오버레이 패널 — `yona.twoColumnMode.js`의 `_pageslide*` 함수군(약 90줄) — 난이도 낮음-중간

`#pageslide`를 프로그래밍적으로 생성해 `document.body`에 붙이고(Toast와 동일 패턴),
iframe으로 URL을 로드하며 좌/우 슬라이드 인/아웃, 같은 항목 재클릭 시 토글-닫기,
`history.pushState` 연동까지 갖춘 독립 위젯이다. 게시판/이슈 목록의 "2열 모드"(제목
클릭 시 미리보기)에서 쓰인다. Shadow DOM 충돌 거의 없음(body-append 오버레이).

주의: 같은 파일 안의 나머지 로직(체크박스 상태 저장, 하이라이트 등)은 순수 페이지
글루라 `_pageslide*` 부분만 분리 이식해야 한다 - 파일 전체를 위젯으로 보면 안 된다.

### 4. Tooltip/Popover 플로팅 위치 시스템 — `yona.Common.js`(신규 발견, 이전 조사에서 "기반
유틸리티"로 뭉뚱그려졌던 부분) — 난이도 중간-높음, 그러나 사용 빈도 압도적

`showTooltip`/`hideTooltip`(954·978행), `showPopoverError`/`hidePopoverError`
(1005·1019행), `initHoverPopovers`(863행) — 각각 자체 DOM(`.tooltip`/`.popover` div)을
생성해 `document.body`(또는 `_getPopoverContainer`)에 붙이고 위치 계산까지 하는 완결된
show/hide 계약이다. 세 계약이 내부적으로 같은 위치계산 함수(`_positionPopoverElement`/
`_getPopoverContainer`)를 공유한다는 주석까지 확인돼, 하나의 "플로팅 포지션 요소" 위젯
패밀리로 통합 이식할 수 있다.

실사용(재확인 완료):
- `showTooltip`/`hideTooltip`: `layout.html`이 전역 위임으로 바인딩, `data-toggle="tooltip"`
  실사용 **30개 템플릿**(`grep -rl` 재확인 완료).
- `showPopoverError`/`hidePopoverError`: 실사용 5개 서비스 파일(`yona.user.Setting.js`,
  `yona.resetPassword.js`, `yona.project.New.js`, `yona.issue.LabelEditor.js`,
  `yona.user.SignUp.js`) - 폼 검증 에러 표시.
- `initHoverPopovers`: 실사용 3곳(`index.html`, `code/view.html`, `site/layout_framed.html`).

Shadow DOM 충돌 지점: tooltip/hover popover는 Dropdown처럼 **전역 델리게이트가 트리거를
소유**(개별 컴포넌트가 아니라 `data-toggle`/`data-content` 속성을 스캔) + `data-html="true"`인
경우 임의 HTML을 신뢰해야 한다(Dialog의 "임의 버튼 클래스"와 같은 유형의 라이트 DOM
이슈). `showPopoverError`는 반대로 호출부가 직접 명시적으로 부르는 단순 계약이라 더
쉽다 - 셋을 한 번에 묶기보다 `showPopoverError`부터 먼저 떼어내는 것도 방법이다.

### 5. Label 관리 패널 — `yona.issue.LabelEditor.js`(980줄, 44개 함수) — 난이도 높음(review-form급)

`issue/labelsform` 전용 페이지(카테고리·라벨 CRUD)의 전체 구현. 실제 위젯 경계(재확인
완료):
- 새 라벨 추가 폼(색상 프리셋 버튼 + hex 입력 실시간 검증/미리보기)
- 카테고리 편집/라벨 편집용 **네이티브 `<dialog>` 2개**(`elements.editCategoryForm.showModal()`
  779행, `elements.editLabelForm.showModal()` 840행, `$yona.attachDialogDismiss` 사용 -
  이미 이식된 Dialog와 같은 기반)
- 서버 렌더 목록에 대한 delete/edit 위임 클릭, 카테고리 자동완성은 이미 이식된 Typeahead
  재사용 가능

페이지 전용이지만 후보로 볼 가치가 있는 이유는 재사용성이 아니라 **복잡도/버그 위험**
이다 - jQuery `.data()` 자동 타입변환을 직접 재현하는 헬퍼, `.submit()` 호출이 실제로는
`"submit"` 이벤트를 재발생시키는 데 의존하는 재귀 제출 설계 등 미묘한 버그를 이미 안고
있어 선언적 재작성의 이득이 크다.

부속 후보: `yona.project.Home.js` 330~603행(~270줄)의 **프로젝트 홈 인라인 Label Board**
는 서버 마크업 없이 클라이언트가 처음부터 DOM을 생성하는 미니 버전으로 기능이 겹친다 -
별도 포팅보다는 이 위젯을 만들 때 공유 가능한 하위 컴포넌트로 함께 설계하는 편이 낫다
(단독 우선순위 없음).

## 새 포팅 대상은 아니지만 조치 가치가 있는 발견

새 위젯을 만드는 게 아니라 **이미 이식된 위젯을 확장/재사용하거나 검증을 보강**해야
하는 항목들이다.

1. **`yona.CommentAttachmentsUpdate.js`(240줄)를 `<yona-attachments>`로 흡수**: 댓글
   수정 폼(`common/commentUpdateForm.html`, `board/view.html`/`issue/view.html`/
   `common/attachmentFile.html`/`site/layout.html`에서 실사용)의 드롭존/업로드/삭제/
   드래그앤드롭/붙여넣기 로직이 이미 이식된 `yona.Attachments.js`와 사실상 동일한데
   마크업 계약만 다르다(`.attached-file-marker`/`.textarea-box`/`.file-upload__input`
   vs `<yona-attachments>`가 기대하는 `common/uploadForm.html` 계약). 새 위젯 설계가
   아니라 **기존 컴포넌트가 이 마크업 계약까지 흡수하도록 확장하는 통합 작업**.
2. **`yona.code.SvnDiff.js`가 `<yona-review-form>`을 안 쓰고 있음**: `_showCommentBox`/
   `_hideCommentBox`(359~451행)가 이미 이식된 review-form을 재사용하지 않고 자체
   댓글박스 이동 로직을 따로 구현 중이다. 신규 포팅이 아니라 **기존 위젯으로 갈아끼우는
   확장 작업**.
3. **`<yona-typeahead>` 호환성 재검증 필요**: `organization.Member.js`/`project.Member.js`
   둘 다 `new yona.ui.Typeahead(...)`에 **커스텀 `render` 콜백**을 넘겨 메뉴 템플릿을
   완전히 교체한다 - README가 전제하는 "메뉴는 항상 같은 모양(닫힌 계약)이라 안전하다"는
   가정과 충돌할 수 있다. 실제 화면(`organization/members`, `project/members`)에서
   재검증 권장 - 이미 배포된 위젯의 숨은 사용 패턴이라 우선순위 높음.
4. **체크박스로 게이트된 confirm `<dialog>` 패턴**이 `project.Delete/Transfer/ChangeVCS.js`
   + `organization.View.js` 4곳에서 거의 동일하게 반복된다(`showModal()` +
   `$yona.attachDialogDismiss`). 규모가 작아 우선순위는 낮지만 원하면 작은 공용
   컴포넌트로 통합 가능.
5. **`yona.Markdown.js` 자체 주석 오류 발견(참고용, 조치 불필요)**: 파일 주석에 "`_tab`/
   `_untab`이 어디에도 정의 안 됨"이라 적혀 있으나, 실제로는 `yona.KeyControl.js`가 같은
   전역 네임스페이스에 별도로 정의하므로 **주석이 틀렸을 뿐 기능은 정상 동작**한다 -
   죽은 코드가 아니다.

## 후보 아님 (재검증 완료)

**common/ (죽은 코드, grep으로 확인)**: `yona.Comment.js`(파일 자체 주석 + grep 0건),
`yona.ui.Mergely.js`(`Mergely|#compare|#mergely` 0건), `yona.ui.Tabs.js`(실사용 0건).

**common/ (서드파티 얇은 래퍼, 자체 템플릿 없음)**: `yona.ui.Calendar.js`(Flatpickr),
`yona.ui.TomSelect.js`(Tom Select, 17개 템플릿·33곳), `yona.TitleHeadAutoCompletion.js`
(Tribute.js).

**common/ (기존 마크업에 위임하는 이벤트 배선, 자체 컨테이너 없음)**:
`yona.CodeCommentBlock.js`(529줄, `yona.code.Diff.js` 소유 드래그선택 좌표계산),
`yona.CommentForm.js`, `yona.SubComment.js`, `yona.Subtask.js`, `yona.Tasklist.js`,
`yona.OriginalMessage.js`, `yona.ReceiverList.js`, `yona.WatcherList.js`,
`yona.Usermenu.js`(351줄, 사이드바 전체에 흩뿌려진 레이아웃 결합).

**common/ (기반 유틸리티, 위젯 아님)**: `yona.Files.js`(918줄, 업로드 엔진 - Attachments가
재사용), `yona.Interval.js`, `yona.KeyControl.js`, `yona.ShortcutKey.js`, `yona.Sha1.js`.

**service/ (순수 페이지 글루 - 폼 검증/필드 연동/이미 이식된 위젯 초기화뿐)**:
`showSubtask`, `temporarySaveHandler`, `detectChange`, `project.Fork/Webhook/Transfer/
Delete/ChangeVCS/Global/Setting/New`, `organization.Global/New/Setting/View/Member`,
`resetPassword`, `user.SignUp/View/Setting`(아바타 크로퍼는 Cropper.js 얇은 래퍼),
`board.List/Write/View`, `review.List`, `milestone.View/Write`, `issue.Write/List/
MassUpdate/Assginee/Sharer/View`, `pullrequest.View/Write`, `site.MassMail`,
`code.Nohead/Browser`(ACE 얇은 래퍼).

**범위 밖**: `yona.Migration.js`(1565줄) - 완전히 별도인 레거시 AngularJS 번들(GitHub
import 도구), 이 프로젝트의 Vue 위젯 스코프와 무관.

**결합도가 높아 위젯으로 분리하기 어려움**: `issue.List.js`(495줄), `issue.View.js`
(702줄, pjax/타임라인 폴링/hash 라우팅), `code.Diff.js`(861줄, 이미 review-form 소유),
`code.SvnDiff.js`(708줄, 위 3번 확장기회 부분 제외).

## 조사 방법

`common/`과 `service/`를 각각 별도 조사로 나눠, 77개 파일 전부를 직접 읽고(Read 도구)
grep으로 실사용처(호출 횟수/템플릿 개수)를 확인한 뒤 종합했다. "페이지 전용/위젯
경계 없다"는 결론은 실제로 코드를 읽어 자체 렌더링 컨테이너와 show/hide류 공개
계약의 유무를 확인한 뒤에만 내렸다 - Dialog/Dropdown/Typeahead/Attachments/review-form
전부 처음엔 "위젯 경계가 없다"고 오판했다가 다시 쪼개서 뒤집힌 전례가 있어, 이번
조사에서는 특히 이전에 "후보 아님"으로 뭉뚱그렸던 항목들을 더 의심하고 재검토했다
(그 결과 Tooltip/Popover 시스템을 새로 찾아냈다).
