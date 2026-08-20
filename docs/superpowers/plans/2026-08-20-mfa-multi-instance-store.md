# SEC-13 MFA 다중 인스턴스 저장소 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `MfaTransactionStore`·`LoginPendingTransactionStore`의 메모리 구현을 Oracle 공유 테이블(JPA) 구현으로 교체해, 서버 재시작과 다중 인스턴스 배포에서도 진행 중인 로그인 대기·MFA 거래가 유지되도록 한다.

**Architecture:** `common/mfa/store/` 아래에 `JpaMfaTransactionStore`·`JpaLoginPendingTransactionStore`를 새 구현으로 추가하고, 기존 `InMemory*` 구현은 그대로 남긴다. `app.mfa.store`(`jpa`|`memory`, 기본 `jpa`) 프로퍼티로 `@ConditionalOnProperty`가 둘 중 하나만 스프링 빈으로 등록한다. 상태 전이(검증·실패·취소·증표소비)는 전부 조건부 `UPDATE` 한 문장으로 표현해 분산 락 없이 원자성을 얻는다. `EXPIRED`는 저장하지 않고 `END_DTM` 비교로만 판별한다.

**Tech Stack:** Spring Data JPA(`@Modifying @Query` JPQL), Oracle, Flyway.

**Spec:** [docs/superpowers/specs/2026-08-16-mfa-multi-instance-store-design.md](../specs/2026-08-16-mfa-multi-instance-store-design.md) — 원자적 SQL·접근 계층·시간 기준의 근거 문서. 단, 아래 두 지점은 **사용자가 2026-08-20에 확정한 실제 meta 등록 결과로 이 계획이 우선한다**(스펙 문서는 갱신되지 않은 채로 둔다):

1. 테이블·컬럼명 — `TPRMPP_CMFTRM`/`TPRMPP_CMFLPM`이 아니라 **`TPRMPP_CMFATM`/`TPRMPP_CMFADM`**, 컬럼은 `APN_CER_*` 접두를 쓴다(§테이블 설계 참고).
2. 감사 컬럼 — 스펙 §6.1은 `BaseEntity` 미상속을 "예외"로 제안했으나, 사용자가 준 최종 스키마는 **`BaseEntity`를 그대로 상속**한다(`FST_ENR_*`, `LST_CHG_*`, `DEL_YN`, `GUID`, `GUID_PRG_SNO` 전부 포함, `DATE` 타입, 시퀀스 없음 유지).

## 범위와 범위 밖

**이번 계획이 구현하는 것**: 두 테이블 생성, 두 저장소 인터페이스의 JPA 구현, 설정 토글, 만료 정리 배치. `MfaService`·`FidoMfaProvider`는 **건드리지 않는다** — 두 클래스 모두 저장소 인터페이스 뒤에서 동작하므로 구현 교체만으로 정상 동작한다(근거는 아래 "MfaService를 바꾸지 않아도 되는 이유" 참고).

**범위 밖(후속 과제로 TASK.md에 등록)**: `APN_CER_SVC_TR_NO`(서비스거래번호) 컬럼은 스키마에 존재하지만 이번 계획에서는 어떤 코드도 채우지 않는다. `FidoMfaProvider.pendingByTransactionId`(OnePass `svcTrId`를 인스턴스 로컬 맵에 보관)와 `MfaService.knownExpiryByTokenHash`/`cancelledExpiryByTokenHash`는 저장소 인터페이스 **밖**에 있어 그대로 남는다. 스펙 §2가 지적한 대로, FIDO 폴링이 challenge를 시작한 인스턴스가 아닌 곳으로 가면 `undecided()` 대신 `failure()`가 반환되어 약 15초 만에 거래가 잠기는 문제는 **이번 계획으로 해소되지 않는다**. 다중 인스턴스 배포 직전에 별도 계획으로 착수해야 한다.

## MfaService를 바꾸지 않아도 되는 이유

`MfaService.findActiveTransaction`은 `transactionStore.findByTokenHash(tokenHash, now)`가 빈 값을 반환할 때만 로컬 맵을 참조해 `MFA_EXPIRED`/`MFA_REQUIRED`를 구분한다. `assertVerifiable`은 조회된 거래가 있으면 `status()`만으로 `MFA_LOCKED`/`MFA_REQUIRED`를 던진다.

JPA 구현의 `delete()`(취소)는 행을 물리 삭제하지 않고 `APN_CER_STS_TC='40'`(CANCELLED)로 UPDATE하므로, 취소 뒤에도 `findByTokenHash`는 `END_DTM > now`인 한 그 행을 **계속 반환**한다. `assertVerifiable`은 CANCELLED를 "PENDING 아님" 분기로 처리해 `MFA_REQUIRED`를 던지므로, 기존 테스트(`취소한_거래의_검증은_증표_요구로_거부한다`)가 기대하는 동작과 정확히 일치한다. 로컬 맵 경로는 **오직 만료 후 정리 배치가 행을 지운 뒤**의 조회 miss에서만 발동하며, 그 경우도 기존과 동일하게(교차 인스턴스 이슈는 있지만 안전한 방향으로) `MFA_REQUIRED`로 폴백한다 — 새로운 실패 모드가 생기지 않는다.

## Global Constraints

- `it_backend`/`it_database`는 별도 git 저장소다. 커밋은 각각 `git -C it_backend`/`git -C it_database`로 만들고 경로를 명시해 스테이징한다(`git add -A` 금지).
- 신규 주석은 한글로 작성한다.
- 마이그레이션은 `V{YYYYMMDD_NNN}__{CamelCaseDescription}.sql`, 오늘(2026-08-20) 기존 최댓값은 `V20260820_001`이므로 다음 파일은 `V20260820_002__CreateMfaTransactionTables.sql`이다.
- Oracle 접속 계정 `ITPAPP`, 소유 스키마 `ITPOWN`. DDL은 `ITPOWN.` 접두를 명시한다.
- 엔티티는 `BaseEntity`(`com.kdb.it.domain.entity.BaseEntity`)를 상속하고, 비인증 흐름이므로 정적 팩토리에서 `initializeAuditActors(eno)`를 호출한다(전례: `Crtokm.create(...)`).
- 영속성 변경은 `AbstractOracleRepositoryTest`(`@Tag("it")`, 로컬 Oracle 필요) 기반 통합 테스트를 추가한다.
- 각 작업 완료 후 `cd C:\it\it_backend && ./gradlew test --tests '패키지.클래스명'`으로 해당 테스트만 먼저 확인한 뒤, 작업 그룹이 끝나면 `./gradlew test`로 전체를 확인한다.

---

## Task 1: 마이그레이션 — TPRMPP_CMFATM·TPRMPP_CMFADM 생성

**저장소:** `it_database`

**Files:**
- Create: `it_database/migrations/V20260820_002__CreateMfaTransactionTables.sql`

**Interfaces:**
- Produces: 테이블 `ITPOWN.TPRMPP_CMFATM`(PK `APN_CER_TR_TOK_CONE`), `ITPOWN.TPRMPP_CMFADM`(PK `APN_CER_TR_TOK_CONE`).이후 모든 Task가 이 물리 스키마를 전제로 한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- SEC-13: 로그인 대기·MFA 거래를 서버 메모리 대신 Oracle 공유 테이블로 옮겨
-- 다중 인스턴스 배포에서도 진행 중 거래가 유지되도록 한다.
--
-- [설계 근거]
--   docs/superpowers/specs/2026-08-16-mfa-multi-instance-store-design.md.
--   단, 테이블·컬럼명과 감사 컬럼 채택 여부는 2026-08-20 meta 등록 결과를 따른다
--   (스펙 문서의 TPRMPP_CMFTRM/CMFLPM, BaseEntity 미상속 제안은 채택하지 않았다).
--
-- [컬럼 구성]
--   두 테이블 모두 BaseEntity 공통 감사 컬럼(FST_ENR_*, LST_CHG_*, DEL_YN, GUID,
--   GUID_PRG_SNO)을 포함한다. 수명 90초의 휘발성 인증 상태이지만 다른 업무 테이블과
--   동일한 감사 규칙을 적용하기로 확정했다.
--
-- [삭제 정책]
--   DEL_YN 논리 삭제를 쓰지 않는다. MfaTransactionCleanupScheduler가 만료 후 10분
--   유예를 두고 물리 삭제한다(행 무한 증가 방지, 유예는 만료 직후 사유 판별용 창).
--
-- [시퀀스 없음]
--   PK가 서버 challengeId(UUID)의 SHA-256 해시이므로 시퀀스를 쓰지 않는다.

