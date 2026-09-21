# 정보화실무협의회 입력 길이와 DB BYTE 한도 정합

- 과제: [COUNCIL-005](../../../../TASK_COUNCIL.md)
- 범위: 협의회 자유입력 21개 필드의 프론트 입력 제한과 서버 저장 검증. `it_backend/src/main/java/com/kdb/it/domain/council/**`, `it_frontend/app/components/council/**`, `it_frontend/app/pages/info/council-request/**`, `it_frontend/app/features/council/**`와 각 테스트만 바꾼다. DB 스키마, DTO, 컨트롤러, 공통 유틸은 바꾸지 않는다.

## 문제

ITPOWN의 `VARCHAR2`는 BYTE semantics라 한글 한 글자가 3바이트다. 협의회 화면은 글자 수 `maxlength`만 두고 서버는 길이를 검사하지 않아, 한도를 넘는 한글 입력이 저장 시 `ORA-12899`로 실패하고 사용자는 일반 오류 토스트만 본다.

| 화면·필드 | 컬럼 | DB | 현재 프론트 제한 |
| --- | --- | --- | --- |
| 검토표 필요성 `ncs` | `BPOVWM.ABUS_NCS_CONE` | 300B | 1000자 |
| 검토표 사업내용 `prjDes` | `BPOVWM.ABUS_CONE` | 1000B | 1000자 |
| 자체점검·평가의견·계획평가·결과서 `ckgOpnn` | `BCHKLM`·`BEVALM`·`BPLEVM`·`BRSLTM.CKG_OPNN_CONE` | 1000B | 1000자 |
| 사전·주요 Q&A 답변 | `BPQNAM`·`BMQNAM.REP_CONE` | 2000B | 2000자 |
| 생략 판정 사유 `cnfmCone` | `BASCTM.PRTY_IVG_OMT_RSN` | 200B | 2000자 |
| 검토표 사업명·기간·법률근거, 성과지표 5개, 결과 종합의견, 회의장소, Q&A 질문 | 100~6000B | 없음 |
| 검토표 기대효과 `xptEff`, 생략요청 사유 `rsn` | 4000B | 1000자 / 200자 |

기존 글자 수 제한은 PRD나 코드 주석에 근거가 없다. 이 작업은 모든 필드의 프론트 한도를 DB 바이트 한도로 맞춘다.

## 한도

값은 로컬 DB(9/4 운영 참조 덤프 + 이후 마이그레이션)의 DDL을 그대로 쓴다.

| 엔티티 | 필드 → 컬럼 | 바이트 |
| --- | --- | --- |
| `Bpovwm` | 사업명 `abusNm` → `ABUS_NM` | 100 |
| `Bpovwm` | 사업기간 `abusTrmCone` → `ABUS_TRM_CONE` | 300 |
| `Bpovwm` | 필요성 `abusNcsCone` → `ABUS_NCS_CONE` | 300 |
| `Bpovwm` | 사업내용 `abusCone` → `ABUS_CONE` | 1000 |
| `Bpovwm` | 법률근거 `lwFdtn` → `LW_FDTN` | 300 |
| `Bpovwm` | 기대효과 `dgogPpoCone` → `DGOG_PPO_CONE` | 4000 |
| `Bperfm` | 지표명 `evlDtpNm` → `EVL_DTP_NM` | 100 |
| `Bperfm` | 지표정의 `evlDtpDfntCone` → `EVL_DTP_DFNT_CONE` | 4000 |
| `Bperfm` | 계산식 `evlDtpClfCone` → `EVL_DTP_CLF_CONE` | 4000 |
| `Bperfm` | 측정시점 `evlDtpMsmPtmCone` → `EVL_DTP_MSM_PTM_CONE` | 300 |
| `Bperfm` | 측정주기 `evlDtpMsmCleCone` → `EVL_DTP_MSM_CLE_CONE` | 300 |
| `Bchklm` `Bevalm` `Bplevm` `Brsltm` | 점검의견 `ckgOpnn`(`Bchklm`·`Bevalm`·`Brsltm`) · `evalOpnn`(`Bplevm`) → `CKG_OPNN_CONE` | 1000 |
| `Brsltm` | 종합의견 `synOpnn` → `SYN_OPNN_CONE` | 6000 |
| `Bpqnam` `Bmqnam` | 질문 `qtnCone` → `QTN_CONE` | 4000 |
| `Bpqnam` `Bmqnam` | 답변 `repCone` → `REP_CONE` | 2000 |
| `Baskpm` | 생략요청 사유 `cgprOpnnCone` → `CGPR_OPNN_CONE` | 4000 |
| `Basctm` | 회의장소 `cnrcPlc` → `CNRC_PLC_NM` | 100 |
| `Basctm` | 생략판정 사유 `prtyIvgOmtRsn` → `PRTY_IVG_OMT_RSN` | 200 |

