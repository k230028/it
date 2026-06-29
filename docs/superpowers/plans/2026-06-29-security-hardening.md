# 보안 하드닝 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TASK.md` 보안 7건·에러처리 잔여를 전수 조치 — Bearer 헤더 gate, Refresh Token 재사용 탐지(토큰 패밀리), changeStatus ADMIN 전용, Tiptap metadata 부서 필터, SSO 운영 안전장치 보강, 관리자 API JWT 경계 검증.

**Architecture:** Phase 0(백로그 정비) 선행 후 PR-1(토큰 하드닝)·PR-2(권한 강화)·PR-3(운영검증+테스트). 동작 변경(#1·#5·#7)은 TDD로 회귀 격리. 통합테스트 인프라 부재(T18)로 #5는 Mockito 단위 + Flyway 적용 기동 검증.

**Tech Stack:** Spring Boot 4.1 / Java 25 / Spring Security + JWT / QueryDSL / Oracle + Flyway (백엔드), Vitest/Playwright (프론트). 테스트: JUnit5 + Mockito + BDDMockito + @WebMvcTest.

**설계 문서:** [`2026-06-29-security-hardening-design.md`](../specs/2026-06-29-security-hardening-design.md)

**확정된 결정:** #1 Bearer 운영 비활성화(config gate) · #4 Blocklist 감내(미구현·문서화) · #5 T10 재사용 탐지 구현 · #6 부서(bbrC) 필터 · #7 changeStatus ADMIN 전용.

**저장소:** parent `C:\it`(docs), `C:\it\it_backend`, `C:\it\it_frontend`, `C:\it\it_database`(마이그레이션은 it_backend가 classpath 포함). it_backend/it_frontend는 별도 git repo — 각 repo에서 커밋.

**범위 외:** #4 Blocklist 구현, Bearer/frontend-url 운영값 주입(ops/배포).

**재검증 보정(설계 대비):** #3은 대부분 이미 구현됨 — `EnvironmentValidator.validateProdKeys()`가 `app.sso.allow-direct-eno`/`app.frontend-url`/cors 와일드카드를 이미 검증, `getClientIp`는 `ClientIpResolver`(trusted-proxy allowlist)로 이미 리팩터됨. #3 잔여는 `app.dev.user-switch.enabled` 운영 가드 추가 + 문서 정정뿐. #2는 프론트 가드가 쿠키 신뢰형이라 실질 경계는 백엔드 JWT → 백엔드 테스트 중심.

---

## 진행 순서
Phase 0(parent) → PR-1(it_backend) → PR-2(it_backend) → PR-3(it_backend + it_frontend).

---

# Phase 0 — 백로그 정비 (parent repo `C:\it`)

## Task 0: TASK.md 보안/에러처리 정비

**Files:** Modify `C:\it\TASK.md`, `C:\it\TASK_DONE.md`

- [ ] **Step 1: 에러처리 stale 종료**

`TASK.md` ⚠️ 에러처리 §의 "클래스 JavaDoc 누락 컨트롤러 소수 잔여 (PR-2 처리 예정)" 행 제거 → `TASK_DONE.md`에 "2026-06-29 보안하드닝 정비"로 이관(근거: W2b PR-2 `30dc249` — AdminMenuController/AdminRouteController/MenuQueryController 클래스 JavaDoc 보강 완료). 에러처리 §가 비면 "✅ 잔여 없음" 노트로 정리.

- [ ] **Step 2: #4 Blocklist 감내 처리**

🔒 보안 §의 "Access Token Blocklist 도입 검토" 행 상태를 `⬜ Open` → `☑️ Accepted`로 변경하고 과제 셀에 근거 추가: "감내(2026-06-29 결정): stateless JWT·access 15분 단기·사내 3천명. 로그아웃 시 refresh 삭제 + T10 재사용 탐지로 탈취 대응. 잔존 access(최대 15분)는 수용."

- [ ] **Step 3: 보안 진행 노트 + 커밋**

"🚧 진행 중" 최상단에 노트 추가(기존 보존): "🕒 최종 업데이트: 2026-06-29 (보안 하드닝 착수 — 보안 7건 plan `docs/superpowers/plans/2026-06-29-security-hardening.md`·design `...specs/2026-06-29-security-hardening-design.md`. #4 Blocklist 감내, 에러처리 JavaDoc 종료)".
```bash
cd /c/it && git add TASK.md TASK_DONE.md
git commit -m "docs: 보안 하드닝 착수 — 에러처리 JavaDoc 종료·#4 Blocklist 감내 (TASK)"
```

---

# PR-1 — 토큰 하드닝 (it_backend)

## Task 1: #1 Authorization Bearer 헤더 폴백 gate

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java`
- Modify: `it_backend/src/main/resources/application.properties` (+ dev/local-ext/local-int 프로파일)
- Modify: `it_backend/CLAUDE.md` (§5.6)
- Test: `it_backend/src/test/java/com/kdb/it/common/system/security/JwtAuthenticationFilterTest.java` (없으면 생성)

- [ ] **Step 1: 실패 테스트 작성**

필터는 `@RequiredArgsConstructor`(JwtUtil 단일 의존) + 신규 `@Value` 플래그. 직접 단위테스트 — `MockHttpServletRequest`에 Bearer 헤더만 주고 `doFilterInternal` 호출 후 `SecurityContextHolder` 인증 설정 여부 검증. 신규 파일:
```java
package com.kdb.it.common.system.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.*;
import org.mockito.Mockito;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterTest {

    private JwtUtil jwtUtil;
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        jwtUtil = Mockito.mock(JwtUtil.class);
        filter = new JwtAuthenticationFilter(jwtUtil);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() { SecurityContextHolder.clearContext(); }

    @Test
    @DisplayName("allowBearerHeader=false 면 Authorization Bearer 토큰을 무시한다(쿠키 전용)")
    void bearerIgnored_whenFlagFalse() throws Exception {
        ReflectionTestUtils.setField(filter, "allowBearerHeader", false);
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer some.jwt.token");
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, new MockHttpServletResponse(), chain);

        // 토큰 추출 자체가 일어나지 않아야 함 → validateToken 미호출, 인증 미설정
        verify(jwtUtil, never()).validateToken(anyString());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(any(), any());
    }

    @Test
    @DisplayName("allowBearerHeader=true 면 Authorization Bearer 토큰을 추출·검증한다")
    void bearerUsed_whenFlagTrue() throws Exception {
        ReflectionTestUtils.setField(filter, "allowBearerHeader", true);
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer some.jwt.token");
        when(jwtUtil.validateToken("some.jwt.token")).thenReturn(false); // 검증 시도됨을 확인(이후 분기는 무관)
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, new MockHttpServletResponse(), chain);

        verify(jwtUtil, times(1)).validateToken("some.jwt.token");
        verify(chain).doFilter(any(), any());
    }
}
```
(필드명 `allowBearerHeader`는 Step 3에서 추가할 `@Value` 필드명과 일치. `doFilterInternal`이 `getJwtFromRequest`→`jwtUtil.validateToken`을 호출하는 기존 흐름 전제. 실제 `doFilterInternal` 시그니처/검증 호출 지점을 파일에서 확인 후 stub 대상 메서드명 맞춤.)

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.JwtAuthenticationFilterTest"`
Expected: FAIL (현재 플래그 필드 없음 → 컴파일 에러/인증 동작 불일치)