CREATE TABLE ITPOWN.TPRMPP_CMFATM (
    APN_CER_TR_TOK_CONE   VARCHAR2(300 CHAR) NOT NULL,
    APN_CER_CRTT_TOK_CONE VARCHAR2(300 CHAR),
    APN_CER_TRY_TOK_CONE  VARCHAR2(300 CHAR),
    APN_CER_SVC_TR_NO     VARCHAR2(20 CHAR),
    APN_CER_USG_TC        VARCHAR2(2 CHAR)   NOT NULL,
    APN_CER_MNS_TC        VARCHAR2(2 CHAR)   NOT NULL,
    APN_CER_STS_TC        VARCHAR2(2 CHAR)   NOT NULL,
    ENO                   VARCHAR2(32 CHAR)  NOT NULL,
    END_DTM               DATE               NOT NULL,
    VRF_DTM               DATE,
    FLUR_NOT              NUMBER(5)          NOT NULL,
    FST_ENR_USID          VARCHAR2(14 CHAR)  DEFAULT '00000000000000' NOT NULL,
    FST_ENR_DTM           DATE               DEFAULT SYSDATE NOT NULL,
    DEL_YN                VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
    GUID                  VARCHAR2(38 CHAR)  DEFAULT '00000000000000000000000000000000000000' NOT NULL,
    GUID_PRG_SNO          NUMBER(4)          DEFAULT 0 NOT NULL,
    LST_CHG_USID          VARCHAR2(14 CHAR)  DEFAULT '00000000000000' NOT NULL,
    LST_CHG_DTM           DATE               DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_CMFATM PRIMARY KEY (APN_CER_TR_TOK_CONE)
);

CREATE UNIQUE INDEX ITPOWN.UX_TPRMPP_CMFATM_01 ON ITPOWN.TPRMPP_CMFATM (APN_CER_CRTT_TOK_CONE);
CREATE INDEX ITPOWN.IX_TPRMPP_CMFATM_02 ON ITPOWN.TPRMPP_CMFATM (END_DTM);

COMMENT ON TABLE ITPOWN.TPRMPP_CMFATM IS '프로젝트관리_공통추가인증거래기본';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.APN_CER_TR_TOK_CONE IS '추가인증거래토큰내용';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.APN_CER_CRTT_TOK_CONE IS '추가인증증표토큰내용';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.APN_CER_TRY_TOK_CONE IS '추가인증시도토큰내용';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.APN_CER_SVC_TR_NO IS '추가인증서비스거래번호';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.APN_CER_USG_TC IS 'IT포탈추가인증용도구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.APN_CER_MNS_TC IS 'IT포탈추가인증수단구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.APN_CER_STS_TC IS 'IT포탈추가인증상태구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.ENO IS '사원번호';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.END_DTM IS '종료일시';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.VRF_DTM IS '검증일시';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.FLUR_NOT IS '실패횟수';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.FST_ENR_USID IS '최초등록사용자ID';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.FST_ENR_DTM IS '최초등록일시';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.DEL_YN IS '삭제여부';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.GUID IS 'GUID';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.GUID_PRG_SNO IS 'GUID진행일련번호';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.LST_CHG_USID IS '최종변경사용자ID';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFATM.LST_CHG_DTM IS '최종변경일시';

CREATE TABLE ITPOWN.TPRMPP_CMFADM (
    APN_CER_TR_TOK_CONE VARCHAR2(300 CHAR) NOT NULL,
    ENO                 VARCHAR2(32 CHAR)  NOT NULL,
    END_DTM             DATE               NOT NULL,
    FST_ENR_USID        VARCHAR2(14 CHAR)  DEFAULT '00000000000000' NOT NULL,
    FST_ENR_DTM         DATE               DEFAULT SYSDATE NOT NULL,
    DEL_YN              VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
    GUID                VARCHAR2(38 CHAR)  DEFAULT '00000000000000000000000000000000000000' NOT NULL,
    GUID_PRG_SNO        NUMBER(4)          DEFAULT 0 NOT NULL,
    LST_CHG_USID        VARCHAR2(14 CHAR)  DEFAULT '00000000000000' NOT NULL,
    LST_CHG_DTM         DATE               DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_CMFADM PRIMARY KEY (APN_CER_TR_TOK_CONE)
);

CREATE INDEX ITPOWN.IX_TPRMPP_CMFADM_01 ON ITPOWN.TPRMPP_CMFADM (END_DTM);

COMMENT ON TABLE ITPOWN.TPRMPP_CMFADM IS '프로젝트관리_공통추가인증대기기본';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFADM.APN_CER_TR_TOK_CONE IS '추가인증거래토큰내용';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFADM.ENO IS '사원번호';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFADM.END_DTM IS '종료일시';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFADM.FST_ENR_USID IS '최초등록사용자ID';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFADM.FST_ENR_DTM IS '최초등록일시';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFADM.DEL_YN IS '삭제여부';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFADM.GUID IS 'GUID';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFADM.GUID_PRG_SNO IS 'GUID진행일련번호';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFADM.LST_CHG_USID IS '최종변경사용자ID';
COMMENT ON COLUMN ITPOWN.TPRMPP_CMFADM.LST_CHG_DTM IS '최종변경일시';
```

- [ ] **Step 2: 로컬 Oracle에 적용(백엔드 local-ext/local-int 프로파일이 Flyway로 자동 적용)**

Run (it_backend 디렉터리에서, 로컬 Oracle이 떠 있는 상태로): `./gradlew bootRun --args='--spring.profiles.active=local-ext'`를 잠깐 띄웠다가 콘솔에 `Successfully applied 1 migration`이 뜨면 종료. 또는 이미 로컬 스택이 떠 있다면 재기동 없이 다음 확인만 수행.

- [ ] **Step 3: 적용 확인**

Run: `sqlplus ITPAPP@127.0.0.1:11521/XEPDB1` 접속 후

```sql
SELECT table_name FROM all_tables WHERE owner='ITPOWN' AND table_name IN ('TPRMPP_CMFATM','TPRMPP_CMFADM');
SELECT version, description, success FROM flyway_schema_history WHERE version = '20260820.002';
```

Expected: 테이블 2건 조회, `flyway_schema_history`에 `success=1`.

- [ ] **Step 4: Commit**

```bash
cd C:/it/it_database
git add migrations/V20260820_002__CreateMfaTransactionTables.sql
git commit -m "feat: SEC-13 추가인증거래·로그인대기 테이블 추가"
```

---

## Task 2: 도메인 — 상태 확장, 복원 팩토리, 죽은 코드 제거

**저장소:** `it_backend`

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/domain/MfaTransactionStatus.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/domain/MfaTransaction.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/store/MfaTransactionStore.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStore.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStoreTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/domain/MfaTransactionRestoreTest.java` (신규)

**Interfaces:**
- Produces: `MfaTransactionStatus.CANCELLED`, `MfaTransactionStatus.CONSUMED`. `MfaTransaction.restore(tokenHash, eno, purpose, method, expiresAt, providerChallengeHash, proofHash, status, verifiedAt, failureCount): MfaTransaction` — Task 3의 `JpaMfaTransactionStore`가 엔티티→도메인 매핑에 사용한다.
- Consumes: 없음(순수 도메인 변경).

- [ ] **Step 1: 실패하는 테스트 작성 — 새 상태값과 restore 팩토리**

```java
package com.kdb.it.common.mfa.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

/** 영속 계층 매핑 전용 restore() 팩토리와 확장된 상태값의 계약을 고정한다. */
class MfaTransactionRestoreTest {

    private static final Instant EXPIRES_AT = Instant.parse("2026-08-20T00:01:30Z");
    private static final Instant VERIFIED_AT = Instant.parse("2026-08-20T00:00:30Z");

    @Test
    void restore는_저장된_필드를_그대로_복원한다() {
        MfaTransaction restored =
                MfaTransaction.restore(
                        "token-hash",
                        "E10001",
                        MfaPurpose.APPROVAL,
                        MfaMethod.FIDO,
                        EXPIRES_AT,
                        "try-hash",
                        "proof-hash",
                        MfaTransactionStatus.CONSUMED,
                        VERIFIED_AT,
                        2);

        assertThat(restored.tokenHash()).isEqualTo("token-hash");
        assertThat(restored.eno()).isEqualTo("E10001");
        assertThat(restored.purpose()).isEqualTo(MfaPurpose.APPROVAL);
        assertThat(restored.method()).isEqualTo(MfaMethod.FIDO);
        assertThat(restored.expiresAt()).isEqualTo(EXPIRES_AT);
        assertThat(restored.providerChallengeHash()).isEqualTo("try-hash");
        assertThat(restored.proofHash()).isEqualTo("proof-hash");
        assertThat(restored.status()).isEqualTo(MfaTransactionStatus.CONSUMED);
        assertThat(restored.verifiedAt()).isEqualTo(VERIFIED_AT);
        assertThat(restored.failureCount()).isEqualTo(2);
    }

    @Test
    void restore는_취소_상태를_검증시각_없이_복원할_수_있다() {
        MfaTransaction restored =
                MfaTransaction.restore(
                        "token-hash-2",
                        "E10001",
                        MfaPurpose.LOGIN,
                        MfaMethod.MOTP,
                        EXPIRES_AT,
                        null,
                        null,
                        MfaTransactionStatus.CANCELLED,
                        null,
                        0);

        assertThat(restored.status()).isEqualTo(MfaTransactionStatus.CANCELLED);
        assertThat(restored.verifiedAt()).isNull();
    }
}
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `cd C:/it/it_backend && ./gradlew test --tests 'com.kdb.it.common.mfa.domain.MfaTransactionRestoreTest'`
Expected: 컴파일 실패 — `MfaTransactionStatus.CANCELLED`, `MfaTransactionStatus.CONSUMED`, `MfaTransaction.restore(...)`가 존재하지 않음.

- [ ] **Step 3: MfaTransactionStatus에 상태 추가**

`it_backend/src/main/java/com/kdb/it/common/mfa/domain/MfaTransactionStatus.java` 전체를 다음으로 교체:

```java
package com.kdb.it.common.mfa.domain;

