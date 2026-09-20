# IT정보화포탈 잔여과제

## 활성 과제

정보화실무협의회 전용 과제는 [TASK_COUNCIL.md](TASK_COUNCIL.md), 완료 이력은 [TASK_COUNCIL_DONE.md](TASK_COUNCIL_DONE.md)에서 같은 방식으로 별도 관리합니다.

새 과제는 아래 표 형식으로 등록하고, 완료·해소·감내·폐기 항목은 [`TASK_DONE.md`](TASK_DONE.md)로 옮깁니다.

| ID  | 우선순위 | 상태 | 과제 | 다음 조치 | 근거 문서 |
| --- | :------: | ---- | ---- | --------- | --------- |
| FE-87 | 낮음 | 열림 | PDF 뷰어 연속 스크롤 후속 정리: `usePdfViewer`가 문서 열기 때 전 페이지 `getPage`를 선행해 장문서 첫 화면이 늦음(pdf.js처럼 첫 페이지 크기로 시작해 지연 채움), 행 모델이 본문 `p-4` 상단 패딩 16px을 반영하지 않음, `layout()` 앵커가 rAF 스로틀된 `scrollTop`을 사용, 렌더 실패 페이지가 스크롤마다 재시도(실패 마커 없음), `renderedPages` 매 프레임 재할당, DPR≠1·행 중간 앵커 복원 테스트 부재 | 장문서 실측 후 `getPage` 지연 채움부터 순서대로 처리 | [설계](docs/superpowers/specs/done/2026-09-14-pdf-viewer-continuous-scroll-design.md) |
| FE-88 | 낮음 | 열림 | 예산 목록 기본 범위 [팀]에서 `SVN_TEM_C`가 NULL·빈 값인 기존 행(전산업무비 `BCOSTM`, 정보화사업 `BPROJM`)이 보이지 않음. 설계가 사용자 팀코드 부재만 다루고 데이터 쪽 팀코드 부재는 다루지 않은 공백 | 운영 데이터에서 `SVN_TEM_C IS NULL` 건수를 먼저 세고, 유의미하면 [팀] 범위에 미지정 행 포함 규칙이나 안내 문구를 추가 | [설계](docs/superpowers/specs/done/2026-09-14-team-scope-budget-list-design.md) |

ID 접두사와 최대 번호(양 파일 합산): SEC-24, ERR-17, FE-92, BE-115, CQ-50, LOG-07, BRD-11, EAI-04, REPO-06, MIG-31. 새 ID를 채번한 뒤 `grep -ohE '^\| (SEC|ERR|FE|BE|CQ|LOG|BRD|EAI|REPO|MIG)-[0-9]+' TASK.md TASK_DONE.md | sort | uniq -d`로 중복을 확인합니다.

## 예정된 정리 작업

- 2026-10-12 이후: PDF 미리보기 서비스워커 해제 전환 코드 삭제(`it_frontend/app/plugins/retire-pdf-preview-sw.client.ts`, `app/utils/retirePdfPreviewServiceWorker.ts`, 해당 테스트). 만료일 상수 `RETIRE_PDF_PREVIEW_SW_UNTIL` 이후 플러그인은 이미 no-op이다(FE-86).
- `V20260907_002` 적용 후 검증 통과 배포로부터 30일 뒤: 로컬·dev의 `BAK_TPRMPP_BPROJM`·`BAK_TPRMPP_BPROJL` 삭제([운영 인계](it_database/docs/operations/2026-09-12-project-content-clob-and-bgdoc-type-handover.md)).

## 2026-09-12 이전 상태

2026-09-12 문서 현행화에서 등재한 19건(SEC-24, BE-107~114, FE-84~86, CQ-47~50, REPO-05·06)은 같은 날 모두 조치해 [`TASK_DONE.md`](TASK_DONE.md)에 기록했다. FE-79~83·BE-106, BE-101~105·FE-74~78·CQ-45·46, SEC-21~23, BE-90~100, FE-68~73, CQ-42~44도 같은 파일에 있다.

`V20260903_004`·`V20260903_005`가 목표로 한 접두어별 BGDOC 인덱스는 `V20260907_002`의 통합 인덱스로 대체됐다. 운영 DB에 남은 인덱스 교체와 데이터 보정 항목은 [`meta/backlog.md`](meta/backlog.md)가 관리하며, 운영 적용·재추출 전에는 실제 인덱스 현황인 `meta/index.txt`를 수정하지 않는다.