프론트의 단일 출처는 `app/features/council/councilFormLimits.ts`이며 `projectFormLimits.ts`와 같은 `{ 필드: { maxBytes } } as const` 형태다. 백엔드의 단일 출처는 각 엔티티의 `private static final int` 상수다. 두 값이 어긋나지 않도록 프론트 테스트가 위 표의 숫자를 고정한다.

## 백엔드

`domain/council/entity/CouncilTextLimits`(final 유틸)를 추가한다.

```java
static void require(String entityLabel, String columnName, String value, int maxBytes)
```

`Utf8ByteLimit.length(value)`가 `maxBytes`를 넘으면 `IllegalArgumentException("협의회 <entityLabel> <columnName>은 UTF-8 기준 <maxBytes>바이트를 초과할 수 없습니다. (현재: <actual>바이트)")`를 던진다. `null`과 빈 값은 통과한다. 공통 예외 처리기가 400으로 변환한다.

위 표의 엔티티 10개에 `@PrePersist @PreUpdate` 메서드를 추가해 해당 컬럼을 검사한다. `Bcostm.validateSnapshotNamesBeforePersist`와 같은 위치·이름 규약을 따른다. 생성·갱신·팩토리(`Bpovwm.update`, `Baskpm.create`, `Basctm.recordSkipDecision`, 일정 확정) 어느 경로로 값이 들어와도 JDBC 호출 전에 걸린다. DTO·서비스·컨트롤러는 바꾸지 않는다.

BYTE 컬럼은 한도를 넘는 값을 담을 수 없으므로 기존 행이 새 검증에 걸리는 경우는 없다.

## 프론트

모든 대상 입력에서 글자 수 `maxlength`를 제거하고 바이트 한도로 바꾼다. 한도는 `councilFormLimits`에서만 읽는다.

| 바인딩 방식 | 적용 |
| --- | --- |
| `v-model` (평가의견, 계획평가, 결과서 점검·종합의견, Q&A 질문·답변, 생략요청 사유, 생략판정 사유) | `useDatabaseByteLimit().createModel(get, set, maxBytes)`로 교체 |
| 네이티브 `:value` + `@input` (검토표 개요, 성과지표) | 핸들러에서 `acceptText(value, maxBytes)`가 거짓이면 `restoreRejectedInput`으로 입력값을 되돌리고 모델을 갱신하지 않음 |
| 회의장소 `cnrcPlc1`·`cnrcPlc2` | 각 입력 100B로 거부하고, 제출 직전 결합 문자열도 `acceptText(joined, 100)`으로 검사해 초과 시 전송하지 않음 |

각 입력 옆에 `TextLengthIndicator :value :max-bytes`를 둔다. 거부 시 토스트와 문구는 공통 컴포저블의 것을 그대로 쓴다(`common.messages.textLengthExceeded`, `common.units.textLengthExceeded`). 새 i18n 키는 만들지 않는다.

## 검증

- 백엔드: `CouncilTextLimitsTest`(경계 N 통과·N+1 거부·null 통과), 엔티티별 `@PrePersist` 거부 테스트(파라미터화, 한글 3바이트 기준으로 한도 초과 값 구성) — `domain/council` 테스트, 백엔드 전체 `./gradlew test`, `spotlessJavaCheck`.
- 프론트: `tests/unit/features/council/councilFormLimits.test.ts`(위 표의 숫자 고정), 컴포넌트 테스트 — 초과 입력 거부·복원, 회의장소 결합 검사, 검토표 개요 `@input` 거부 — `npm run check`, `npm test`.
- 실행 결과는 `TASK_COUNCIL_DONE.md`에 남긴다.

## 비범위

- 서버 400 메시지를 토스트에 그대로 노출하는 일(COUNCIL-009).
- CLOB 전환이나 컬럼 확장.
- 조회 API 대상 권한(COUNCIL-013), 동시 편집(COUNCIL-012).
- `/council` 밖 파일 수정. 공통 유틸·컴포넌트·i18n 키는 호출만 한다.