/** MFA 거래의 처리 상태다. */
public enum MfaTransactionStatus {
    PENDING,
    VERIFIED,
    LOCKED,
    EXPIRED,
    /** 사용자가 진행 중 거래를 취소했다. JPA 저장소에서만 영속되며 메모리 저장소는 즉시 제거한다. */
    CANCELLED,
    /** 1회용 증표가 정확히 한 번 소비됐다. JPA 저장소에서만 영속되며 메모리 저장소는 즉시 제거한다. */
    CONSUMED
}
```

- [ ] **Step 4: MfaTransaction에 restore 팩토리 추가**

`it_backend/src/main/java/com/kdb/it/common/mfa/domain/MfaTransaction.java`의 `bindProofHash` 메서드 바로 뒤(197행 부근, `status()` getter 앞)에 추가:

```java
    /**
     * 영속 계층에 저장된 상태를 그대로 복원한다.
     *
     * <p>JPA 저장소의 엔티티→도메인 매핑 전용이다. 업무 흐름은 이 메서드가 아니라 {@link #pending}과
     * {@link #verify}·{@link #fail}·{@link #bindProofHash} 등 전이 메서드를 사용해야 한다.
     *
     * @param tokenHash 거래 토큰 해시
     * @param eno 사원번호
     * @param purpose MFA 목적
     * @param method MFA 수단
     * @param expiresAt 만료 시각
     * @param providerChallengeHash 공급자 challenge 해시. 없으면 null
     * @param proofHash 증표 해시. 없으면 null
     * @param status 저장된 상태
     * @param verifiedAt 검증 시각. 없으면 null
     * @param failureCount 실패 횟수
     * @return 저장된 필드를 그대로 담은 거래
     */
    public static MfaTransaction restore(
            String tokenHash,
            String eno,
            MfaPurpose purpose,
            MfaMethod method,
            Instant expiresAt,
            String providerChallengeHash,
            String proofHash,
            MfaTransactionStatus status,
            Instant verifiedAt,
            int failureCount) {
        return new MfaTransaction(
                tokenHash,
                eno,
                purpose,
                method,
                expiresAt,
                providerChallengeHash,
                proofHash,
                status,
                verifiedAt,
                failureCount);
    }

```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `cd C:/it/it_backend && ./gradlew test --tests 'com.kdb.it.common.mfa.domain.MfaTransactionRestoreTest'`
Expected: PASS.

- [ ] **Step 6: 죽은 코드 제거 — MfaTransactionStore.verify()**

`MfaTransactionStore.java`에서 아래 메서드 선언 삭제(9~13행 사이 `Optional<MfaTransaction> verify(String tokenHash, Instant now);` 한 줄):

```java
    Optional<MfaTransaction> verify(String tokenHash, Instant now);

```
→ 삭제.

`InMemoryMfaTransactionStore.java`에서 41~55행의 `@Override public Optional<MfaTransaction> verify(...)` 메서드 전체 삭제.

근거: `MfaService`는 `verifyAndBindProof()`만 사용하고 `verify()`는 운영 코드 호출부가 없다(grep으로 확인). 두 저장소 구현이 같은 계약을 갖도록 인터페이스에서 제거한다.

- [ ] **Step 7: 이제 무의미해진 테스트 삭제**

`InMemoryMfaTransactionStoreTest.java`에서 다음 두 테스트를 삭제(저장소의 `verify()`를 직접 호출하던 테스트만 대상이며, 도메인 객체 `transaction.verify(now)`를 호출하는 다른 테스트들은 그대로 둔다):

- `verify_missingOrExpiredTransaction_isEmpty` (143~152행)
- `verify_storedPendingTransaction_isPersistedAsVerified` (154~168행)

- [ ] **Step 8: 전체 MFA 도메인·저장소 테스트 실행**

Run: `cd C:/it/it_backend && ./gradlew test --tests 'com.kdb.it.common.mfa.*'`
Expected: BUILD SUCCESSFUL, 모든 테스트 통과(제거한 2건 제외).

- [ ] **Step 9: Commit**

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/common/mfa/domain/MfaTransactionStatus.java \
        src/main/java/com/kdb/it/common/mfa/domain/MfaTransaction.java \
        src/main/java/com/kdb/it/common/mfa/store/MfaTransactionStore.java \
        src/main/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStore.java \
        src/test/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStoreTest.java \
        src/test/java/com/kdb/it/common/mfa/domain/MfaTransactionRestoreTest.java
git commit -m "feat: SEC-13 MFA 상태 CANCELLED/CONSUMED 추가, restore 팩토리, 죽은 verify() 제거"
```

---

## Task 3: MFA 거래 JPA 저장소 — TPRMPP_CMFATM

**저장소:** `it_backend`

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/MfaTransactionEntity.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/MfaTransactionJpaRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/JpaMfaTransactionStore.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/store/JpaMfaTransactionStoreIT.java` (신규, `@Tag("it")`)

**Interfaces:**
- Consumes: `MfaTransaction.restore(...)`(Task 2), `MfaTransactionStatus.CANCELLED/CONSUMED`(Task 2), `BaseEntity`(`com.kdb.it.domain.entity.BaseEntity`).
- Produces: `JpaMfaTransactionStore implements MfaTransactionStore` — Task 6에서 `@ConditionalOnProperty(prefix = "app.mfa", name = "store", havingValue = "jpa", matchIfMissing = true)`를 붙인다(이 Task에서는 아직 붙이지 않아 Spring 컨텍스트에 InMemory 구현과 동시에 등록되지 않도록 한다 — `@Component`는 이번 Task에서 추가하되 조건은 Task 6에서 완성).

- [ ] **Step 1: 엔티티 작성**

```java
package com.kdb.it.common.mfa.store;

import com.kdb.it.domain.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * 추가인증(MFA) 거래 엔티티
 *
 * <p>DB 테이블: {@code TPRMPP_CMFATM}
 *
 * <p>{@link com.kdb.it.common.mfa.domain.MfaTransaction}의 영속 표현이다. 상태 전이는 {@link
 * MfaTransactionJpaRepository}의 조건부 UPDATE({@code @Modifying})로만 수행하며, 이 엔티티는 조회 결과를
 * 도메인 객체로 되돌리는 매핑에만 쓰인다.
 */
