# 위젯 전환 후보 전수조사 (2026-09-15)

`src/main/resources/static/javascripts/`의 `common/`(33개 파일) + `service/`(44개 파일),
총 77개 JS 파일을 전부 다시 읽고 grep으로 실사용처를 확인해 Vue 3 SFC 위젯 전환 후보를
재조사한 결과다. common/은 이 세션에서 두 번째 전수조사(첫 조사에서 놓친 Tooltip/Popover
시스템을 새로 발견), service/는 이번이 첫 조사다.

**이미 이식 완료(17개, 별도 문서화 안 함 - `../README.md` 참고)**: 마크다운 에디터, 도움말
패널, 토스트(`yona.ui.Toast.js`), 스위치(`yona.ui.Switch.js`), 드롭다운(`yona.ui.Dropdown.js`),
다이얼로그(`yona.ui.Dialog.js`), 타입어헤드(`yona.ui.Typeahead.js`), 첨부파일
(`yona.Attachments.js`), review-form(`yona.CodeCommentBox.js`), pagination
(`yona.Pagination.js`), **login-dialog(`yona.LoginDialog.js`, 2026-09-15 완료 - 아래
1번이었던 항목)**, **scroll-elevator(`yona.ScrollElevator.js`, 2026-09-15 완료 - 아래
2번이었던 항목)**, **page-slide(`yona.twoColumnMode.js`의 `_pageslide*`, 2026-09-15
완료 - 아래 3번이었던 항목)**, **popover(`yona.Common.js`의 툴팁/팝오버 시스템,
2026-09-15 완료 - 아래 4번이었던 항목)**, **label-editor(`yona.issue.LabelEditor.js`,
2026-09-15 완료 - 아래 5번이었던 항목, 커스텀 엘리먼트 3개
`<yona-new-label-form>`/`<yona-category-edit-dialog>`/`<yona-label-edit-dialog>`로
분해)**.

## 진짜 위젯 후보 (권장 착수 순서)

착수 난이도가 낮고 리스크가 명확한 것부터 나열했다 - 반드시 이 순서를 지킬 필요는 없지만,
지금까지 이 세션에서 "쉬운 것부터 실전 감각을 쌓고 review-form처럼 큰 것에 도전" 해온
패턴과 맞는다.

### ~~1. `yona.LoginDialog.js`~~ — 이식 완료(`../README.md`의 "login-dialog 위젯" 절 참고)

실제로는 예상보다 쉬웠다(CSRF 재검증 결과 review-form과 같은 403 함정이 없었음이 확인됨) -
대신 review-form의 `.review-form { display: none; }`와 똑같은 패턴의 버그
(`.loginDialog .error { display: none; }`를 `v-show`만으로는 못 이김)를 실측 중 새로
발견해 고쳤다. 자세한 내용은 README 참고.

### ~~2. `yona.ScrollElevator.js`~~ — 이식 완료(`../README.md`의 "scroll-elevator 위젯" 절 참고)

예상대로 가장 간단했다 - 감쌀 대상 서버 마크업이 아예 없어(원본부터 body에 직접
DOM을 생성) 어댑터가 새 엘리먼트를 만들어 붙이는 방식으로 대응했고, `<Teleport
to="body">`로 서드파티 jquery.elevator.css(413줄)를 이식 없이 그대로 상속받았다.

### ~~3. PageSlide 오버레이 패널~~ — 이식 완료(`../README.md`의 "page-slide 위젯" 절 참고)

예상 범위(체크박스/하이라이트 등은 어댑터에 남기고 `_pageslide*`만 분리)는 맞았지만,
실측에서 예상 못 한 함정을 하나 발견했다 - "하위 호환을 위해 host에 원본과 같은
`id="pageslide"`를 그대로 준다"는 자연스러운 선택이 실제로는 yona.css의 전역
`#pageslide { display: none; }` 규칙과 충돌해 화면에 전혀 안 보이는 버그를 냈다.
해결은 컴포넌트가 아니라 어댑터 쪽 - host에 그 id를 아예 안 주고 클로저 변수로
캐싱했다. "하위 호환 계약을 최대한 원본과 똑같이 유지하려는 선택"이 오히려 새
버그의 원인이 될 수 있다는 사례로 남는다.

### ~~4. Tooltip/Popover 플로팅 위치 시스템~~ — 이식 완료(`../README.md`의 "popover 위젯" 절 참고)