- [ ] **Step 3: 필터에 @Value 플래그 + Bearer 분기 가드**

`JwtAuthenticationFilter`에 필드 추가(클래스 본문, `jwtUtil` 아래):
```java
    /** Authorization: Bearer 헤더 폴백 허용 여부 (운영 기본 false, dev/swagger만 true). XSS 2차 탈취 경로 차단 */
    @org.springframework.beans.factory.annotation.Value("${app.auth.allow-bearer-header:false}")
    private boolean allowBearerHeader;
```
(`@RequiredArgsConstructor`는 final 필드만 생성자 주입 — `allowBearerHeader`는 non-final `@Value`라 생성자 무관, 테스트는 ReflectionTestUtils로 주입. JwtUtil 생성자 시그니처 유지.)

`getJwtFromRequest`의 Bearer 블록(L165-169)을 가드:
```java
        // 2. Authorization 헤더에서 Bearer 토큰 추출 (폴백) — 운영 비활성화 가능 (app.auth.allow-bearer-header)
        if (allowBearerHeader) {
            String bearerToken = request.getHeader("Authorization");
            if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
                return bearerToken.substring(7); // "Bearer ".length() == 7
            }
        }

        return null; // 쿠키/헤더 모두 없음
```

- [ ] **Step 4: 프로퍼티 추가**

`src/main/resources/application.properties` 안전토글 블록(L62-66 부근, `app.sso.allow-direct-eno=false` 인근)에 추가:
```properties
# Authorization: Bearer 헤더 폴백 — 운영 기본 차단(쿠키 전용). dev/swagger 프로파일만 활성.
app.auth.allow-bearer-header=false
```
`application-dev.properties`, `application-local-ext.properties`, `application-local-int.properties` 각각에 추가:
```properties
app.auth.allow-bearer-header=true
```
(`application-prod.properties`는 추가하지 않음 → base 기본 false 상속. **`bin/main`/`build/resources` 사본은 편집 금지**.)

- [ ] **Step 5: 통과 + 인증 회귀 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.*"`
Expected: PASS. 쿠키 기반 인증 기존 테스트 그대로 통과(쿠키 경로 미변경).

- [ ] **Step 6: CLAUDE.md 갱신 + 커밋**

`it_backend/CLAUDE.md` §5.6 "토큰 추출 우선순위"에 게이트 명시: "Bearer 헤더 폴백은 `app.auth.allow-bearer-header`(운영 기본 false)로 게이트 — 운영은 쿠키 전용, dev/swagger만 헤더 허용."
```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java src/main/resources/application*.properties src/test/java/com/kdb/it/common/system/security/JwtAuthenticationFilterTest.java CLAUDE.md
git commit -m "feat: Authorization Bearer 헤더 폴백 운영 비활성화 게이트 (TASK 보안 #1)"
```

## Task 2: #5 Refresh Token 패밀리 스키마 + Crtokm 엔티티

**Files:**
- Create: `it_database/migrations/V20260629_001__AddRefreshTokenFamily.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/entity/Crtokm.java`

> `TPRMPP_CRTOKM`에 패밀리ID + 회전표식 컬럼 추가. 재사용 탐지의 데이터 기반.

- [ ] **Step 1: Flyway 마이그레이션 작성 (멱등 PL/SQL)**