@Entity
@Table(name = "TPRMPP_CMFATM", comment = "추가인증거래기본")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class MfaTransactionEntity extends BaseEntity {

    /** 상태코드: 대기 — {@link com.kdb.it.common.mfa.domain.MfaTransactionStatus#PENDING} */
    static final String STATUS_PENDING = "10";

    /** 상태코드: 검증완료 — {@link com.kdb.it.common.mfa.domain.MfaTransactionStatus#VERIFIED} */
    static final String STATUS_VERIFIED = "20";

    /** 상태코드: 잠금 — {@link com.kdb.it.common.mfa.domain.MfaTransactionStatus#LOCKED} */
    static final String STATUS_LOCKED = "30";

    /** 상태코드: 취소 — {@link com.kdb.it.common.mfa.domain.MfaTransactionStatus#CANCELLED} */
    static final String STATUS_CANCELLED = "40";

    /** 상태코드: 소비완료 — {@link com.kdb.it.common.mfa.domain.MfaTransactionStatus#CONSUMED} */
    static final String STATUS_CONSUMED = "50";

    @Id
    @Column(name = "APN_CER_TR_TOK_CONE", length = 300, comment = "추가인증거래토큰내용")
    private String tokenHash;

    @Column(name = "ENO", nullable = false, length = 32, comment = "사원번호")
    private String eno;

    @Column(name = "APN_CER_USG_TC", nullable = false, length = 2, comment = "IT포탈추가인증용도구분코드")
    private String purposeCode;

    @Column(name = "APN_CER_MNS_TC", nullable = false, length = 2, comment = "IT포탈추가인증수단구분코드")
    private String methodCode;

    @Column(name = "APN_CER_STS_TC", nullable = false, length = 2, comment = "IT포탈추가인증상태구분코드")
    private String statusCode;

    @Column(name = "END_DTM", nullable = false, comment = "종료일시")
    private LocalDateTime endDtm;

    @Column(name = "VRF_DTM", comment = "검증일시")
    private LocalDateTime vrfDtm;

    @Column(name = "FLUR_NOT", nullable = false, comment = "실패횟수")
    private Integer failureCount;

    @Column(name = "APN_CER_TRY_TOK_CONE", length = 300, comment = "추가인증시도토큰내용")
    private String tryTokenHash;

    @Column(name = "APN_CER_CRTT_TOK_CONE", length = 300, comment = "추가인증증표토큰내용")
    private String proofTokenHash;

    @Column(name = "APN_CER_SVC_TR_NO", length = 20, comment = "추가인증서비스거래번호")
    private String svcTrNo;

    /**
     * 신규 대기 거래를 생성한다.
     *
     * <p>로그인/MFA 시작 시점은 {@code AuditorAware}가 개입할 수 없는 비인증 흐름이 대부분이므로, 거래
     * 소유자 사번을 최초·최종 감사자로 명시적으로 기록한다({@code Crtokm.create}와 같은 방식).
     *
     * @param tokenHash 거래 토큰 해시(PK)
     * @param eno 거래 소유자 사번(감사자로도 함께 기록됨)
     * @param purposeCode IT포탈추가인증용도구분코드
     * @param methodCode IT포탈추가인증수단구분코드
     * @param endDtm 만료 시각
     * @param tryTokenHash 공급자 challenge 해시. 없으면 null
     * @return 소유자 사번이 감사자로 기록된 PENDING 상태 신규 엔티티
     */
    public static MfaTransactionEntity create(
            String tokenHash,
            String eno,
            String purposeCode,
            String methodCode,
            LocalDateTime endDtm,
            String tryTokenHash) {
        MfaTransactionEntity entity =
                MfaTransactionEntity.builder()
                        .tokenHash(tokenHash)
                        .eno(eno)
                        .purposeCode(purposeCode)
                        .methodCode(methodCode)
                        .statusCode(STATUS_PENDING)
                        .endDtm(endDtm)
                        .failureCount(0)
                        .tryTokenHash(tryTokenHash)
                        .build();
        entity.initializeAuditActors(eno);
        return entity;
    }
}
```

- [ ] **Step 2: 리포지토리 작성**

```java
package com.kdb.it.common.mfa.store;

import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 추가인증 거래({@code TPRMPP_CMFATM}) 데이터 접근 리포지토리
 *
 * <p>모든 상태 전이를 조건부 {@code UPDATE} 한 문장으로 표현한다. 영향 행 수 1이 성공이며, 동시 요청 중
 * 정확히 한 건만 1을 받으므로 원자성은 DB가 담당한다(분산 락 불필요).
 */
public interface MfaTransactionJpaRepository extends JpaRepository<MfaTransactionEntity, String> {

    /** 만료되지 않은 거래만 조회한다. 만료 판정은 EXPIRED로 저장하지 않고 END_DTM 비교로만 한다. */
    @Query("SELECT e FROM MfaTransactionEntity e WHERE e.tokenHash = :tokenHash AND e.endDtm > :now")
    Optional<MfaTransactionEntity> findActiveByTokenHash(
            @Param("tokenHash") String tokenHash, @Param("now") LocalDateTime now);

    /** 증표 해시로 조회한다. consumeVerifiedOnce가 0행일 때 사유(만료/거부/없음)를 판별하는 용도다. */
    @Query("SELECT e FROM MfaTransactionEntity e WHERE e.proofTokenHash = :proofHash")
    Optional<MfaTransactionEntity> findByProofTokenHash(@Param("proofHash") String proofHash);

    /** 대기 중인 거래를 검증완료로 전이하며 증표 해시를 결속한다(메모리 구현의 두 맵 전이를 대체). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            "UPDATE MfaTransactionEntity e SET e.statusCode = '20', e.vrfDtm = :now, "
                    + "e.proofTokenHash = :proofHash "
                    + "WHERE e.tokenHash = :tokenHash AND e.statusCode = '10' AND e.endDtm > :now")
    int verifyAndBindProof(
            @Param("tokenHash") String tokenHash,
            @Param("proofHash") String proofHash,
            @Param("now") LocalDateTime now);

    /** 실패 횟수를 올리고 최대 횟수 도달 시 잠근다. 증가와 잠금 판정을 한 문장으로 처리한다. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            "UPDATE MfaTransactionEntity e SET e.failureCount = e.failureCount + 1, "
                    + "e.statusCode = CASE WHEN e.failureCount + 1 >= :maxFailures THEN '30' ELSE '10' END "
                    + "WHERE e.tokenHash = :tokenHash AND e.statusCode = '10' AND e.endDtm > :now")
    int fail(
            @Param("tokenHash") String tokenHash,
            @Param("now") LocalDateTime now,
            @Param("maxFailures") int maxFailures);

    /** 대기 중인 거래를 취소로 전이한다. 물리 삭제하지 않아 이후 조회가 사유를 정확히 구분할 수 있다. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            "UPDATE MfaTransactionEntity e SET e.statusCode = '40' "
                    + "WHERE e.tokenHash = :tokenHash AND e.statusCode = '10' AND e.endDtm > :now")
    int cancel(@Param("tokenHash") String tokenHash, @Param("now") LocalDateTime now);

    /** 검증완료 거래의 증표를 정확히 한 번 소비한다. 동시 요청 중 한 건만 영향 행 수 1을 받는다. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            "UPDATE MfaTransactionEntity e SET e.statusCode = '50' "
                    + "WHERE e.proofTokenHash = :proofHash AND e.eno = :eno "
                    + "AND e.purposeCode = :purposeCode AND e.statusCode = '20' AND e.endDtm > :now")
    int consumeVerifiedOnce(
            @Param("proofHash") String proofHash,
            @Param("eno") String eno,
            @Param("purposeCode") String purposeCode,
            @Param("now") LocalDateTime now);

    /** 만료 후 유예 시간이 지난 행을 물리 삭제한다(용량 관리 전용, 정확성과 무관). */
    @Modifying
    @Query("DELETE FROM MfaTransactionEntity e WHERE e.endDtm < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") LocalDateTime cutoff);
}
```

- [ ] **Step 3: 저장소 구현 작성**

```java
package com.kdb.it.common.mfa.store;

import com.kdb.it.common.mfa.domain.MfaMethod;
import com.kdb.it.common.mfa.domain.MfaPurpose;
import com.kdb.it.common.mfa.domain.MfaTransaction;
import com.kdb.it.common.mfa.domain.MfaTransactionStatus;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Oracle 공유 테이블({@code TPRMPP_CMFATM})로 다중 인스턴스 배포를 지원하는 MFA 거래 저장소다.
 *
 * <p>모든 상태 전이를 {@link MfaTransactionJpaRepository}의 조건부 UPDATE에 위임하고, 영향 행 수로
 * 성공 여부를 판정한 뒤 최신 행을 다시 조회해 도메인 객체로 매핑한다.
 */
@Component
public class JpaMfaTransactionStore implements MfaTransactionStore {

    private static final ZoneId ZONE = ZoneId.systemDefault();

    private final MfaTransactionJpaRepository repository;

