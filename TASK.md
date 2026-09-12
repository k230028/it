# IT정보화포탈 잔여과제

## 활성 과제

현재 열린 과제가 없습니다. 새 과제는 아래 표 형식으로 등록하고, 완료·해소·감내·폐기 항목은 [`TASK_DONE.md`](TASK_DONE.md)로 옮깁니다.

| ID  | 우선순위 | 상태 | 과제 | 다음 조치 | 근거 문서 |
| --- | :------: | ---- | ---- | --------- | --------- |

ID 접두사와 최대 번호(양 파일 합산): SEC-24, ERR-17, FE-86, BE-114, CQ-50, LOG-07, BRD-11, EAI-04, REPO-06, MIG-31. 새 ID를 채번한 뒤 `grep -ohE '^\| (SEC|ERR|FE|BE|CQ|LOG|BRD|EAI|REPO|MIG)-[0-9]+' TASK.md TASK_DONE.md | sort | uniq -d`로 중복을 확인합니다.

## 예정된 정리 작업

- 2026-10-12 이후: PDF 미리보기 서비스워커 해제 전환 코드 삭제(`it_frontend/app/plugins/retire-pdf-preview-sw.client.ts`, `app/utils/retirePdfPreviewServiceWorker.ts`, 해당 테스트). 만료일 상수 `RETIRE_PDF_PREVIEW_SW_UNTIL` 이후 플러그인은 이미 no-op이다(FE-86).
- `V20260907_002` 적용 후 검증 통과 배포로부터 30일 뒤: 로컬·dev의 `BAK_TPRMPP_BPROJM`·`BAK_TPRMPP_BPROJL` 삭제([운영 인계](it_database/docs/operations/2026-09-12-project-content-clob-and-bgdoc-type-handover.md)).

## 2026-09-12 이전 상태

2026-09-12 문서 현행화에서 등재한 19건(SEC-24, BE-107~114, FE-84~86, CQ-47~50, REPO-05·06)은 같은 날 모두 조치해 [`TASK_DONE.md`](TASK_DONE.md)에 기록했다. FE-79~83·BE-106, BE-101~105·FE-74~78·CQ-45·46, SEC-21~23, BE-90~100, FE-68~73, CQ-42~44도 같은 파일에 있다.

`V20260903_004`·`V20260903_005`가 목표로 한 접두어별 BGDOC 인덱스는 `V20260907_002`의 통합 인덱스로 대체됐다. 운영 DB에 남은 인덱스 교체와 데이터 보정 항목은 [`meta/backlog.md`](meta/backlog.md)가 관리하며, 운영 적용·재추출 전에는 실제 인덱스 현황인 `meta/index.txt`를 수정하지 않는다.