`V20260627_001` 가드 패턴 차용. 신규 파일:
```sql
-- V20260629_001__AddRefreshTokenFamily.sql
-- Refresh Token 재사용 탐지(T10)용 컬럼 추가: ATR_GRP_ID(속성그룹=토큰패밀리, 로그인 1회), USE_YN(사용여부; N=회전된 구토큰).
-- 가산형(추가만)·멱등: 동일 컬럼 존재 시 건너뜀.
DECLARE
    FUNCTION col_exists(p_tab VARCHAR2, p_col VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n FROM ALL_TAB_COLUMNS
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND TABLE_NAME = p_tab AND COLUMN_NAME = p_col;
        RETURN n > 0;
    END;
BEGIN
    IF NOT col_exists('TPRMPP_CRTOKM', 'ATR_GRP_ID') THEN
        EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CRTOKM ADD (ATR_GRP_ID VARCHAR2(50 CHAR) DEFAULT ''LEGACY'' NOT NULL)';
        EXECUTE IMMEDIATE 'COMMENT ON COLUMN TPRMPP_CRTOKM.ATR_GRP_ID IS ''속성그룹ID(토큰패밀리=로그인 1회, 재사용 탐지용)''';
    END IF;
    IF NOT col_exists('TPRMPP_CRTOKM', 'USE_YN') THEN
        EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CRTOKM ADD (USE_YN VARCHAR2(1 CHAR) DEFAULT ''Y'' NOT NULL)';
        EXECUTE IMMEDIATE 'COMMENT ON COLUMN TPRMPP_CRTOKM.USE_YN IS ''사용여부(Y=활성 토큰, N=회전된 구토큰 → 재제출 시 재사용 탐지)''';
    END IF;
END;
/
```
(메타표준 컬럼명: `ATR_GRP_ID`=속성그룹ID(50), `USE_YN`=사용여부(1). `DEFAULT 'LEGACY'`/`'Y'`(기존 행=활성)으로 백필. local-ext/local-int 기동 시 자동 적용.)

- [ ] **Step 2: Crtokm 엔티티 필드 + 회전 표식 메서드 추가**

`Crtokm.java`에 `endDtm` 필드(L80-81) 아래 추가:
```java
    /** 속성그룹ID — 토큰패밀리(로그인 1회=1패밀리). 재사용 탐지 시 패밀리 단위 폐기 기준 */
    @Column(name = "ATR_GRP_ID", nullable = false, length = 50, comment = "속성그룹ID")
    private String atrGrpId;

    /** 사용여부 — 'Y'=활성 토큰, 'N'=회전된 구 토큰. 'N' 토큰이 재제출되면 재사용(탈취)으로 판단 */
    @Column(name = "USE_YN", nullable = false, length = 1, comment = "사용여부")
    private String useYn;
```
`isExpired()`(L88-90) 아래에 표식 메서드 추가:
```java
    /** 회전 표식 — 신규 토큰 발급 후 이 토큰을 '회전됨(비활성)'으로 표시(삭제 대신 유지하여 재사용 탐지) */
    public void markRotated() {
        this.useYn = "N";
    }

    /** 회전된(이미 사용된) 토큰인지 — USE_YN='N' */
    public boolean isRotated() {
        return "N".equals(this.useYn);
    }
```
(`@SuperBuilder`이므로 빌더에 `.atrGrpId(...).useYn("Y")` 사용 가능. `@Getter`가 `getAtrGrpId()`/`getUseYn()` 생성. 신규 토큰은 `useYn="Y"`(활성), 회전된 구토큰은 `markRotated()`로 `"N"`.)

- [ ] **Step 3: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/entity/Crtokm.java ../it_database/migrations/V20260629_001__AddRefreshTokenFamily.sql
git commit -m "feat: Crtokm 토큰 패밀리/회전 표식 컬럼 + Flyway 마이그레이션 (TASK 보안 #5 T10)"
```
(it_database가 별도 repo면 해당 repo에서 마이그레이션 별도 커밋. it_backend `processResources`가 classpath 포함.)

## Task 3: #5 AuthService 패밀리 회전 + 재사용 탐지

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`

> 4개 토큰 발급 경로(login·refresh·issueDevSwitchTokens·issueSsoTokens)에 패밀리 적용. 회전 시 구 토큰 유지(markRotated)·신규 동일 패밀리 저장. 재사용(회전된 토큰 재제출) 시 패밀리 전체 폐기(deleteByEno).

- [ ] **Step 0: findByEno 사용처 확인 (다중행 안전성)**

회전된 토큰을 유지하면 eno당 행이 여러 개가 됨. `findByEno`(단건 Optional)가 다중행 시 예외나므로 사용처 확인:
```bash
cd it_backend && git grep -n "refreshTokenRepository.findByEno\|\.findByEno(" -- 'src/main/*system*'
```
사용처가 활성 토큰 1건을 기대하면 해당 호출을 `findByTokCone` 기반 또는 활성 필터로 교체. (현재 AuthService는 `findByTokCone`/`deleteByEno`만 사용 — findByEno 미사용이면 영향 없음. 결과를 보고.)

- [ ] **Step 1: 실패 테스트 — 재사용 탐지 + 회전 유지**