예상대로 사용 빈도가 압도적이었다(`data-toggle="tooltip"` 30개 템플릿 실사용 재확인).
"난이도 중간-높음"으로 예상했던 근거(Shadow DOM 충돌 - 전역 델리게이트가 트리거를
소유 + `data-html="true"` 임의 HTML)는 실제로는 `<Teleport>`를 트리거마다 동적으로
body/열린 dialog에 바꿔 그리는 것으로 CSS 포팅 없이 한 번에 해결됐다(review-form/
login-dialog의 "고정된 한 곳에 Teleport"보다 한 단계 더 나아간 "매번 다른 곳에
Teleport" 패턴). page-slide에서 배운 "host에 원본과 같은 id를 주면 전역 CSS와
충돌할 수 있다"는 교훈을 처음부터 반영해 별도 버그 없이 한 번에 통과했다.

### ~~5. Label 관리 패널~~ — 이식 완료(`../README.md`의 "label-editor 위젯" 절 참고)

예상대로 review-form급으로 컸다 - 사용자 지시("여러 컴포넌트로 분할해도 좋다")에 따라
`<yona-new-label-form>`/`<yona-category-edit-dialog>`/`<yona-label-edit-dialog>` 세
커스텀 엘리먼트 + 두 폼이 완전히 중복 구현했던 색상 프리셋 로직을 합친
`YonaColorPicker.vue`(비-커스텀-엘리먼트) + 순수 로직 네 모듈(`color.ts`/`request.ts`/
`data.ts`(`_coerceDataValue` 재현)/`messages.ts`) + 페이지 소유 목록 위임 어댑터
(`list-adapter.ts`)로 분해했다. 예상 못 한 함정을 real-substitution 검증에서만
(정적 스모크 테스트로는 못 잡고) 두 개 발견: (1) 새 라벨 폼에서 `v-show`로 색상
피커를 토글했는데 page-slide/login-dialog에서 이미 겪은 것과 같은 패턴의 버그(전역
`.label-preset-colors { display: none; }`를 `v-show`의 빈 인라인 스타일로는 못
이김) - 인라인 스타일에 명시적으로 `display` 값을 줘서 해결. (2) 라벨 수정
다이얼로그의 카테고리 `<option>`을 `show()`(사용자 액션) 시점에 채웠는데, 전역
TomSelect 스캐너가 `DOMContentLoaded`에 이미 빈 `<select>`를 스냅샷해버려 수정
기능 전체가 항상 400으로 실패 - `onMounted()`로 옮겨서 해결.

부속 후보: `yona.project.Home.js` 330~603행(~270줄)의 **프로젝트 홈 인라인 Label Board**
는 서버 마크업 없이 클라이언트가 처음부터 DOM을 생성하는 미니 버전으로 기능이 겹친다 -
별도 포팅보다는 이 위젯을 만들 때 공유 가능한 하위 컴포넌트로 함께 설계하는 편이 낫다
(단독 우선순위 없음).

## 새 포팅 대상은 아니지만 조치 가치가 있는 발견

새 위젯을 만드는 게 아니라 **이미 이식된 위젯을 확장/재사용하거나 검증을 보강**해야
하는 항목들이다.

1. ~~**`yona.CommentAttachmentsUpdate.js`(240줄)를 `<yona-attachments>`로 흡수**~~
   — 확장 완료(2026-09-16, `../README.md`의 "attachments 위젯" 절 "확장" 항목
   참고). 예상대로 새 위젯 설계는 필요 없었다 - `<yona-attachments>`에 마커
   기반 초기 데이터 읽기(`markers.ts`, TDD)만 추가하면 됐다. 예상 못 한
   발견 둘: (1) 댓글 수정 폼의 `temporaryUploadFiles` 히든 필드는 완전히 죽은
   값이었다(실제 PUT은 `{contents, sendNotificationMail}`만 보내는 JSON이고,
   백엔드가 저장된 마크다운의 `/files/{id}` 링크를 정규식으로 스캔해 첨부파일을
   재연결한다) - 그래서 CSV 추적을 재현할 필요가 아예 없었다. (2) 백엔드
   `AccessControl.isAllowedAttachment()`에 `ISSUE_COMMENT`/`NONISSUE_COMMENT`
   케이스가 없어(`else -> false`) 기존 `resourceType`/`resourceId` 기반 비동기
   조회를 그대로 못 썼다 - 백엔드 보안 코드 수정은 스코프 밖이라, 서버가 이미
   렌더링해둔 데이터를 라이트 DOM 마커로 두고 마운트 시점에 한 번만 읽어
   네트워크 요청 자체를 없애는 방식으로 우회했다. 덤으로 `listURL` 기본값이
   실제 없는 엔드포인트(`/attachments`)를 가리키던 기존 버그도 발견해 고쳤다
   (`/files`로 수정). real-substitution 검증(이슈 댓글 + 게시글 댓글 양쪽)
   에서 버그 0건 - 설계대로 한 번에 통과했다.
2. **`yona.code.SvnDiff.js`가 `<yona-review-form>`을 안 쓰고 있음**: `_showCommentBox`/
   `_hideCommentBox`(359~451행)가 이미 이식된 review-form을 재사용하지 않고 자체
   댓글박스 이동 로직을 따로 구현 중이다. 신규 포팅이 아니라 **기존 위젯으로 갈아끼우는
   확장 작업**.
3. ~~**`<yona-typeahead>` 호환성 재검증 필요**~~ — 재검증 완료(2026-09-16), **실제로는
   충돌 없음**. `yona.organization.Member.js`/`yona.project.Member.js` 둘 다
   `new yona.ui.Typeahead(...)`에 `render`/`updater` 콜백을 넘기지만, 현재
   `common/yona.ui.Typeahead.js`(이미 vanilla로 재작성된 버전, Bootstrap
   `bootstrap-typeahead.js`에 의존하지 않는다는 파일 자체 주석 참고) 소스를 끝까지
   읽고 grep(`htData\.render`/`htData\.updater`/`options\.item`/`$menu`)으로
   확인한 결과, `_initVar`/`_process`/`_render`/`_select` 어디에서도 호출부가 넘긴
   `render`/`updater`를 참조하지 않는다 - 완전히 죽은 옵션이다(레거시 jQuery
   `bootstrap-typeahead.js` 시절의 `this.options.item`/`this.$menu` API 잔재로
   추정, vanilla 재작성 때 이 두 옵션만 안 옮겨진 것으로 보임). 즉 이 두 화면의
   실제 런타임 동작은 이미 순수 기본 렌더링(하이라이트 포함 `<li><a>`)이라
   `<yona-typeahead>`의 "메뉴는 항상 같은 모양" 전제와 애초에 충돌하지 않는다 -
   컴포넌트 쪽 조치는 불필요. (부수 발견, 별도 조치 불필요: 호출부의 `_render`/
   `_updater`/`updater` 함수 자체는 죽은 코드이므로, 별개로 vanilla 쪽 정리를
   원하면 두 파일에서 지워도 무방하다 - Vue 포팅 범위 밖.)
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