    public JpaMfaTransactionStore(MfaTransactionJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void save(MfaTransaction transaction) {
        repository.save(
                MfaTransactionEntity.create(
                        transaction.tokenHash(),
                        transaction.eno(),
                        purposeCode(transaction.purpose()),
                        methodCode(transaction.method()),
                        toLocalDateTime(transaction.expiresAt()),
                        transaction.providerChallengeHash()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MfaTransaction> findByTokenHash(String tokenHash, Instant now) {
        return repository.findActiveByTokenHash(tokenHash, toLocalDateTime(now)).map(this::toDomain);
    }

    @Override
    @Transactional
    public Optional<MfaTransaction> verifyAndBindProof(
            String tokenHash, String proofHash, Instant now) {
        LocalDateTime nowDtm = toLocalDateTime(now);
        if (repository.verifyAndBindProof(tokenHash, proofHash, nowDtm) != 1) {
            return Optional.empty();
        }
        return repository.findActiveByTokenHash(tokenHash, nowDtm).map(this::toDomain);
    }

    @Override
    @Transactional
    public Optional<MfaTransaction> fail(String tokenHash, Instant now, int maxFailures) {
        LocalDateTime nowDtm = toLocalDateTime(now);
        if (repository.fail(tokenHash, nowDtm, maxFailures) != 1) {
            return Optional.empty();
        }
        return repository.findActiveByTokenHash(tokenHash, nowDtm).map(this::toDomain);
    }

    @Override
    @Transactional
    public Optional<MfaTransaction> delete(String tokenHash, Instant now) {
        LocalDateTime nowDtm = toLocalDateTime(now);
        if (repository.cancel(tokenHash, nowDtm) != 1) {
            return Optional.empty();
        }
        return repository.findActiveByTokenHash(tokenHash, nowDtm).map(this::toDomain);
    }

    @Override
    @Transactional
    public ProofConsumption consumeVerifiedOnce(
            String tokenHash, String eno, MfaPurpose purpose, Instant now) {
        LocalDateTime nowDtm = toLocalDateTime(now);
        int updated = repository.consumeVerifiedOnce(tokenHash, eno, purposeCode(purpose), nowDtm);
        if (updated == 1) {
            return ProofConsumption.CONSUMED;
        }
        return repository
                .findByProofTokenHash(tokenHash)
                .map(entity -> entity.getEndDtm().isBefore(nowDtm) ? ProofConsumption.EXPIRED
                        : ProofConsumption.REJECTED)
                .orElse(ProofConsumption.MISSING);
    }

    private MfaTransaction toDomain(MfaTransactionEntity entity) {
        return MfaTransaction.restore(
                entity.getTokenHash(),
                entity.getEno(),
                purpose(entity.getPurposeCode()),
                method(entity.getMethodCode()),
                toInstant(entity.getEndDtm()),
                entity.getTryTokenHash(),
                entity.getProofTokenHash(),
                status(entity.getStatusCode()),
                entity.getVrfDtm() == null ? null : toInstant(entity.getVrfDtm()),
                entity.getFailureCount());
    }

    private static String purposeCode(MfaPurpose purpose) {
        return purpose == MfaPurpose.LOGIN ? "10" : "20";
    }

    private static MfaPurpose purpose(String code) {
        return "10".equals(code) ? MfaPurpose.LOGIN : MfaPurpose.APPROVAL;
    }

    private static String methodCode(MfaMethod method) {
        return switch (method) {
            case FINGER_VEIN -> "10";
            case FIDO -> "20";
            case MOTP -> "30";
        };
    }

    private static MfaMethod method(String code) {
        return switch (code) {
            case "10" -> MfaMethod.FINGER_VEIN;
            case "20" -> MfaMethod.FIDO;
            case "30" -> MfaMethod.MOTP;
            default -> throw new IllegalStateException("알 수 없는 IT포탈추가인증수단구분코드: " + code);
        };
    }

    private static MfaTransactionStatus status(String code) {
        return switch (code) {
            case "10" -> MfaTransactionStatus.PENDING;
            case "20" -> MfaTransactionStatus.VERIFIED;
            case "30" -> MfaTransactionStatus.LOCKED;
            case "40" -> MfaTransactionStatus.CANCELLED;
            case "50" -> MfaTransactionStatus.CONSUMED;
            default -> throw new IllegalStateException("알 수 없는 IT포탈추가인증상태구분코드: " + code);
        };
    }

    private static LocalDateTime toLocalDateTime(Instant instant) {
        return LocalDateTime.ofInstant(instant, ZONE);
    }

    private static Instant toInstant(LocalDateTime localDateTime) {
        return localDateTime.atZone(ZONE).toInstant();
    }
}
```

- [ ] **Step 4: 로컬 Oracle 통합 테스트 작성**

`AbstractOracleRepositoryTest`를 상속하고 `@Transactional(NOT_SUPPORTED)`로 각 호출을 실제 커밋시킨다(`ClangmChangeLogIt`과 같은 이유 — `@Modifying` 쿼리의 실제 원자성을 검증하려면 `@DataJpaTest` 기본 롤백 트랜잭션을 꺼야 한다).

```java
package com.kdb.it.common.mfa.store;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.mfa.domain.MfaMethod;
import com.kdb.it.common.mfa.domain.MfaPurpose;
import com.kdb.it.common.mfa.domain.MfaTransaction;
import com.kdb.it.common.mfa.domain.MfaTransactionStatus;
import com.kdb.it.support.AbstractOracleRepositoryTest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** JpaMfaTransactionStore의 원자적 전이를 실 Oracle로 검증한다. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class JpaMfaTransactionStoreIT extends AbstractOracleRepositoryTest {

    @Autowired private JpaMfaTransactionStore store;
    @Autowired private JdbcTemplate jdbcTemplate;

    private String tokenHash;

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM TPRMPP_CMFATM WHERE ENO = ?", "ITEST01");
    }

    @Test
    @DisplayName("저장한 거래는 만료 전까지 조회되고 만료 시각부터는 조회되지 않는다")
    void findByTokenHash_expiresAtBoundary() {
        Instant now = Instant.now();
        tokenHash = newToken();
        store.save(pending(tokenHash, now.plusSeconds(90)));

        assertThat(store.findByTokenHash(tokenHash, now)).isPresent();
        assertThat(store.findByTokenHash(tokenHash, now.plusSeconds(90))).isEmpty();
    }

    @Test
    @DisplayName("verifyAndBindProof는 대기 거래를 검증완료로 바꾸고 증표 해시를 결속한다")
    void verifyAndBindProof_pendingTransaction_becomesVerified() {
        Instant now = Instant.now();
        tokenHash = newToken();
        store.save(pending(tokenHash, now.plusSeconds(90)));

        MfaTransaction verified =
                store.verifyAndBindProof(tokenHash, "proof-" + tokenHash, now).orElseThrow();

        assertThat(verified.status()).isEqualTo(MfaTransactionStatus.VERIFIED);
        assertThat(verified.proofHash()).isEqualTo("proof-" + tokenHash);
    }

    @Test
    @DisplayName("취소된 거래는 삭제되지 않고 CANCELLED 상태로 계속 조회된다")
    void delete_pendingTransaction_becomesCancelledButStillFound() {
        Instant now = Instant.now();
        tokenHash = newToken();
        store.save(pending(tokenHash, now.plusSeconds(90)));

        MfaTransaction cancelled = store.delete(tokenHash, now).orElseThrow();

        assertThat(cancelled.status()).isEqualTo(MfaTransactionStatus.CANCELLED);
        assertThat(store.findByTokenHash(tokenHash, now)).isPresent();
    }

    @Test
    @DisplayName("동시 증표 소비 두 건 중 정확히 한 건만 CONSUMED다")
    void consumeVerifiedOnce_concurrentConsumers_exactlyOneSucceeds() throws Exception {
        Instant now = Instant.now();
        tokenHash = newToken();
        String proofHash = "proof-" + tokenHash;
        store.save(pending(tokenHash, now.plusSeconds(90)));
        store.verifyAndBindProof(tokenHash, proofHash, now);

        Callable<MfaTransactionStore.ProofConsumption> consume =
                () -> store.consumeVerifiedOnce(proofHash, "ITEST01", MfaPurpose.LOGIN, now);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            List<Future<MfaTransactionStore.ProofConsumption>> results =
                    executor.invokeAll(List.of(consume, consume));
            List<MfaTransactionStore.ProofConsumption> outcomes =
                    List.of(results.get(0).get(), results.get(1).get());
            assertThat(outcomes)
                    .containsExactlyInAnyOrder(
                            MfaTransactionStore.ProofConsumption.CONSUMED,
                            MfaTransactionStore.ProofConsumption.REJECTED);
        }
    }

    private static MfaTransaction pending(String tokenHash, Instant expiresAt) {
        return MfaTransaction.pending(tokenHash, "ITEST01", MfaPurpose.LOGIN, MfaMethod.FIDO, expiresAt);
    }

    private static String newToken() {
        return "it-mfatm-" + UUID.randomUUID();
    }
}
```

- [ ] **Step 5: 로컬 Oracle로 통합 테스트 실행**

Run: `cd C:/it/it_backend && ./gradlew integrationTest --tests 'com.kdb.it.common.mfa.store.JpaMfaTransactionStoreIT'` (로컬 Oracle 필요 — 꺼져 있으면 `OracleAvailableCondition`이 전체 스킵)
Expected: BUILD SUCCESSFUL, 4개 테스트 통과.

- [ ] **Step 6: Commit**

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/common/mfa/store/MfaTransactionEntity.java \
        src/main/java/com/kdb/it/common/mfa/store/MfaTransactionJpaRepository.java \
        src/main/java/com/kdb/it/common/mfa/store/JpaMfaTransactionStore.java \
        src/test/java/com/kdb/it/common/mfa/store/JpaMfaTransactionStoreIT.java
git commit -m "feat: SEC-13 JpaMfaTransactionStore — TPRMPP_CMFATM 조건부 UPDATE 기반 원자적 전이"
```

---

## Task 4: 로그인 대기 JPA 저장소 — TPRMPP_CMFADM

**저장소:** `it_backend`

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/LoginPendingTransactionEntity.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/LoginPendingTransactionJpaRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/JpaLoginPendingTransactionStore.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/store/JpaLoginPendingTransactionStoreIT.java` (신규, `@Tag("it")`)

**Interfaces:**
- Consumes: `LoginPendingTransaction`(기존 record, 변경 없음), `BaseEntity`.
- Produces: `JpaLoginPendingTransactionStore implements LoginPendingTransactionStore`.

`TPRMPP_CMFADM`에는 상태 컬럼이 없다(사용자가 준 최종 스키마 확인). 따라서 "1회 소비" 보장은 조건부 물리 `DELETE`의 영향 행 수로만 표현한다 — `TPRMPP_CMFATM`처럼 상태 UPDATE로 표현할 수 없다.

- [ ] **Step 1: 엔티티 작성**

```java
package com.kdb.it.common.mfa.store;

import com.kdb.it.domain.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * 로그인 대기(MFA 이전) 거래 엔티티
 *
 * <p>DB 테이블: {@code TPRMPP_CMFADM}
 *
 * <p>{@link com.kdb.it.common.mfa.domain.LoginPendingTransaction}의 영속 표현이다. 상태 컬럼이 없어 1회
 * 소비는 {@link LoginPendingTransactionJpaRepository}의 조건부 물리 삭제로 표현한다.
 */
@Entity
@Table(name = "TPRMPP_CMFADM", comment = "추가인증대기기본")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class LoginPendingTransactionEntity extends BaseEntity {

    @Id
    @Column(name = "APN_CER_TR_TOK_CONE", length = 300, comment = "추가인증거래토큰내용")
    private String tokenHash;

    @Column(name = "ENO", nullable = false, length = 32, comment = "사원번호")
    private String eno;

    @Column(name = "END_DTM", nullable = false, comment = "종료일시")
    private LocalDateTime endDtm;

    /**
     * 신규 로그인 대기 거래를 생성한다. 로그인 1단계는 비인증 흐름이므로 소유자 사번을 감사자로
     * 명시적으로 기록한다.
     *
     * @param tokenHash 거래 토큰 해시(PK)
     * @param eno 거래 소유자 사번(감사자로도 함께 기록됨)
     * @param endDtm 만료 시각
     * @return 소유자 사번이 감사자로 기록된 신규 엔티티
     */
    public static LoginPendingTransactionEntity create(String tokenHash, String eno, LocalDateTime endDtm) {
        LoginPendingTransactionEntity entity =
                LoginPendingTransactionEntity.builder().tokenHash(tokenHash).eno(eno).endDtm(endDtm).build();
        entity.initializeAuditActors(eno);
        return entity;
    }
}
```

- [ ] **Step 2: 리포지토리 작성**

```java
package com.kdb.it.common.mfa.store;

import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 로그인 대기 거래({@code TPRMPP_CMFADM}) 데이터 접근 리포지토리. */
public interface LoginPendingTransactionJpaRepository
        extends JpaRepository<LoginPendingTransactionEntity, String> {

    @Query("SELECT e FROM LoginPendingTransactionEntity e WHERE e.tokenHash = :tokenHash AND e.endDtm > :now")
    Optional<LoginPendingTransactionEntity> findActiveByTokenHash(
            @Param("tokenHash") String tokenHash, @Param("now") LocalDateTime now);

    /** 상태 컬럼이 없어 1회 소비를 조건부 물리 삭제로 표현한다. 영향 행 수 1이 성공이다. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            "DELETE FROM LoginPendingTransactionEntity e "
                    + "WHERE e.tokenHash = :tokenHash AND e.eno = :eno AND e.endDtm > :now")
    int consumeOnce(
            @Param("tokenHash") String tokenHash, @Param("eno") String eno, @Param("now") LocalDateTime now);

    /** 만료 후 유예 시간이 지난 행을 물리 삭제한다(용량 관리 전용). */
    @Modifying
    @Query("DELETE FROM LoginPendingTransactionEntity e WHERE e.endDtm < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") LocalDateTime cutoff);
}
```

- [ ] **Step 3: 저장소 구현 작성**

```java
package com.kdb.it.common.mfa.store;

import com.kdb.it.common.mfa.domain.LoginPendingTransaction;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Oracle 공유 테이블({@code TPRMPP_CMFADM})로 다중 인스턴스 배포를 지원하는 로그인 대기 거래 저장소다.
 *
 * <p>상태 컬럼이 없어 1회 소비를 조건부 물리 삭제로 구현한다. 삭제 전 조회는 반환값 구성용이며, 실제
 * "정확히 한 번" 보장은 {@link LoginPendingTransactionJpaRepository#consumeOnce}의 영향 행 수가 담당한다
 * (동시 요청이 같은 행을 봐도 DELETE는 한 트랜잭션만 성공한다).
 */
@Component
public class JpaLoginPendingTransactionStore implements LoginPendingTransactionStore {

    private static final ZoneId ZONE = ZoneId.systemDefault();

    private final LoginPendingTransactionJpaRepository repository;

    public JpaLoginPendingTransactionStore(LoginPendingTransactionJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void save(LoginPendingTransaction transaction) {
        repository.save(
                LoginPendingTransactionEntity.create(
                        transaction.tokenHash(), transaction.eno(), toLocalDateTime(transaction.expiresAt())));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LoginPendingTransaction> findByTokenHash(String tokenHash, Instant now) {
        return repository.findActiveByTokenHash(tokenHash, toLocalDateTime(now)).map(this::toDomain);
    }

    @Override
    @Transactional
    public Optional<LoginPendingTransaction> consumeOnce(String tokenHash, String eno, Instant now) {
        LocalDateTime nowDtm = toLocalDateTime(now);
        Optional<LoginPendingTransactionEntity> found = repository.findActiveByTokenHash(tokenHash, nowDtm);
        if (found.isEmpty() || !found.get().getEno().equals(eno)) {
            return Optional.empty();
        }
        if (repository.consumeOnce(tokenHash, eno, nowDtm) != 1) {
            return Optional.empty();
        }
        return found.map(this::toDomain);
    }

    private LoginPendingTransaction toDomain(LoginPendingTransactionEntity entity) {
        return new LoginPendingTransaction(
                entity.getTokenHash(), entity.getEno(), toInstant(entity.getEndDtm()));
    }

    private static LocalDateTime toLocalDateTime(Instant instant) {
        return LocalDateTime.ofInstant(instant, ZONE);
    }

    private static Instant toInstant(LocalDateTime localDateTime) {
        return localDateTime.atZone(ZONE).toInstant();
    }
}
```

- [ ] **Step 4: 로컬 Oracle 통합 테스트 작성**

```java
package com.kdb.it.common.mfa.store;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.mfa.domain.LoginPendingTransaction;
import com.kdb.it.support.AbstractOracleRepositoryTest;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** JpaLoginPendingTransactionStore의 조건부 삭제 기반 1회 소비를 실 Oracle로 검증한다. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class JpaLoginPendingTransactionStoreIT extends AbstractOracleRepositoryTest {

    @Autowired private JpaLoginPendingTransactionStore store;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM TPRMPP_CMFADM WHERE ENO = ?", "ITEST01");
    }

    @Test
    @DisplayName("소유자가 소비하면 한 번만 성공하고 이후 조회되지 않는다")
    void consumeOnce_owner_succeedsExactlyOnceThenDisappears() {
        Instant now = Instant.now();
        String tokenHash = "it-mfadm-" + UUID.randomUUID();
        store.save(new LoginPendingTransaction(tokenHash, "ITEST01", now.plusSeconds(90)));

        assertThat(store.consumeOnce(tokenHash, "ITEST01", now)).isPresent();
        assertThat(store.consumeOnce(tokenHash, "ITEST01", now)).isEmpty();
        assertThat(store.findByTokenHash(tokenHash, now)).isEmpty();
    }

    @Test
    @DisplayName("다른 사용자는 소비하지 못하고 거래도 사라지지 않는다")
    void consumeOnce_otherUser_keepsTransaction() {
        Instant now = Instant.now();
        String tokenHash = "it-mfadm-" + UUID.randomUUID();
        store.save(new LoginPendingTransaction(tokenHash, "ITEST01", now.plusSeconds(90)));

        assertThat(store.consumeOnce(tokenHash, "OTHERUSR", now)).isEmpty();
        assertThat(store.findByTokenHash(tokenHash, now)).isPresent();
    }
}
```

- [ ] **Step 5: 로컬 Oracle로 통합 테스트 실행**

Run: `cd C:/it/it_backend && ./gradlew integrationTest --tests 'com.kdb.it.common.mfa.store.JpaLoginPendingTransactionStoreIT'`
Expected: BUILD SUCCESSFUL, 2개 테스트 통과.

- [ ] **Step 6: Commit**

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/common/mfa/store/LoginPendingTransactionEntity.java \
        src/main/java/com/kdb/it/common/mfa/store/LoginPendingTransactionJpaRepository.java \
        src/main/java/com/kdb/it/common/mfa/store/JpaLoginPendingTransactionStore.java \
        src/test/java/com/kdb/it/common/mfa/store/JpaLoginPendingTransactionStoreIT.java
git commit -m "feat: SEC-13 JpaLoginPendingTransactionStore — TPRMPP_CMFADM 조건부 삭제 기반 1회 소비"
```

---

## Task 5: 만료 정리 배치

**저장소:** `it_backend`

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/MfaTransactionCleanupScheduler.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/store/MfaTransactionCleanupSchedulerIT.java` (신규, `@Tag("it")`)

**Interfaces:**
- Consumes: `MfaTransactionJpaRepository.deleteExpiredBefore`(Task 3), `LoginPendingTransactionJpaRepository.deleteExpiredBefore`(Task 4), 앱 전역 `Clock` 빈(`com.kdb.it.config.ClockConfig`).

`@EnableScheduling`은 이미 `NotificationSchedulingConfig`로 전역 활성화돼 있어 별도 설정이 필요 없다.

- [ ] **Step 1: 스케줄러 작성**

```java
package com.kdb.it.common.mfa.store;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 만료 후 10분이 지난 추가인증 거래·로그인 대기 행을 물리 삭제한다.
 *
 * <p>정확성은 이 배치와 무관하다. 모든 조회·UPDATE 조건에 {@code END_DTM > now}가 들어가므로 만료 행은
 * 어떤 경로로도 사용되지 않는다. 유예 10분은 만료 직후 요청이 사유(만료/미존재)를 정확히 구분할 수 있게
 * 하는 창이며, 이 정리는 순수한 용량 관리다. 다중 인스턴스에서 여러 인스턴스가 동시에 실행해도 DELETE는
 * 멱등이라 잠금이 필요 없다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MfaTransactionCleanupScheduler {

    private static final long GRACE_MINUTES = 10;

    private final MfaTransactionJpaRepository transactionRepository;
    private final LoginPendingTransactionJpaRepository pendingRepository;
    private final Clock clock;

    @Scheduled(fixedDelayString = "${app.mfa.cleanup.fixed-delay-ms:300000}")
    @Transactional
    public void cleanup() {
        LocalDateTime cutoff =
                LocalDateTime.ofInstant(clock.instant(), ZoneId.systemDefault()).minusMinutes(GRACE_MINUTES);
        int deletedTransactions = transactionRepository.deleteExpiredBefore(cutoff);
        int deletedPending = pendingRepository.deleteExpiredBefore(cutoff);
        if (deletedTransactions > 0 || deletedPending > 0) {
            log.info(
                    "[MFA 정리] 만료 후 {}분 경과 행 삭제: 거래={}, 로그인대기={}",
                    GRACE_MINUTES,
                    deletedTransactions,
                    deletedPending);
        }
    }
}
```

- [ ] **Step 2: 로컬 Oracle 통합 테스트 작성 — 유예 경계**

```java
package com.kdb.it.common.mfa.store;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.support.AbstractOracleRepositoryTest;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 만료 후 10분 유예 경계에서 정리 배치가 올바른 행만 지우는지 실 Oracle로 검증한다. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class MfaTransactionCleanupSchedulerIT extends AbstractOracleRepositoryTest {

    @Autowired private MfaTransactionJpaRepository transactionRepository;
    @Autowired private LoginPendingTransactionJpaRepository pendingRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private static final Instant NOW = Instant.parse("2026-08-20T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM TPRMPP_CMFATM WHERE ENO = ?", "ITEST01");
        jdbcTemplate.update("DELETE FROM TPRMPP_CMFADM WHERE ENO = ?", "ITEST01");
    }

    @Test
    @DisplayName("유예 10분 이전 행은 남기고 이후 행만 지운다")
    void cleanup_deletesOnlyRowsPastGracePeriod() {
        MfaTransactionCleanupScheduler scheduler =
                new MfaTransactionCleanupScheduler(transactionRepository, pendingRepository, CLOCK);
        String withinGrace = "it-cleanup-within-" + UUID.randomUUID();
        String pastGrace = "it-cleanup-past-" + UUID.randomUUID();
        transactionRepository.save(
                MfaTransactionEntity.create(
                        withinGrace, "ITEST01", "10", "20",
                        toLocalDateTime(NOW.minusSeconds(9 * 60)), null));
        transactionRepository.save(
                MfaTransactionEntity.create(
                        pastGrace, "ITEST01", "10", "20",
                        toLocalDateTime(NOW.minusSeconds(11 * 60)), null));

        scheduler.cleanup();

        assertThat(transactionRepository.findById(withinGrace)).isPresent();
        assertThat(transactionRepository.findById(pastGrace)).isEmpty();
    }

    private static LocalDateTime toLocalDateTime(Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
    }
}
```

- [ ] **Step 3: 로컬 Oracle로 통합 테스트 실행**

Run: `cd C:/it/it_backend && ./gradlew integrationTest --tests 'com.kdb.it.common.mfa.store.MfaTransactionCleanupSchedulerIT'`
Expected: BUILD SUCCESSFUL, 1개 테스트 통과.

- [ ] **Step 4: Commit**

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/common/mfa/store/MfaTransactionCleanupScheduler.java \
        src/test/java/com/kdb/it/common/mfa/store/MfaTransactionCleanupSchedulerIT.java
git commit -m "feat: SEC-13 MFA 만료 정리 배치 — 유예 10분 후 물리 삭제"
```

---

## Task 6: 설정 토글과 운영 강제

**저장소:** `it_backend`

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStore.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/store/InMemoryLoginPendingTransactionStore.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/store/JpaMfaTransactionStore.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/store/JpaLoginPendingTransactionStore.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java`
- Modify: `it_backend/src/main/resources/application.properties`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/EnvironmentValidatorTest.java` (기존 파일에 케이스 추가 — 없으면 신규 작성)

**Interfaces:**
- Produces: `app.mfa.store`(`jpa`|`memory`, 기본 `jpa`) 프로퍼티. 스프링 컨텍스트에는 항상 정확히 한 구현만 `MfaTransactionStore`/`LoginPendingTransactionStore` 빈으로 등록된다.

Unit 테스트(`MfaServiceTest`, `InMemory*Test`)는 `new InMemoryMfaTransactionStore()`처럼 직접 생성해 스프링을 거치지 않으므로, 클래스 레벨 `@ConditionalOnProperty` 추가는 이 테스트들에 영향을 주지 않는다.

- [ ] **Step 1: InMemory 구현에 조건 추가**

`InMemoryMfaTransactionStore.java`의 `@Component` 바로 위에 추가하고 import 추가:

```java
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
```

```java
@Component
@ConditionalOnProperty(prefix = "app.mfa", name = "store", havingValue = "memory")
public class InMemoryMfaTransactionStore implements MfaTransactionStore {
```

`InMemoryLoginPendingTransactionStore.java`도 동일하게:

```java
@Component
@ConditionalOnProperty(prefix = "app.mfa", name = "store", havingValue = "memory")
public class InMemoryLoginPendingTransactionStore implements LoginPendingTransactionStore {
```

- [ ] **Step 2: Jpa 구현에 조건 추가**

`JpaMfaTransactionStore.java`의 `@Component` 바로 위에 추가:

```java
@Component
@ConditionalOnProperty(prefix = "app.mfa", name = "store", havingValue = "jpa", matchIfMissing = true)
public class JpaMfaTransactionStore implements MfaTransactionStore {
```

`JpaLoginPendingTransactionStore.java`도 동일하게:

```java
@Component
@ConditionalOnProperty(prefix = "app.mfa", name = "store", havingValue = "jpa", matchIfMissing = true)
public class JpaLoginPendingTransactionStore implements LoginPendingTransactionStore {
```

두 파일 모두 `import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;` 추가.

- [ ] **Step 3: 기본값을 application.properties에 명시**

`it_backend/src/main/resources/application.properties`의 118행(`app.mfa.max-failures=5`) 다음 줄에 추가:

```properties
app.mfa.store=jpa
```

- [ ] **Step 4: EnvironmentValidator에 운영 강제 추가**

`EnvironmentValidator.java`의 `validateProdKeys()` 메서드(87~123행) 마지막 줄(`frontendUrl` 검증 다음) 앞에 추가:

```java

        String mfaStore = environment.getProperty("app.mfa.store", "jpa");
        if ("memory".equalsIgnoreCase(mfaStore)) {
            throw securityViolation("app.mfa.store");
        }
```

클래스 상단 Javadoc의 검증 대상 목록(22~26행)에도 한 줄 추가:

```java
 *       cors.allowed-origins}(와일드카드 금지)/{@code app.sso.allow-direct-eno}(false 고정)/{@code
 *       app.mfa.store}(운영 memory 금지 — SEC-13)/{@code
 *       app.frontend-url}/{@code springdoc.api-docs.enabled}(false 고정)/{@code
```

- [ ] **Step 5: EnvironmentValidator 테스트에 케이스 추가**

기존 `EnvironmentValidatorTest`의 운영 프로파일 위반 케이스들과 같은 패턴으로 추가(파일이 이미 있다면 기존 `MockEnvironment` 구성을 그대로 따르고, 없다면 아래 클래스를 새로 만든다):

```java
    @Test
    @DisplayName("운영 프로파일에서 app.mfa.store=memory는 기동을 차단한다")
    void 운영에서_mfa_store가_memory면_기동을_차단한다() {
        MockEnvironment environment = prodEnvironmentWithAllRequiredKeys();
        environment.setProperty("app.mfa.store", "memory");
        EnvironmentValidator validator = new EnvironmentValidator(environment);

        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.mfa.store");
    }
```

(`prodEnvironmentWithAllRequiredKeys()`는 기존 테스트 파일에 이미 있는 헬퍼를 그대로 재사용한다. 없다면 기존 "운영 프로파일 필수 키 통과" 테스트가 구성하는 것과 동일한 `MockEnvironment`를 헬퍼로 추출해 재사용한다.)

- [ ] **Step 6: 테스트 실행**

Run: `cd C:/it/it_backend && ./gradlew test --tests 'com.kdb.it.common.system.EnvironmentValidatorTest' --tests 'com.kdb.it.common.mfa.*'`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: 전체 유닛 테스트 실행(스프링 컨텍스트 로딩 테스트 포함)**

Run: `cd C:/it/it_backend && ./gradlew test`
Expected: BUILD SUCCESSFUL. 특히 `MfaConfigurationTest`나 `@SpringBootTest` 부류가 `MfaTransactionStore`/`LoginPendingTransactionStore` 빈을 정확히 하나씩만 찾는지 확인 — 실패하면 `NoUniqueBeanDefinitionException` 또는 `NoSuchBeanDefinitionException` 메시지로 어느 쪽 조건이 어긋났는지 알 수 있다.

- [ ] **Step 8: Commit**

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStore.java \
        src/main/java/com/kdb/it/common/mfa/store/InMemoryLoginPendingTransactionStore.java \
        src/main/java/com/kdb/it/common/mfa/store/JpaMfaTransactionStore.java \
        src/main/java/com/kdb/it/common/mfa/store/JpaLoginPendingTransactionStore.java \
        src/main/java/com/kdb/it/common/system/EnvironmentValidator.java \
        src/main/resources/application.properties \
        src/test/java/com/kdb/it/common/system/EnvironmentValidatorTest.java
git commit -m "feat: SEC-13 app.mfa.store 토글 — 기본 jpa, 운영 memory 강제 차단"
```

---

## Task 7: 문서 정리

**저장소:** `it_backend`(1개 파일), `C:\it`(2개 파일)

**Files:**
- Modify: `it_backend/docs/guides/persistence/data-model.md`
- Modify: `C:/it/TASK.md`
- Modify: `C:/it/TASK_DONE.md`

**Interfaces:** 없음(문서 전용, 비즈니스 로직 변경 없음).

- [ ] **Step 1: data-model.md에 신규 테이블 등재**

`it_backend/docs/guides/persistence/data-model.md`의 "주요 매핑" 표(14~25행)에 행 추가(공통·인프라 행 다음, 26행 앞):

```markdown
| 추가인증(MFA) | `MfaTransactionEntity/TPRMPP_CMFATM`, `LoginPendingTransactionEntity/TPRMPP_CMFADM`     |
```

- [ ] **Step 2: TASK.md에서 SEC-13 제거**

`C:/it/TASK.md`에서 SEC-13 행을 정확히 삭제(표의 다른 행에는 손대지 않는다):

```
| SEC-13 |     🟢 Low      | MFA  | MFA 거래의 다중 인스턴스 지원         | 로그인 대기·MFA 거래를 애플리케이션 메모리에만 두어 서버 재시작 시 진행 중 거래가 모두 폐기되고, 다중 인스턴스 배포를 지원하지 않는다(설계 §8에서 이번 범위 제외). 필요해지면 `MfaTransactionStore`·`LoginPendingTransactionStore` 인터페이스를 공유 캐시 구현으로 교체한다.
```

이어서 §범위 밖에서 밝힌 후속 과제(FidoMfaProvider 로컬 맵, svcTrId 미기록)를 새 항목으로 추가한다. 기존 SEC 표의 컬럼 형식(`ID | 우선순위 | 유형 | 과제 | 근거/조건`)을 그대로 따라 다음 행을 SEC-13이 있던 자리에 추가:

```
| SEC-14 |     🟢 Low      | MFA  | FIDO 폴링의 인스턴스 로컬 상태          | SEC-13로 거래 저장소는 Oracle 공유 테이블로 옮겼지만 `FidoMfaProvider.pendingByTransactionId`(OnePass `svcTrId`)와 `MfaService`의 만료·취소 판별용 로컬 맵은 여전히 인스턴스 메모리에 있다. 폴링이 challenge를 시작한 인스턴스가 아닌 곳으로 가면 `undecided()` 대신 `failure()`가 반환돼 약 15초 만에 거래가 잠긴다(설계 §2). `TPRMPP_CMFATM.APN_CER_SVC_TR_NO`는 이 값을 담기 위해 이미 마련돼 있으나 아직 어떤 코드도 채우지 않는다. 다중 인스턴스 배포 직전에 `MfaChallengeData`·`MfaVerifyContext`에 `providerTransactionId`를 추가하고 `FidoMfaProvider`가 컨텍스트로 값을 주고받도록 고쳐야 한다.
```

- [ ] **Step 3: TASK_DONE.md에 완료 기록 추가**

`C:/it/TASK_DONE.md`의 "🗂️ 진행 중에서 종료된 항목" 아래(가장 최근 항목 앞)에 추가:

```markdown
### ✅ 2026-08-20 SEC-13 MFA 거래·로그인 대기 저장소를 Oracle 공유 테이블로 교체

`InMemoryMfaTransactionStore`/`InMemoryLoginPendingTransactionStore`만 있던 저장소에
`JpaMfaTransactionStore`/`JpaLoginPendingTransactionStore`를 추가해 `app.mfa.store`(기본
`jpa`)로 전환했다. `TPRMPP_CMFATM`/`TPRMPP_CMFADM` 두 테이블 모두 `BaseEntity`를 상속해
감사 컬럼을 남기며, 상태 전이는 조건부 `UPDATE`(TPRMPP_CMFATM) 또는 조건부 `DELETE`
(TPRMPP_CMFADM, 상태 컬럼 없음) 한 문장으로 원자성을 얻는다. `EnvironmentValidator`가 운영
프로파일에서 `app.mfa.store=memory`를 기동 실패로 막는다.

| 상태 | 항목 | 조치 | 저장소 커밋 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | SEC-13 | 테이블 2건, Jpa 저장소 2건, 정리 배치, 설정 토글, 운영 강제 | it_database `<커밋 SHA>`, it_backend `<커밋 SHA>` | `./gradlew test` BUILD SUCCESSFUL, `./gradlew integrationTest --tests '*Mfa*IT'` BUILD SUCCESSFUL(로컬 Oracle) |

**범위 밖으로 남긴 것**: `FidoMfaProvider`의 인스턴스 로컬 `svcTrId` 맵과 `MfaService`의 로컬
만료·취소 추적 맵은 저장소 인터페이스 밖에 있어 이번 교체로 해소되지 않는다. `TASK.md` SEC-14로
후속 등록.
```

`<커밋 SHA>` 두 곳은 Task 1~6의 실제 커밋 해시로 채운다(예: `git -C it_database log --oneline -1`, `git -C it_backend log --oneline -1`로 확인).

- [ ] **Step 4: Commit (저장소별로 분리)**

```bash
cd C:/it/it_backend
git add docs/guides/persistence/data-model.md
git commit -m "docs: SEC-13 추가인증 테이블을 데이터 모델 인덱스에 등재"
```

```bash
cd C:/it
git add TASK.md TASK_DONE.md
git commit -m "docs: SEC-13 완료 이관, FIDO 인스턴스 로컬 상태를 SEC-14로 후속 등록"
```

---

## 최종 확인

모든 Task 완료 후:

```bash
cd C:/it/it_backend
./gradlew test
./gradlew integrationTest --tests '*Mfa*IT'
./gradlew check
```

```bash
cd C:/it
./scripts/update-versions-lock.ps1
```