`AuthServiceTest`에 추가(기존 `refreshAccessToken_회전` L248 패턴 미러). 재사용 탐지: 회전된(USE_YN=N) 토큰 재제출 → `deleteByEno`(패밀리 폐기) 호출 + 예외:
```java
    @Test
    @DisplayName("refreshAccessToken - 재사용 탐지: 이미 회전된 토큰 재제출 시 패밀리 폐기 후 예외")
    void refreshAccessToken_재사용탐지_패밀리폐기() {
        String reused = "rotated-old-token";
        Crtokm rotated = Crtokm.builder()
                .tokCone(reused).eno("10001").atrGrpId("FAM-1").useYn("N")
                .endDtm(LocalDateTime.now().plusDays(7))
                .build();
        given(jwtUtil.validateToken(reused)).willReturn(true);
        given(refreshTokenRepository.findByTokCone(reused)).willReturn(Optional.of(rotated));

        assertThatThrownBy(() -> authService.refreshAccessToken(reused))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("재사용");
        verify(refreshTokenRepository, times(1)).deleteByEno("10001");
        verify(refreshTokenRepository, never()).save(any(Crtokm.class));
    }

    @Test
    @DisplayName("refreshAccessToken - 정상 회전: 구 토큰 markRotated 유지 + 신규 동일 패밀리 저장")
    void refreshAccessToken_정상회전_구토큰유지() {
        String oldRefresh = "active-token";
        Crtokm stored = Crtokm.builder()
                .tokCone(oldRefresh).eno("10001").atrGrpId("FAM-1").useYn("Y")
                .endDtm(LocalDateTime.now().plusDays(7))
                .build();
        given(jwtUtil.validateToken(oldRefresh)).willReturn(true);
        given(refreshTokenRepository.findByTokCone(oldRefresh)).willReturn(Optional.of(stored));
        given(userRepository.findByEno("10001")).willReturn(Optional.of(
                CuserI.builder().eno("10001").usrNm("홍길동").bbrC("BBR001").delYn("N").build()));
        given(roleRepository.findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N")).willReturn(Collections.emptyList());
        given(jwtUtil.generateAccessToken(anyString(), anyList(), any())).willReturn("new-access");
        given(jwtUtil.generateRefreshToken("10001")).willReturn("new-refresh");

        authService.refreshAccessToken(oldRefresh);

        assertThat(stored.isRotated()).isTrue();              // 구 토큰 회전 표식(삭제 아님)
        verify(refreshTokenRepository, never()).delete(stored); // 삭제하지 않고 유지
        verify(refreshTokenRepository, times(2)).save(any(Crtokm.class)); // 구(표식 저장)+신규
    }
```
(기존 `refreshAccessToken_회전_새RefreshToken발급` L248은 `delete(stored)`+`save 1회`를 단언 — 새 동작과 충돌하므로 Step 4에서 갱신.)

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest.refreshAccessToken_재사용탐지_패밀리폐기"`
Expected: FAIL.

- [ ] **Step 3: AuthService 재작업**

(a) 발급 헬퍼 추가(클래스 본문) — 신규 패밀리로 토큰 발급(login/devSwitch/sso 공통):
```java
    /**
     * 신규 패밀리로 Refresh Token 발급·저장 (로그인/SSO/개발스위치 진입점).
     *
     * <p>기존 토큰을 모두 삭제(1인 1패밀리)하고 새 패밀리ID로 ACTIVE 토큰을 저장한다.</p>
     */
    private String issueNewRefreshFamily(String eno) {
        refreshTokenRepository.deleteByEno(eno);
        String value = jwtUtil.generateRefreshToken(eno);
        Crtokm token = Crtokm.builder()
                .tokCone(value).eno(eno)
                .atrGrpId(java.util.UUID.randomUUID().toString())
                .useYn("Y")
                .endDtm(LocalDateTime.now().plus(Duration.ofMillis(refreshTokenValidityMs)))
                .build();
        refreshTokenRepository.save(token);
        return value;
    }
```
(b) `login`(L184-191)·`issueDevSwitchTokens`(~L313-341)·`issueSsoTokens`(~L369-397)의 `deleteByEno`+빌드+save 블록을 `String refreshTokenValue = issueNewRefreshFamily(eno);`로 교체(각 메서드의 토큰값 변수명에 맞춤).
(c) `refreshAccessToken`(L237-265) 재작업 — findByTokCone 이후:
```java
        Crtokm refreshToken = refreshTokenRepository.findByTokCone(refreshTokenValue)
                .orElseThrow(() -> new RuntimeException("Refresh Token을 찾을 수 없습니다."));

        // 재사용 탐지: 이미 회전된(USE_YN='N') 구 토큰이 재제출되면 탈취로 간주 → 패밀리 전체 폐기
        if (refreshToken.isRotated()) {
            log.warn("Refresh Token 재사용 탐지 — 패밀리 폐기: eno={}, atrGrpId={}", refreshToken.getEno(), refreshToken.getAtrGrpId());
            refreshTokenRepository.deleteByEno(refreshToken.getEno());
            throw new RuntimeException("토큰 재사용이 탐지되어 세션이 폐기되었습니다. 다시 로그인하세요.");
        }

        if (refreshToken.isExpired()) {
            refreshTokenRepository.delete(refreshToken);
            throw new RuntimeException("만료된 Refresh Token입니다.");
        }

        String eno = refreshToken.getEno();
        CuserI user = userRepository.findByEno(eno)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        List<String> athIds = loadAthIds(eno);
        String newAccessToken = jwtUtil.generateAccessToken(eno, athIds, user.getBbrC());

        // 회전: 구 토큰을 삭제하지 않고 '회전됨' 표식 유지(재사용 탐지용), 신규 토큰을 동일 패밀리로 저장
        refreshToken.markRotated();
        refreshTokenRepository.save(refreshToken);
        String newRefreshTokenValue = jwtUtil.generateRefreshToken(eno);
        Crtokm rotated = Crtokm.builder()
                .tokCone(newRefreshTokenValue).eno(eno)
                .atrGrpId(refreshToken.getAtrGrpId())
                .useYn("Y")
                .endDtm(LocalDateTime.now().plus(Duration.ofMillis(refreshTokenValidityMs)))
                .build();
        refreshTokenRepository.save(rotated);

        return AuthDto.RefreshResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshTokenValue)
                .build();
```
(`log`은 `@Slf4j` 필요 — 클래스에 없으면 `import lombok.extern.slf4j.Slf4j;` + `@Slf4j` 추가. 확인 후 적용.)

- [ ] **Step 4: 기존 회전 테스트 갱신 + 전체 통과**

기존 `refreshAccessToken_회전_새RefreshToken발급`(L248-274)의 단언을 새 동작에 맞춤: `verify(...).delete(stored)` 제거, `verify(...).save(any())`를 `times(2)`로(구 표식 + 신규), `stored` 빌더에 `.atrGrpId("FAM-1").useYn("Y")` 추가, 응답 토큰 단언 유지. `refreshAccessToken_DB토큰없음_예외발생`(L355)은 그대로 유지(미발견은 여전히 거부).
Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"`
Expected: PASS (신규 2 + 갱신 + 기존 login/logout 등).

- [ ] **Step 5: Commit**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/service/AuthService.java src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java
git commit -m "feat: Refresh Token 패밀리 회전 + 재사용 탐지 (TASK 보안 #5 T10)"
```

---

# PR-2 — 권한 강화 (it_backend)

## Task 4: #7 changeStatus ADMIN 전용 전이

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/OwnershipVerifier.java`
- Modify: `EstimateService.java`, `DeliberationService.java`, `ContractService.java`, `PaymentService.java` (각 `changeStatus`)
- Modify: `it_backend/CLAUDE.md` (§5.18)
- Test: `EstimateServiceTest.java`, `DeliberationServiceTest.java`, `ContractServiceTest.java`, `PaymentServiceTest.java`

> **동작 변경**: 상태전이를 소유자→ADMIN 전용으로 제한. update/delete/save* 등 다른 경로의 `verifyOwnerOrAdmin`은 유지.

- [ ] **Step 1: OwnershipVerifier.verifyAdmin 추가**

`OwnershipVerifier.java`에 메서드 추가(기존 `verifyOwnerOrAdmin` 아래, `AccessDeniedException` import 존재):
```java
    /**
     * 시스템관리자(ADMIN) 전용 작업 검증. ADMIN이 아니면 {@link AccessDeniedException}.
     *
     * @param user 현재 인증 사용자
     * @throws AccessDeniedException 인증 정보가 없거나 ADMIN이 아닌 경우
     */
    public static void verifyAdmin(CustomUserDetails user) {
        if (user == null) {
            throw new AccessDeniedException("인증 정보가 없습니다.");
        }
        if (!user.isAdmin()) {
            throw new AccessDeniedException("관리자만 수행할 수 있습니다.");
        }
    }
```

- [ ] **Step 2: 실패 테스트 — 소유자(비ADMIN) 거부**

`EstimateServiceTest`에 추가(기존 `changeStatus_deniedForOther` 패턴; `requester()`는 소유자이나 비ADMIN):
```java
    @Test
    @DisplayName("소유자라도 ADMIN이 아니면 상태전이 거부")
    void changeStatus_deniedForNonAdminOwner() {
        when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                .thenReturn(Optional.of(draftOwnedByE0001())); // fstEnrUsid=E0001
        // requester()=E0001(소유자, ITPZZ001) — 소유자지만 비ADMIN → 거부
        assertThatThrownBy(() -> service.changeStatus("REQ-2026-0001", new EstimateDto.StatusRequest("55"), requester()))
                .isInstanceOf(AccessDeniedException.class);
    }
```

- [ ] **Step 3: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.estimate.service.EstimateServiceTest.changeStatus_deniedForNonAdminOwner"`
Expected: FAIL (현재 소유자 허용).

- [ ] **Step 4: 4개 서비스 changeStatus를 ADMIN 전용으로 변경**

각 서비스 `changeStatus`에서 `OwnershipVerifier.verifyOwnerOrAdmin(e.getFstEnrUsid(), user);` → `OwnershipVerifier.verifyAdmin(user);` 로 교체. 인접 상태전이 검증·`bprojaSyncService.upsert`는 그대로 유지. 예 — EstimateService L132:
```java
        Bestim e = loadCurrent(docNo);
        OwnershipVerifier.verifyAdmin(user);
        String from = e.getStsTc();
```
Deliberation/Contract/Payment 동일(L127/L127/L134).

- [ ] **Step 5: 기존 changeStatus 성공 테스트를 admin()으로 갱신 + 전체 통과**

각 ServiceTest에서 `changeStatus`가 성공해야 하는 테스트(예: Estimate `changeStatus_submitAllowed` L271, `changeStatus_completeAllowed` L281)는 호출자를 `requester()` → `admin()`으로 교체(비ADMIN은 이제 거부됨). 역행/건너뛰기 거부 테스트도 `admin()`으로 호출해 "ADMIN이어도 비인접 전이는 IllegalState" 의미로 갱신. 기존 `changeStatus_deniedForOther`(타인)는 AccessDenied 그대로 유효(유지). Deliberation/Contract/Payment 테스트 동일 갱신.
Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.estimate.service.EstimateServiceTest" --tests "com.kdb.it.domain.deliberation.service.DeliberationServiceTest" --tests "com.kdb.it.domain.contract.service.ContractServiceTest" --tests "com.kdb.it.domain.payment.service.PaymentServiceTest"`
Expected: PASS.

- [ ] **Step 6: CLAUDE.md + 커밋**

`it_backend/CLAUDE.md` §5.18 "changeStatus 역할 분기 미적용 추적 중" 문구를 "changeStatus 상태전이는 ADMIN 전용(2026-06-29 적용)"으로 갱신.
```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/security/OwnershipVerifier.java src/main/java/com/kdb/it/domain/estimate src/main/java/com/kdb/it/domain/deliberation src/main/java/com/kdb/it/domain/contract src/main/java/com/kdb/it/domain/payment src/test/java/com/kdb/it/domain CLAUDE.md
git commit -m "feat: 사업집행 changeStatus ADMIN 전용 전이 (TASK 보안 #7)"
```

## Task 5: #6 Tiptap metadata 카탈로그 부서(bbrC) 필터

**Files:**
- Modify: `TiptapVariableService.java`, `TiptapVariableController.java`
- Modify: `ProjectRepository.java` (부서별 조회 메서드 추가)
- Test: `TiptapVariableServiceTest.java`

> PROJ 카탈로그를 사용자 `bbrC`로 필터(ADMIN/부서매니저는 전체). 캐시 키를 부서/권한 기준으로 분리.

- [ ] **Step 1: ProjectRepository 부서별 조회 메서드 추가**

`ProjectRepository.java`의 `findActiveProjectRefs()`(L165-172) 아래 추가(주관부서 `svnDpmC` 필터 — bbrC 도메인과 동일):
```java
    /**
     * 부서(주관부서코드) 기준 활성 사업 참조 목록 (Tiptap 카탈로그 권한 필터용)
     *
     * @param svnDpmC 주관부서코드(JWT bbrC와 동일 도메인)
     * @return 해당 부서의 활성 사업 (관리번호, 사업명) 목록
     */
    @Query("""
            SELECT new com.kdb.it.domain.budget.project.entity.Bprojm$Ref(p.abusMngNo, p.abusNm)
              FROM Bprojm p
             WHERE p.delYn = 'N'
               AND p.lstYn = 'Y'
               AND p.svnDpmC = :svnDpmC
             ORDER BY p.abusNm ASC
            """)
    List<Bprojm.Ref> findActiveProjectRefsByDept(String svnDpmC);
```
(`Bprojm.svnDpmC`가 주관부서코드 — `EstimateRepositoryImpl`의 bbrC 필터가 `p.svnDpmC.eq(bbrC)` 사용으로 확인됨. 필드명이 다르면 Bprojm 엔티티에서 확인 후 맞춤.)

- [ ] **Step 2: 실패 테스트 — 부서 필터/전체**

`TiptapVariableServiceTest`에 추가(기존 `getMetadata_returnsFourCategories` L40 패턴; 신규 `getMetadata(user)` 시그니처 사용):
```java
    @Test
    @DisplayName("metadata — 일반 사용자는 본인 부서 사업만 반환")
    void getMetadata_부서필터_일반사용자() {
        var user = new com.kdb.it.common.system.security.CustomUserDetails("E1", java.util.List.of("ITPZZ001"), "D001");
        when(projectRepository.findActiveProjectRefsByDept("D001"))
                .thenReturn(List.of(new Bprojm.Ref("P-D001", "부서사업")));

        MetadataResponse res = service.getMetadata(user);

        var proj = res.categories().stream().filter(c -> c.code().equals("PROJ")).findFirst().orElseThrow();
        assertThat(proj.projects()).extracting("code").containsExactly("P-D001");
        verify(projectRepository, never()).findActiveProjectRefs();
    }

    @Test
    @DisplayName("metadata — ADMIN은 전체 사업 반환")
    void getMetadata_전체_관리자() {
        var admin = new com.kdb.it.common.system.security.CustomUserDetails("A1", java.util.List.of("ITPAD001"), "D001");
        when(projectRepository.findActiveProjectRefs())
                .thenReturn(List.of(new Bprojm.Ref("P1", "사업1"), new Bprojm.Ref("P2", "사업2")));

        MetadataResponse res = service.getMetadata(admin);

        var proj = res.categories().stream().filter(c -> c.code().equals("PROJ")).findFirst().orElseThrow();
        assertThat(proj.projects()).hasSize(2);
        verify(projectRepository, never()).findActiveProjectRefsByDept(any());
    }
```
기존 `getMetadata_returnsFourCategories`는 `service.getMetadata()` → `service.getMetadata(admin)`로 갱신(인자 추가).

- [ ] **Step 3: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.tiptap.service.TiptapVariableServiceTest"`
Expected: FAIL (현재 getMetadata 무인자).

- [ ] **Step 4: getMetadata(user) 구현 + 캐시 키 분리**

`TiptapVariableService.getMetadata`(L56-69) 교체:
```java
    /**
     * 드롭다운용 카탈로그 반환. PROJ 카탈로그는 사용자 부서(bbrC) 기준 필터(ADMIN/부서매니저는 전체).
     *
     * @param user 현재 인증 사용자 (권한·부서 기준 필터)
     */
    @Cacheable(value = "tiptapMetadata", key = "#user.isAdmin() or #user.isDeptManager() ? 'ALL' : #user.bbrC")
    public MetadataResponse getMetadata(CustomUserDetails user) {
        List<Integer> years = currentPlusMinusTwo();
        boolean seeAll = user.isAdmin() || user.isDeptManager();
        List<ProjectRef> projects = (seeAll
                ? projectRepository.findActiveProjectRefs()
                : projectRepository.findActiveProjectRefsByDept(user.getBbrC()))
                .stream().map(r -> new ProjectRef(r.code(), r.name())).toList();

        return new MetadataResponse(List.of(
                new CategoryMetadata("IT_BUDGET",  "전산예산",   years, null,     ITEMS),
                new CategoryMetadata("CAP_BUDGET", "자본예산",   years, null,     ITEMS),
                new CategoryMetadata("OPEX",       "일반관리비", years, null,     ITEMS),
                new CategoryMetadata("PROJ",       "사업별",     years, projects, ITEMS)
        ));
    }
```
import 추가: `com.kdb.it.common.system.security.CustomUserDetails`. (`@Cacheable` SpEL 키: ADMIN/부서매니저는 'ALL', 그 외 부서코드별 캐시.)

- [ ] **Step 5: 컨트롤러가 principal 전달**

`TiptapVariableController.getMetadata`(L46-51):
```java
    @GetMapping("/metadata")
    @Operation(summary = "변수 카탈로그 조회",
               description = "Tiptap 변수 드롭다운에 표시할 카테고리·연도·사업(부서 필터)·항목 목록을 반환합니다.")
    public ResponseEntity<MetadataResponse> getMetadata(
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(service.getMetadata(user));
    }
```
import `CustomUserDetails` 추가.

- [ ] **Step 6: 통과 + 컨트롤러 테스트 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.tiptap.*"`
Expected: PASS. 기존 `TiptapVariableControllerTest`의 getMetadata 호출이 principal 필요로 깨지면 `@WithMockUser` + 가짜 principal 주입으로 갱신(보고).

- [ ] **Step 7: Commit**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/tiptap src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java src/test/java/com/kdb/it/common/system/tiptap
git commit -m "feat: Tiptap metadata 카탈로그 부서(bbrC) 권한 필터 (TASK 보안 #6)"
```

---

# PR-3 — 운영 검증 + 경계 테스트

## Task 6: #3 SSO 운영 안전장치 보강 (it_backend)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java`
- Modify: `it_backend/CLAUDE.md` (§5.6)
- Test: `it_backend/src/test/java/com/kdb/it/common/system/EnvironmentValidatorTest.java`

> 대부분 이미 구현됨(allow-direct-eno·frontend-url·cors·getClientIp). 잔여: 운영에서 `app.dev.user-switch.enabled=true` 차단 + 문서 정정.

- [ ] **Step 1: 실패 테스트 — 운영 + dev.user-switch=true 차단**

`EnvironmentValidatorTest`의 prod 스위트(L70-179) 패턴(`prodEnvWithAllRequired()` MockEnvironment) 미러로 추가:
```java
    @Test
    @DisplayName("운영 프로파일에서 app.dev.user-switch.enabled=true면 기동 차단")
    void validate_prod_devUserSwitchEnabled_throws() {
        MockEnvironment env = prodEnvWithAllRequired();
        env.setProperty("app.dev.user-switch.enabled", "true");
        EnvironmentValidator validator = new EnvironmentValidator(env);
        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("user-switch");
    }
```
(`prodEnvWithAllRequired()` 헬퍼가 active profile=prod + 필수키 채움 — 기존 파일에 존재. 헬퍼가 dev.user-switch를 false로 두는지 확인 후, 본 테스트에서 true로 오버라이드.)

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.EnvironmentValidatorTest.validate_prod_devUserSwitchEnabled_throws"`
Expected: FAIL (현재 미검증).

- [ ] **Step 3: validateProdKeys에 dev.user-switch 가드 추가**

`EnvironmentValidator.validateProdKeys()`의 `allow-direct-eno` 검사(L92-96) 아래 추가:
```java
        boolean devUserSwitch = Boolean.parseBoolean(environment.getProperty("app.dev.user-switch.enabled", "false"));
        if (devUserSwitch) {
            throw new IllegalStateException(
                    "운영 보안 위반: app.dev.user-switch.enabled=true 금지 — 비밀번호 없이 임의 사번 로그인 경로입니다.");
        }
```

- [ ] **Step 4: 통과 + 전체 클래스**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.EnvironmentValidatorTest"`
Expected: PASS.

- [ ] **Step 5: CLAUDE.md §5.6 stale 정정 + 커밋**

§5.6의 X-Forwarded-For 설명("`X-Forwarded-For → Proxy-Client-IP → WL-Proxy-Client-IP` ... 헤더를 무조건 신뢰함")을 실제 구현에 맞게 정정: "`ClientIpResolver`가 직접 peer(`remoteAddr`)가 `app.trusted-proxies` allowlist에 있을 때만 `X-Forwarded-For` 최좌측 IP를 채택, 그 외 `remoteAddr` 사용." 운영 안전장치에 `app.dev.user-switch.enabled` 운영 차단 추가 명시.
```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/EnvironmentValidator.java src/test/java/com/kdb/it/common/system/EnvironmentValidatorTest.java CLAUDE.md
git commit -m "feat: 운영 프로파일 app.dev.user-switch 차단 + getClientIp 문서 정정 (TASK 보안 #3)"
```

## Task 7: #2 관리자 API JWT 경계 검증

**Files:**
- Test (backend, 주): 적절한 보안 테스트 위치 — 신규 `it_backend/src/test/java/com/kdb/it/common/admin/AdminSecurityTest.java` (또는 기존 보안 테스트 확장)
- Test (frontend, 선택): `it_frontend/tests/e2e/access-control.spec.ts`

> 프론트 `it-portal-user` 가드는 쿠키 신뢰형(변조 시 통과 가능) — 실질 경계는 백엔드 JWT. 핵심 검증은 백엔드: 유효 JWT 없으면 `it-portal-user` 쿠키와 무관하게 `/api/admin/**` 401.

- [ ] **Step 1: 백엔드 경계 테스트 작성 (주)**

`@WebMvcTest` 또는 보안 통합 슬라이스로 `/api/admin/**`가 JWT 없이는 401임을 검증. 기존 보안 테스트 패턴 확인:
```bash
cd it_backend && git grep -ln "SecurityConfig\|@WebMvcTest\|api/admin" -- 'src/test/**/*.java' | head
```
적절한 기존 보안 테스트가 있으면 거기에 케이스 추가, 없으면 신규 `AdminSecurityTest`(SecurityConfig + 필터를 실제 적용하는 슬라이스). 핵심 케이스:
```java
    @Test
    @DisplayName("유효 JWT 쿠키 없이 위조 it-portal-user 쿠키만으로 /api/admin/** 접근 시 401")
    void adminApi_forgedPortalUserCookie_noJwt_401() throws Exception {
        mockMvc.perform(get("/api/admin/users")
                        .cookie(new jakarta.servlet.http.Cookie("it-portal-user",
                                java.net.URLEncoder.encode("{\"athIds\":[\"ITPAD001\"]}", java.nio.charset.StandardCharsets.UTF_8))))
                .andExpect(status().isUnauthorized());
    }
```
(it-portal-user는 백엔드 인증에 사용되지 않음 — accessToken JWT 쿠키가 없으면 SecurityConfig `anyRequest().authenticated()` + `/api/admin/**` 보호로 401. 테스트 구성은 실제 `JwtAuthenticationFilter`+`SecurityConfig`가 적용되는 방식으로; 기존 보안 테스트의 셋업을 따름.)

- [ ] **Step 2: 백엔드 테스트 실행**

Run: `cd it_backend && ./gradlew test --tests "*AdminSecurityTest*"` (또는 케이스를 추가한 클래스)
Expected: PASS (현재 보안 구성이 이미 401을 반환해야 함 — 회귀 가드. FAIL이면 실제 보안 갭 → 보고).

- [ ] **Step 3: (선택) 프론트 E2E — 가드 UX-only 문서화**

it_frontend가 dev 서버 기동 가능하면 `access-control.spec.ts`에 추가(헬퍼 `setLoggedIn`/`mockCommonApis` 사용). 위조 쿠키로 라우트는 진입하더라도 관리자 데이터 API를 성공 mock하지 않으면 데이터 미표시임을 확인:
```ts
    /** 케이스 6: it-portal-user 변조(ITPAD001)해도 백엔드 보호 데이터는 노출되지 않는다 */
    test('위조 it-portal-user 쿠키로는 관리자 데이터가 노출되지 않는다', async ({ page }) => {
        await setLoggedIn(page, { eno: 'E001', empNm: '홍길동', athIds: ['ITPAD001'], bbrC: 'D001', temC: 'T001' }); // 위조
        await mockCommonApis(page);
        // 관리자 데이터 API는 401로 응답(유효 JWT 없음 시뮬레이션)
        await page.route(/\/api\/admin\/users/, (route) =>
            route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Unauthorized"}' }));
        await page.goto('/admin/users');
        // 데이터 행이 렌더되지 않음(빈 상태/에러) — 사용자 데이터 미노출
        await expect(page.locator('table tbody tr')).toHaveCount(0, { timeout: 10000 });
    });
```
(프론트 가드가 쿠키 신뢰형이라 라우트 진입은 허용될 수 있으나, 백엔드 401로 데이터가 비노출됨을 고정. dev 서버 미기동 환경이면 본 스텝은 작성만 하고 로컬 실행 가이드로 남김 — 보고.)
Run(가능 시): `cd it_frontend && npx vitest --version >/dev/null; npx playwright test tests/e2e/access-control.spec.ts` (또는 `npm run test:e2e`). typecheck/lint: `npm run typecheck && npm run lint`.

- [ ] **Step 4: Commit**

```bash
cd it_backend && git add src/test/java/com/kdb/it/common/admin/AdminSecurityTest.java
git commit -m "test: 관리자 API JWT 경계 검증 — 위조 it-portal-user 쿠키 401 (TASK 보안 #2)"
# (프론트 E2E 추가 시) cd /c/it/it_frontend && git add tests/e2e/access-control.spec.ts && git commit -m "test: it-portal-user 변조 시 관리자 데이터 미노출 E2E (TASK 보안 #2)"
```

---

# 마무리

## 최종 검증
- [ ] **백엔드**: `cd it_backend && ./gradlew --stop && rm -rf build/test-results/test/binary 2>/dev/null; ./gradlew test` → 신규 실패 0건 (기존 8건 — CORS 속성해석 5·XCR Ccodem 2·Committee 상태전이 1 — 무관, `task_00754fe5`).
- [ ] **Flyway**: `local-ext`/`local-int` 프로파일 기동 시 `V20260629_001` 적용 확인(`TPRMPP_CRTOKM`에 ATR_GRP_ID/USE_YN 생성).
- [ ] **프론트(해당 시)**: `cd it_frontend && npm run typecheck && npm run lint`.
- [ ] **TASK.md**: 보안 §에서 조치 6건 → 완료 표시/이관, #4 ☑️ Accepted, 에러처리 § 정리 확인.
