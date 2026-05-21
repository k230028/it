# 사전협의·전자결재 사이드바 및 Home 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사전협의(`/info/documents`)와 전자결재(`/approval`) 메뉴에 전용 사이드바 컨텍스트와 Home 대시보드 페이지를 추가한다.

**Architecture:** Approach C — 기존 list 페이지를 `list.vue`로 이동하고 `index.vue`를 대시보드로 교체. 두 개의 신규 백엔드 대시보드 API가 부서코드(`bbrC`) 기준으로 집계 데이터를 반환한다. `AppSidebar.vue`에 두 개의 신규 컨텍스트가 추가되며, 배지는 전용 badge-count 엔드포인트를 사용한다.

**Tech Stack:** Spring Boot 4 (Java 25, Oracle Native Query), Nuxt 4 (Vue 3 Composition API, TypeScript), PrimeVue Icons (`pi pi-*`), Tailwind CSS

---

## 파일 맵

### 백엔드 — 수정 대상
| 파일 | 변경 내용 |
|------|----------|
| `domain/budget/document/dto/ServiceRequestDocDto.java` | DashboardResponse, MonthlyCount, ReviewingItem, BadgeCountResponse 중첩 DTO 추가 |
| `domain/budget/document/repository/ServiceRequestDocRepository.java` | 집계 native query 6개 추가 |
| `domain/budget/document/service/ServiceRequestDocService.java` | getDashboard, getBadgeCount 메서드 추가 |
| `domain/budget/document/controller/ServiceRequestDocController.java` | GET /dashboard, GET /badge-count 엔드포인트 추가 |
| `common/approval/dto/ApplicationDto.java` | DashboardResponse, MonthlyCount, PendingItem, ApprovalBadgeCountResponse 중첩 DTO 추가 |
| `common/approval/repository/ApplicationRepository.java` | 집계 native query 6개 추가 |
| `common/approval/service/ApplicationService.java` | getDashboard, getApprovalBadgeCount 메서드 추가 |
| `common/approval/controller/ApplicationController.java` | GET /dashboard, GET /approval-badge 엔드포인트 추가 |

### 프론트엔드 — 생성/수정 대상
| 파일 | 변경 내용 |
|------|----------|
| `app/pages/info/documents/list.vue` | 신규 생성 (기존 index.vue 내용 이동) |
| `app/pages/info/documents/index.vue` | 대시보드로 교체 |
| `app/pages/approval/list.vue` | 신규 생성 (기존 index.vue 내용 이동) |
| `app/pages/approval/index.vue` | 대시보드로 교체 |
| `app/pages/info/documents/[id]/index.vue` | navigateTo('/info/documents') → '/info/documents/list' 4건 수정 |
| `app/composables/useDocumentDashboard.ts` | 신규 생성 |
| `app/composables/useApprovalDashboard.ts` | 신규 생성 |
| `app/components/AppSidebar.vue` | documents/approval 컨텍스트 추가, 배지 추가 |

---

## Task 1: 백엔드 — 문서 대시보드 DTO + 쿼리 + 서비스 + 컨트롤러

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/dto/ServiceRequestDocDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/repository/ServiceRequestDocRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ServiceRequestDocController.java`

### 1-1. ServiceRequestDocDto.java — 중첩 DTO 4개 추가

- [ ] **파일 읽기** — `ServiceRequestDocDto.java` 열어 마지막 닫는 `}` 위치 확인

- [ ] **DTO 추가** — 파일 마지막 `}` 바로 앞에 아래 4개 중첩 클래스 삽입

```java
    /**
     * 요구사항 정의서 대시보드 응답 DTO
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "DocumentDashboardResponse", description = "요구사항 정의서 대시보드 응답")
    public static class DashboardResponse {
        @Schema(description = "전체 문서 수") private int totalCount;
        @Schema(description = "검토 진행 중 문서 수") private int reviewingCount;
        @Schema(description = "협의 완료 문서 수") private int completedCount;
        @Schema(description = "완료기한 초과 문서 수") private int overdueCount;
        @Schema(description = "최근 6개월 월별 등록 추이") private java.util.List<MonthlyCount> monthlyTrend;
        @Schema(description = "검토 중인 최근 요청 목록 (최대 3건)") private java.util.List<ReviewingItem> recentReviewing;
    }

    /**
     * 월별 건수 DTO
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "DocumentMonthlyCount", description = "월별 등록 건수")
    public static class MonthlyCount {
        @Schema(description = "년월 (YYYY-MM)") private String month;
        @Schema(description = "건수") private int count;
    }

    /**
     * 검토 중인 문서 항목 DTO
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "DocumentReviewingItem", description = "검토 중인 문서 항목")
    public static class ReviewingItem {
        @Schema(description = "문서관리번호") private String docMngNo;
        @Schema(description = "요구사항명") private String title;
        @Schema(description = "작성자명") private String authorName;
        @Schema(description = "최초 등록 일시 (YYYY-MM-DD)") private String createdAt;
        @Schema(description = "상태: reviewing(검토중) | delayed(지연)") private String status;
    }

    /**
     * 사이드바 배지 건수 응답 DTO
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "DocumentBadgeCountResponse", description = "사이드바 배지 건수 응답")
    public static class BadgeCountResponse {
        @Schema(description = "검토 진행 중 문서 수") private int reviewingCount;
    }
```

### 1-2. ServiceRequestDocRepository.java — native query 6개 추가

- [ ] **파일 읽기** — `ServiceRequestDocRepository.java` 전체 내용 확인

- [ ] **import 추가** — 파일 상단 import 블록에 없는 것만 추가
```java
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
```

- [ ] **쿼리 메서드 추가** — 기존 메서드 이후에 아래 6개 추가

```java
    /** 부서 기준 전체 미삭제 문서 수 (DOC_MNG_NO 기준 distinct) */
    @Query(value = """
        SELECT COUNT(DISTINCT b.DOC_MNG_NO)
        FROM TPRMPP_BRDOCM b
        JOIN TPRMPP_CUSERI u ON b.FST_ENR_USID = u.ENO
        WHERE b.DEL_YN = 'N'
          AND u.BBR_C = :bbrC
        """, nativeQuery = true)
    int countTotalByBbrC(@Param("bbrC") String bbrC);

    /** 부서 기준 미해결 검토의견이 존재하는 문서 수 (검토 진행 중) */
    @Query(value = """
        SELECT COUNT(DISTINCT b.DOC_MNG_NO)
        FROM TPRMPP_BRDOCM b
        JOIN TPRMPP_CUSERI u ON b.FST_ENR_USID = u.ENO
        JOIN TPRMPP_BRIVGM r ON b.DOC_MNG_NO = r.DOC_MNG_NO
        WHERE b.DEL_YN = 'N'
          AND u.BBR_C = :bbrC
          AND r.RSLV_YN = 'N'
          AND r.DEL_YN = 'N'
        """, nativeQuery = true)
    int countReviewingByBbrC(@Param("bbrC") String bbrC);

    /** 부서 기준 협의 완료 문서 수 (검토의견 존재 AND 모두 해결) */
    @Query(value = """
        SELECT COUNT(DISTINCT b.DOC_MNG_NO)
        FROM TPRMPP_BRDOCM b
        JOIN TPRMPP_CUSERI u ON b.FST_ENR_USID = u.ENO
        WHERE b.DEL_YN = 'N'
          AND u.BBR_C = :bbrC
          AND EXISTS (
              SELECT 1 FROM TPRMPP_BRIVGM r
              WHERE r.DOC_MNG_NO = b.DOC_MNG_NO AND r.DEL_YN = 'N'
          )
          AND NOT EXISTS (
              SELECT 1 FROM TPRMPP_BRIVGM r
              WHERE r.DOC_MNG_NO = b.DOC_MNG_NO AND r.DEL_YN = 'N' AND r.RSLV_YN = 'N'
          )
        """, nativeQuery = true)
    int countCompletedByBbrC(@Param("bbrC") String bbrC);

    /** 부서 기준 완료기한 초과 문서 수 */
    @Query(value = """
        SELECT COUNT(DISTINCT b.DOC_MNG_NO)
        FROM TPRMPP_BRDOCM b
        JOIN TPRMPP_CUSERI u ON b.FST_ENR_USID = u.ENO
        WHERE b.DEL_YN = 'N'
          AND u.BBR_C = :bbrC
          AND b.FSG_TLM < TRUNC(SYSDATE)
        """, nativeQuery = true)
    int countOverdueByBbrC(@Param("bbrC") String bbrC);

    /**
     * 부서 기준 최근 6개월 월별 문서 등록 건수
     * 반환 컬럼: [0]=MONTH(YYYY-MM), [1]=CNT
     */
    @Query(value = """
        SELECT TO_CHAR(b.FST_ENR_DTM, 'YYYY-MM') AS MONTH,
               COUNT(DISTINCT b.DOC_MNG_NO) AS CNT
        FROM TPRMPP_BRDOCM b
        JOIN TPRMPP_CUSERI u ON b.FST_ENR_USID = u.ENO
        WHERE b.DEL_YN = 'N'
          AND u.BBR_C = :bbrC
          AND b.FST_ENR_DTM >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -5)
        GROUP BY TO_CHAR(b.FST_ENR_DTM, 'YYYY-MM')
        ORDER BY 1
        """, nativeQuery = true)
    java.util.List<Object[]> findMonthlyTrendByBbrC(@Param("bbrC") String bbrC);

    /**
     * 부서 기준 검토 중인 최근 문서 3건
     * 반환 컬럼: [0]=DOC_MNG_NO, [1]=REQ_NM, [2]=USR_NM, [3]=CREATED_AT(YYYY-MM-DD), [4]=FSG_TLM(DATE)
     */
    @Query(value = """
        SELECT DISTINCT b.DOC_MNG_NO, b.REQ_NM, u.USR_NM,
               TO_CHAR(b.FST_ENR_DTM, 'YYYY-MM-DD') AS CREATED_AT,
               b.FSG_TLM
        FROM TPRMPP_BRDOCM b
        JOIN TPRMPP_CUSERI u ON b.FST_ENR_USID = u.ENO
        JOIN TPRMPP_BRIVGM r ON b.DOC_MNG_NO = r.DOC_MNG_NO
        WHERE b.DEL_YN = 'N'
          AND u.BBR_C = :bbrC
          AND r.RSLV_YN = 'N'
          AND r.DEL_YN = 'N'
        ORDER BY b.FST_ENR_DTM DESC
        FETCH FIRST 3 ROWS ONLY
        """, nativeQuery = true)
    java.util.List<Object[]> findRecentReviewingByBbrC(@Param("bbrC") String bbrC);
```

### 1-3. ServiceRequestDocService.java — 메서드 2개 추가

- [ ] **파일 읽기** — `ServiceRequestDocService.java` 전체 내용 확인

- [ ] **메서드 추가** — 기존 마지막 메서드 이후에 추가

```java
    /**
     * 요구사항 정의서 대시보드 집계 조회
     *
     * <p>로그인 사용자의 부서코드(bbrC) 기준으로 KPI, 월별 추이,
     * 검토 중인 요청 목록을 집계하여 반환합니다.</p>
     *
     * @param bbrC 부서코드 (TPRMPP_CUSERI.BBR_C)
     * @return 대시보드 집계 응답 DTO
     */
    @Transactional(readOnly = true)
    public ServiceRequestDocDto.DashboardResponse getDashboard(String bbrC) {
        // KPI 집계 (각 쿼리 독립 실행)
        int totalCount    = serviceRequestDocRepository.countTotalByBbrC(bbrC);
        int reviewingCount = serviceRequestDocRepository.countReviewingByBbrC(bbrC);
        int completedCount = serviceRequestDocRepository.countCompletedByBbrC(bbrC);
        int overdueCount   = serviceRequestDocRepository.countOverdueByBbrC(bbrC);

        // 월별 추이 변환
        java.util.List<ServiceRequestDocDto.MonthlyCount> monthlyTrend =
            serviceRequestDocRepository.findMonthlyTrendByBbrC(bbrC).stream()
                .map(row -> ServiceRequestDocDto.MonthlyCount.builder()
                    .month((String) row[0])
                    .count(((Number) row[1]).intValue())
                    .build())
                .toList();

        // 검토 중인 최근 3건 변환 (FSG_TLM이 오늘보다 이전이면 delayed)
        java.time.LocalDate today = java.time.LocalDate.now();
        java.util.List<ServiceRequestDocDto.ReviewingItem> recentReviewing =
            serviceRequestDocRepository.findRecentReviewingByBbrC(bbrC).stream()
                .map(row -> {
                    java.sql.Date fsgTlm = (java.sql.Date) row[4];
                    boolean delayed = fsgTlm != null && fsgTlm.toLocalDate().isBefore(today);
                    return ServiceRequestDocDto.ReviewingItem.builder()
                        .docMngNo((String) row[0])
                        .title((String) row[1])
                        .authorName((String) row[2])
                        .createdAt((String) row[3])
                        .status(delayed ? "delayed" : "reviewing")
                        .build();
                })
                .toList();

        return ServiceRequestDocDto.DashboardResponse.builder()
            .totalCount(totalCount)
            .reviewingCount(reviewingCount)
            .completedCount(completedCount)
            .overdueCount(overdueCount)
            .monthlyTrend(monthlyTrend)
            .recentReviewing(recentReviewing)
            .build();
    }

    /**
     * 사이드바 배지용 검토 진행 중 문서 수 조회
     *
     * @param bbrC 부서코드
     * @return 배지 건수 응답 DTO
     */
    @Transactional(readOnly = true)
    public ServiceRequestDocDto.BadgeCountResponse getBadgeCount(String bbrC) {
        return ServiceRequestDocDto.BadgeCountResponse.builder()
            .reviewingCount(serviceRequestDocRepository.countReviewingByBbrC(bbrC))
            .build();
    }
```

`serviceRequestDocRepository` 필드명이 다를 경우 기존 코드에서 실제 필드명 확인 후 맞춤.

### 1-4. ServiceRequestDocController.java — 엔드포인트 2개 추가

- [ ] **파일 읽기** — `ServiceRequestDocController.java` 열어 마지막 메서드 위치 확인

- [ ] **엔드포인트 추가** — `deleteDocument` 메서드 이후에 추가

```java
    /**
     * 요구사항 정의서 대시보드 집계 조회
     *
     * @param bbrC 부서코드 (필수)
     * @return HTTP 200 + 대시보드 집계 응답
     */
    @GetMapping("/dashboard")
    @Operation(summary = "요구사항 정의서 대시보드 조회",
               description = "부서코드 기준 KPI, 월별 추이, 검토 진행 중 목록을 반환합니다.")
    public ResponseEntity<ServiceRequestDocDto.DashboardResponse> getDashboard(
            @RequestParam("bbrC") String bbrC) {
        return ResponseEntity.ok(serviceRequestDocService.getDashboard(bbrC));
    }

    /**
     * 사이드바 배지용 검토 중 문서 수 조회
     *
     * @param bbrC 부서코드 (필수)
     * @return HTTP 200 + 배지 건수
     */
    @GetMapping("/badge-count")
    @Operation(summary = "사이드바 배지 건수 조회",
               description = "검토 진행 중인 문서 수를 반환합니다.")
    public ResponseEntity<ServiceRequestDocDto.BadgeCountResponse> getBadgeCount(
            @RequestParam("bbrC") String bbrC) {
        return ResponseEntity.ok(serviceRequestDocService.getBadgeCount(bbrC));
    }
```

### 1-5. 빌드 확인 및 커밋

- [ ] **빌드** — `cd it_backend && ./gradlew compileJava`  
  예상: BUILD SUCCESSFUL

- [ ] **커밋**
```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/document/
git commit -m "feat: 요구사항 정의서 대시보드 및 배지 건수 API 추가"
```

---

## Task 2: 백엔드 — 전자결재 대시보드 DTO + 쿼리 + 서비스 + 컨트롤러

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/repository/ApplicationRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java`

### 2-1. ApplicationDto.java — 중첩 DTO 4개 추가

- [ ] **파일 읽기** — `ApplicationDto.java` 열어 마지막 닫는 `}` 위치 확인

- [ ] **DTO 추가** — 파일 마지막 `}` 바로 앞에 삽입

```java
    /**
     * 전자결재 대시보드 응답 DTO
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @lombok.AllArgsConstructor
    @io.swagger.v3.oas.annotations.media.Schema(name = "ApprovalDashboardResponse",
        description = "전자결재 대시보드 응답")
    public static class DashboardResponse {
        @io.swagger.v3.oas.annotations.media.Schema(description = "결재 대기 수 (본인)")
        private int pendingCount;
        @io.swagger.v3.oas.annotations.media.Schema(description = "내가 기안한 진행 중 수")
        private int inProgressCount;
        @io.swagger.v3.oas.annotations.media.Schema(description = "이번달 부서 완료 수")
        private int monthlyCompletedCount;
        @io.swagger.v3.oas.annotations.media.Schema(description = "내 반려 수")
        private int rejectedCount;
        @io.swagger.v3.oas.annotations.media.Schema(description = "최근 6개월 월별 처리 현황")
        private java.util.List<MonthlyCount> monthlyTrend;
        @io.swagger.v3.oas.annotations.media.Schema(description = "내 결재 대기 목록 (최대 3건)")
        private java.util.List<PendingItem> pendingList;
    }

    /**
     * 월별 건수 DTO (결재 대시보드)
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @lombok.AllArgsConstructor
    @io.swagger.v3.oas.annotations.media.Schema(name = "ApprovalMonthlyCount",
        description = "월별 결재 처리 건수")
    public static class MonthlyCount {
        @io.swagger.v3.oas.annotations.media.Schema(description = "년월 (YYYY-MM)")
        private String month;
        @io.swagger.v3.oas.annotations.media.Schema(description = "건수")
        private int count;
    }

    /**
     * 결재 대기 항목 DTO
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @lombok.AllArgsConstructor
    @io.swagger.v3.oas.annotations.media.Schema(name = "ApprovalPendingItem",
        description = "결재 대기 항목")
    public static class PendingItem {
        @io.swagger.v3.oas.annotations.media.Schema(description = "신청서관리번호")
        private String apfMngNo;
        @io.swagger.v3.oas.annotations.media.Schema(description = "신청서명")
        private String title;
        @io.swagger.v3.oas.annotations.media.Schema(description = "신청자명")
        private String requesterName;
        @io.swagger.v3.oas.annotations.media.Schema(description = "신청일자 (YYYY-MM-DD)")
        private String requestedAt;
        @io.swagger.v3.oas.annotations.media.Schema(description = "긴급여부: urgent(3일 초과) | normal")
        private String urgency;
    }

    /**
     * 사이드바 배지 건수 응답 DTO
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @lombok.AllArgsConstructor
    @io.swagger.v3.oas.annotations.media.Schema(name = "ApprovalBadgeCountResponse",
        description = "결재 사이드바 배지 건수 응답")
    public static class ApprovalBadgeCountResponse {
        @io.swagger.v3.oas.annotations.media.Schema(description = "결재 대기 수")
        private int pendingCount;
        @io.swagger.v3.oas.annotations.media.Schema(description = "기안 진행 중 수")
        private int inProgressCount;
    }
```

### 2-2. ApplicationRepository.java — native query 6개 추가

- [ ] **파일 읽기** — `ApplicationRepository.java` 전체 내용 확인

- [ ] **import 추가** — 없는 것만 추가
```java
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
```

- [ ] **쿼리 메서드 추가** — 기존 메서드 이후에 추가

```java
    /** 본인에게 온 결재 대기 건수 (APF_STS='결재중' AND 본인 결재선 미처리) */
    @Query(value = """
        SELECT COUNT(*)
        FROM TPRMPP_CAPPLM a
        JOIN TPRMPP_CDECIM d ON a.APF_MNG_NO = d.APF_MNG_NO
        WHERE a.APF_STS = '결재중'
          AND d.DCD_ENO = :eno
          AND d.DCD_DT IS NULL
        """, nativeQuery = true)
    int countPendingByEno(@Param("eno") String eno);

    /** 내가 기안한 진행 중 건수 */
    @Query(value = """
        SELECT COUNT(*)
        FROM TPRMPP_CAPPLM a
        WHERE a.APF_STS = '결재중'
          AND a.RQS_ENO = :eno
        """, nativeQuery = true)
    int countInProgressByEno(@Param("eno") String eno);

    /** 이번달 부서 완료 건수 */
    @Query(value = """
        SELECT COUNT(*)
        FROM TPRMPP_CAPPLM a
        JOIN TPRMPP_CUSERI u ON a.RQS_ENO = u.ENO
        WHERE a.APF_STS = '결재완료'
          AND u.BBR_C = :bbrC
          AND a.RQS_DT >= TRUNC(SYSDATE, 'MM')
        """, nativeQuery = true)
    int countMonthlyCompletedByBbrC(@Param("bbrC") String bbrC);

    /** 내 반려 건수 */
    @Query(value = """
        SELECT COUNT(*)
        FROM TPRMPP_CAPPLM a
        WHERE a.APF_STS = '반려'
          AND a.RQS_ENO = :eno
        """, nativeQuery = true)
    int countRejectedByEno(@Param("eno") String eno);

    /**
     * 부서 기준 최근 6개월 월별 결재 처리 건수
     * 반환 컬럼: [0]=MONTH(YYYY-MM), [1]=CNT
     */
    @Query(value = """
        SELECT TO_CHAR(a.RQS_DT, 'YYYY-MM') AS MONTH,
               COUNT(*) AS CNT
        FROM TPRMPP_CAPPLM a
        JOIN TPRMPP_CUSERI u ON a.RQS_ENO = u.ENO
        WHERE u.BBR_C = :bbrC
          AND a.RQS_DT >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -5)
        GROUP BY TO_CHAR(a.RQS_DT, 'YYYY-MM')
        ORDER BY 1
        """, nativeQuery = true)
    java.util.List<Object[]> findMonthlyTrendByBbrC(@Param("bbrC") String bbrC);

    /**
     * 본인 결재 대기 최근 3건
     * 반환 컬럼: [0]=APF_MNG_NO, [1]=APF_NM, [2]=USR_NM, [3]=RQS_DT(YYYY-MM-DD)
     */
    @Query(value = """
        SELECT a.APF_MNG_NO, a.APF_NM, u.USR_NM,
               TO_CHAR(a.RQS_DT, 'YYYY-MM-DD') AS RQS_DT_STR
        FROM TPRMPP_CAPPLM a
        JOIN TPRMPP_CUSERI u ON a.RQS_ENO = u.ENO
        JOIN TPRMPP_CDECIM d ON a.APF_MNG_NO = d.APF_MNG_NO
        WHERE a.APF_STS = '결재중'
          AND d.DCD_ENO = :eno
          AND d.DCD_DT IS NULL
        ORDER BY a.RQS_DT DESC
        FETCH FIRST 3 ROWS ONLY
        """, nativeQuery = true)
    java.util.List<Object[]> findPendingListByEno(@Param("eno") String eno);
```

### 2-3. ApplicationService.java — 메서드 2개 추가

- [ ] **파일 읽기** — `ApplicationService.java` 전체 내용 확인

- [ ] **메서드 추가** — 기존 마지막 메서드 이후에 추가

```java
    /**
     * 전자결재 대시보드 집계 조회
     *
     * <p>bbrC 기준 부서 통계와 eno 기준 본인 결재 대기 목록을 반환합니다.</p>
     *
     * @param bbrC 부서코드 (TPRMPP_CUSERI.BBR_C)
     * @param eno  사원번호 (본인 결재 대기 필터)
     * @return 대시보드 집계 응답 DTO
     */
    @Transactional(readOnly = true)
    public ApplicationDto.DashboardResponse getDashboard(String bbrC, String eno) {
        // KPI 집계
        int pendingCount          = applicationRepository.countPendingByEno(eno);
        int inProgressCount       = applicationRepository.countInProgressByEno(eno);
        int monthlyCompletedCount = applicationRepository.countMonthlyCompletedByBbrC(bbrC);
        int rejectedCount         = applicationRepository.countRejectedByEno(eno);

        // 월별 추이 변환
        java.util.List<ApplicationDto.MonthlyCount> monthlyTrend =
            applicationRepository.findMonthlyTrendByBbrC(bbrC).stream()
                .map(row -> ApplicationDto.MonthlyCount.builder()
                    .month((String) row[0])
                    .count(((Number) row[1]).intValue())
                    .build())
                .toList();

        // 결재 대기 목록 변환 (3일 이상 경과 시 urgent)
        java.time.LocalDate threeDaysAgo = java.time.LocalDate.now().minusDays(3);
        java.util.List<ApplicationDto.PendingItem> pendingList =
            applicationRepository.findPendingListByEno(eno).stream()
                .map(row -> {
                    String rqsDtStr = (String) row[3];
                    java.time.LocalDate rqsDt = java.time.LocalDate.parse(rqsDtStr);
                    String urgency = rqsDt.isBefore(threeDaysAgo) ? "urgent" : "normal";
                    return ApplicationDto.PendingItem.builder()
                        .apfMngNo((String) row[0])
                        .title((String) row[1])
                        .requesterName((String) row[2])
                        .requestedAt(rqsDtStr)
                        .urgency(urgency)
                        .build();
                })
                .toList();

        return ApplicationDto.DashboardResponse.builder()
            .pendingCount(pendingCount)
            .inProgressCount(inProgressCount)
            .monthlyCompletedCount(monthlyCompletedCount)
            .rejectedCount(rejectedCount)
            .monthlyTrend(monthlyTrend)
            .pendingList(pendingList)
            .build();
    }

    /**
     * 사이드바 배지용 결재 현황 수 조회
     *
     * @param bbrC 부서코드
     * @param eno  사원번호
     * @return 배지 건수 응답 DTO
     */
    @Transactional(readOnly = true)
    public ApplicationDto.ApprovalBadgeCountResponse getApprovalBadgeCount(String bbrC, String eno) {
        return ApplicationDto.ApprovalBadgeCountResponse.builder()
            .pendingCount(applicationRepository.countPendingByEno(eno))
            .inProgressCount(applicationRepository.countInProgressByEno(eno))
            .build();
    }
```

`applicationRepository` 필드명이 다를 경우 기존 코드 확인 후 맞춤.

### 2-4. ApplicationController.java — 엔드포인트 2개 추가

- [ ] **파일 읽기** — `ApplicationController.java` 열어 마지막 메서드 위치 확인

- [ ] **엔드포인트 추가** — 마지막 메서드 이후에 추가

```java
    /**
     * 전자결재 대시보드 집계 조회
     *
     * @param bbrC 부서코드 (필수)
     * @param eno  사원번호 (필수)
     * @return HTTP 200 + 대시보드 집계 응답
     */
    @GetMapping("/dashboard")
    @Operation(summary = "전자결재 대시보드 조회",
               description = "부서코드 기준 KPI, 월별 추이, 본인 결재 대기 목록을 반환합니다.")
    public ResponseEntity<ApplicationDto.DashboardResponse> getDashboard(
            @RequestParam("bbrC") String bbrC,
            @RequestParam("eno") String eno) {
        return ResponseEntity.ok(applicationService.getDashboard(bbrC, eno));
    }

    /**
     * 사이드바 배지용 결재 현황 수 조회
     *
     * @param bbrC 부서코드 (필수)
     * @param eno  사원번호 (필수)
     * @return HTTP 200 + 배지 건수
     */
    @GetMapping("/approval-badge")
    @Operation(summary = "사이드바 배지 건수 조회",
               description = "결재 대기 수와 기안 진행 중 수를 반환합니다.")
    public ResponseEntity<ApplicationDto.ApprovalBadgeCountResponse> getApprovalBadgeCount(
            @RequestParam("bbrC") String bbrC,
            @RequestParam("eno") String eno) {
        return ResponseEntity.ok(applicationService.getApprovalBadgeCount(bbrC, eno));
    }
```

`applicationService` 필드명이 다를 경우 기존 코드 확인 후 맞춤.

### 2-5. 빌드 확인 및 커밋

- [ ] **빌드** — `cd it_backend && ./gradlew compileJava`  
  예상: BUILD SUCCESSFUL

- [ ] **커밋**
```bash
git add it_backend/src/main/java/com/kdb/it/common/approval/
git commit -m "feat: 전자결재 대시보드 및 배지 건수 API 추가"
```

---

## Task 3: 프론트엔드 — 라우팅 재구성

**Files:**
- Create: `it_frontend/app/pages/info/documents/list.vue`
- Replace: `it_frontend/app/pages/info/documents/index.vue`
- Create: `it_frontend/app/pages/approval/list.vue`
- Replace: `it_frontend/app/pages/approval/index.vue`
- Modify: `it_frontend/app/pages/info/documents/[id]/index.vue`

### 3-1. info/documents/list.vue 생성

- [ ] **읽기** — `app/pages/info/documents/index.vue` 전체 내용 읽기

- [ ] **list.vue 생성** — index.vue의 전체 내용을 그대로 복사하여 `list.vue`로 저장  
  (내부 링크 `/info/documents/form`, `/info/documents/{docMngNo}` 경로는 그대로 유지)

### 3-2. info/documents/index.vue — 대시보드 껍데기로 교체

- [ ] **index.vue 교체**

```vue
<script setup lang="ts">
definePageMeta({ layout: 'default' });
</script>

<template>
  <div class="flex items-center justify-center h-64 text-zinc-400">
    <i class="pi pi-spin pi-spinner mr-2" />
    대시보드 구현 예정
  </div>
</template>
```

### 3-3. approval/list.vue 생성

- [ ] **읽기** — `app/pages/approval/index.vue` 전체 내용 읽기

- [ ] **list.vue 생성** — index.vue의 전체 내용을 그대로 복사하여 `list.vue`로 저장

### 3-4. approval/index.vue — 대시보드 껍데기로 교체

- [ ] **index.vue 교체**

```vue
<script setup lang="ts">
definePageMeta({ layout: 'default' });
</script>

<template>
  <div class="flex items-center justify-center h-64 text-zinc-400">
    <i class="pi pi-spin pi-spinner mr-2" />
    대시보드 구현 예정
  </div>
</template>
```

### 3-5. [id]/index.vue — navigateTo 4건 수정

- [ ] **grep으로 확인** — 수정 대상 위치 파악
```bash
grep -n "navigateTo('/info/documents')" "it_frontend/app/pages/info/documents/[id]/index.vue"
```

- [ ] **모든 `navigateTo('/info/documents')` → `navigateTo('/info/documents/list')` 로 교체**  
  (라인 383, 579, 591, 607 근처, 실제 라인은 grep 결과 기준)

- [ ] **수정 확인**
```bash
grep -n "navigateTo('/info/documents')" "it_frontend/app/pages/info/documents/[id]/index.vue"
```
예상: 결과 없음

### 3-6. 브라우저 동작 확인

- [ ] **dev server** — `cd it_frontend && npm run dev`
- [ ] **확인 항목**:
  - `http://localhost:3000/info/documents` → "대시보드 구현 예정" 표시
  - `http://localhost:3000/info/documents/list` → 기존 목록 화면 정상
  - `http://localhost:3000/approval` → "대시보드 구현 예정" 표시
  - `http://localhost:3000/approval/list` → 기존 결재 화면 정상

- [ ] **커밋**
```bash
git add it_frontend/app/pages/info/documents/ it_frontend/app/pages/approval/
git commit -m "feat: 사전협의·전자결재 라우팅 재구성 (list.vue 분리)"
```

---

## Task 4: 프론트엔드 — useDocumentDashboard composable

**Files:**
- Create: `it_frontend/app/composables/useDocumentDashboard.ts`

- [ ] **파일 생성**

```typescript
/**
 * 요구사항 정의서 대시보드 데이터 composable
 */

export interface DocMonthlyCount {
    month: string;   // YYYY-MM
    count: number;
}

export interface DocReviewingItem {
    docMngNo: string;
    title: string;
    authorName: string;
    createdAt: string;
    status: 'reviewing' | 'delayed';
}

export interface DocumentDashboard {
    totalCount: number;
    reviewingCount: number;
    completedCount: number;
    overdueCount: number;
    monthlyTrend: DocMonthlyCount[];
    recentReviewing: DocReviewingItem[];
}

export interface DocumentBadgeCount {
    reviewingCount: number;
}

/**
 * 요구사항 정의서 대시보드 데이터 조회
 * 로그인 사용자의 bbrC 기준 집계 데이터를 가져옵니다.
 */
export const useDocumentDashboard = () => {
    const { user } = useAuth();
    const { data, pending, refresh } = useApiFetch<DocumentDashboard>(
        '/api/documents/dashboard',
        { query: computed(() => ({ bbrC: user.value?.bbrC })) }
    );
    return { data, pending, refresh };
};

/**
 * 사이드바 배지용 검토 진행 중 문서 수 조회
 */
export const useDocumentBadgeCount = () => {
    const { user } = useAuth();
    const { data } = useApiFetch<DocumentBadgeCount>(
        '/api/documents/badge-count',
        { query: computed(() => ({ bbrC: user.value?.bbrC })) }
    );
    const reviewingCount = computed(() => data.value?.reviewingCount ?? 0);
    return { reviewingCount };
};
```

- [ ] **타입 체크** — `npx nuxt typecheck`  
  예상: 오류 없음

- [ ] **커밋**
```bash
git add it_frontend/app/composables/useDocumentDashboard.ts
git commit -m "feat: useDocumentDashboard + useDocumentBadgeCount composable 추가"
```

---

## Task 5: 프론트엔드 — useApprovalDashboard composable

**Files:**
- Create: `it_frontend/app/composables/useApprovalDashboard.ts`

- [ ] **파일 생성**

```typescript
/**
 * 전자결재 대시보드 데이터 composable
 */

export interface ApprovalMonthlyCount {
    month: string;   // YYYY-MM
    count: number;
}

export interface ApprovalPendingItem {
    apfMngNo: string;
    title: string;
    requesterName: string;
    requestedAt: string;
    urgency: 'urgent' | 'normal';
}

export interface ApprovalDashboard {
    pendingCount: number;
    inProgressCount: number;
    monthlyCompletedCount: number;
    rejectedCount: number;
    monthlyTrend: ApprovalMonthlyCount[];
    pendingList: ApprovalPendingItem[];
}

export interface ApprovalBadgeCount {
    pendingCount: number;
    inProgressCount: number;
}

/**
 * 전자결재 대시보드 데이터 조회
 * bbrC 기준 부서 통계 + eno 기준 본인 결재 대기 목록
 */
export const useApprovalDashboard = () => {
    const { user } = useAuth();
    const { data, pending, refresh } = useApiFetch<ApprovalDashboard>(
        '/api/applications/dashboard',
        {
            query: computed(() => ({
                bbrC: user.value?.bbrC,
                eno: user.value?.eno
            }))
        }
    );
    return { data, pending, refresh };
};

/**
 * 사이드바 배지용 결재 현황 수 조회
 */
export const useApprovalBadgeCount = () => {
    const { user } = useAuth();
    const { data } = useApiFetch<ApprovalBadgeCount>(
        '/api/applications/approval-badge',
        {
            query: computed(() => ({
                bbrC: user.value?.bbrC,
                eno: user.value?.eno
            }))
        }
    );
    const pendingCount = computed(() => data.value?.pendingCount ?? 0);
    const inProgressCount = computed(() => data.value?.inProgressCount ?? 0);
    return { pendingCount, inProgressCount };
};
```

- [ ] **타입 체크** — `npx nuxt typecheck`  
  예상: 오류 없음

- [ ] **커밋**
```bash
git add it_frontend/app/composables/useApprovalDashboard.ts
git commit -m "feat: useApprovalDashboard + useApprovalBadgeCount composable 추가"
```

---

## Task 6: 프론트엔드 — AppSidebar 컨텍스트 확장

**Files:**
- Modify: `it_frontend/app/components/AppSidebar.vue`

### 6-1. import 추가

- [ ] **파일 읽기** — `app/components/AppSidebar.vue` 전체 읽기

- [ ] **import 추가** — `<script setup>` 내 기존 import 아래에 추가
```typescript
import { useDocumentBadgeCount } from '~/composables/useDocumentDashboard';
import { useApprovalBadgeCount } from '~/composables/useApprovalDashboard';
```

### 6-2. badge composable 호출 추가

- [ ] **composable 호출 추가** — `const { data: pendingCountData } = usePendingApprovalCount();` 아래에 추가

```typescript
/* ── 사전협의 검토 진행 중 배지 ── */
const { reviewingCount: docReviewingCount } = useDocumentBadgeCount();

/* ── 전자결재 결재 대기 / 기안 진행 중 배지 ── */
const { pendingCount: approvalPendingCount, inProgressCount: approvalInProgressCount } = useApprovalBadgeCount();
```

### 6-3. context computed 확장

- [ ] **context computed 수정** — 기존 전체 교체

```typescript
// 변경 전
const context = computed(() => {
    if (route.path.startsWith('/audit')) return 'audit';
    if (route.path.startsWith('/admin')) return 'admin';
    return 'info';
});

// 변경 후 (/info/documents는 반드시 /audit, /admin보다 먼저 체크)
const context = computed(() => {
    if (route.path.startsWith('/info/documents')) return 'documents';
    if (route.path.startsWith('/approval')) return 'approval';
    if (route.path.startsWith('/audit')) return 'audit';
    if (route.path.startsWith('/admin')) return 'admin';
    return 'info';
});
```

### 6-4. menuItems computed에 두 컨텍스트 추가

- [ ] **menuItems computed 수정** — `if (context.value === 'audit')` 블록 바로 앞에 추가

```typescript
    // 사전협의 컨텍스트
    if (context.value === 'documents') {
        return [
            { label: 'Home', icon: 'pi pi-home', to: '/info/documents' },
            {
                label: '문서 관리', icon: 'pi pi-folder', items: [
                    { label: '문서 목록', to: '/info/documents/list' },
                    { label: '신규 작성', to: '/info/documents/form' }
                ]
            },
            {
                label: '협의 현황', icon: 'pi pi-chart-pie', items: [
                    { label: '검토 중', to: '/info/documents/list?status=reviewing', badge: 'docReviewing' },
                    { label: '협의 완료', to: '/info/documents/list?status=completed' },
                    { label: '지연', to: '/info/documents/list?status=overdue' }
                ]
            }
        ];
    }

    // 전자결재 컨텍스트
    if (context.value === 'approval') {
        return [
            { label: 'Home', icon: 'pi pi-home', to: '/approval' },
            {
                label: '결재함', icon: 'pi pi-inbox', items: [
                    { label: '결재 대기', to: '/approval/list?tab=pending', badge: 'approvalPending' },
                    { label: '결재 완료', to: '/approval/list?tab=done' }
                ]
            },
            {
                label: '기안함', icon: 'pi pi-send', items: [
                    { label: '결재 진행 중', to: '/approval/list?tab=in-progress', badge: 'approvalInProgress' },
                    { label: '완료 기안', to: '/approval/list?tab=draft-done' },
                    { label: '반려 기안', to: '/approval/list?tab=draft-rejected' }
                ]
            }
        ];
    }
```

### 6-5. 서브메뉴 배지 렌더링 추가

- [ ] **배지 span 추가** — 기존 `결재 상신` 배지 span 바로 아래에 추가

```html
<!-- 사전협의: 검토 중 배지 -->
<span
    v-if="sub.badge === 'docReviewing' && docReviewingCount > 0"
    class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-yellow-500 text-white text-[10px] font-bold leading-none">
    {{ docReviewingCount > 99 ? '99+' : docReviewingCount }}
</span>
<!-- 전자결재: 결재 대기 배지 -->
<span
    v-if="sub.badge === 'approvalPending' && approvalPendingCount > 0"
    class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
    {{ approvalPendingCount > 99 ? '99+' : approvalPendingCount }}
</span>
<!-- 전자결재: 기안 진행 중 배지 -->
<span
    v-if="sub.badge === 'approvalInProgress' && approvalInProgressCount > 0"
    class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-yellow-500 text-white text-[10px] font-bold leading-none">
    {{ approvalInProgressCount > 99 ? '99+' : approvalInProgressCount }}
</span>
```

### 6-6. 타입 체크 및 브라우저 확인

- [ ] **타입 체크** — `npx nuxt typecheck`  
  TypeScript 오류가 있으면 `sub.badge` 접근 부분에서 발생할 수 있음 — `(sub as any).badge`로 임시 처리 후 타입 정의 확장

- [ ] **브라우저 확인**
  - `/info/documents` 접속 → 사전협의 사이드바 (Home, 문서 관리, 협의 현황) 표시
  - `/approval` 접속 → 전자결재 사이드바 (Home, 결재함, 기안함) 표시
  - `/info/projects` 접속 → 기존 info 사이드바 정상

- [ ] **커밋**
```bash
git add it_frontend/app/components/AppSidebar.vue
git commit -m "feat: AppSidebar 사전협의·전자결재 컨텍스트 추가"
```

---

## Task 7: 프론트엔드 — 사전협의 Home 대시보드 페이지

**Files:**
- Replace: `it_frontend/app/pages/info/documents/index.vue`

- [ ] **파일 읽기** — 현재 `index.vue` (껍데기 상태) 확인

- [ ] **index.vue 완성** — 아래 전체 내용으로 교체

```vue
<script setup lang="ts">
/**
 * 사전협의 Home 대시보드
 * 로그인 사용자의 부서(bbrC) 기준 요구사항 정의서 현황을 표시합니다.
 */
import { useDocumentDashboard, type DocReviewingItem } from '~/composables/useDocumentDashboard';

definePageMeta({ layout: 'default' });

const { data, pending } = useDocumentDashboard();

/** 최근 6개월 레이블: 데이터 없는 달도 0으로 채워 표시 */
const chartData = computed(() => {
    if (!data.value?.monthlyTrend) return [];
    const map = new Map(data.value.monthlyTrend.map(m => [m.month, m.count]));
    const result = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${d.getMonth() + 1}월`;
        result.push({ month: label, count: map.get(key) ?? 0 });
    }
    return result;
});

/** 차트 최대값 (막대 폭 계산용, 최소 1) */
const chartMax = computed(() => Math.max(...chartData.value.map(d => d.count), 1));

const statusBadgeClass = (status: string) =>
    status === 'delayed' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white';

const statusLabel = (status: string) => status === 'delayed' ? '지연' : '검토중';

const navigateToItem = (item: DocReviewingItem) => {
    navigateTo(`/info/documents/${item.docMngNo}`);
};
</script>

<template>
    <div class="space-y-6">
        <!-- 페이지 헤더 -->
        <div class="flex items-center gap-3">
            <span class="bg-indigo-600 rounded-lg p-2 text-white">
                <i class="pi pi-file-edit text-lg" />
            </span>
            <div>
                <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-100">사전협의 Home</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400">요구사항 정의서 현황</p>
            </div>
            <Button
                label="문서 목록"
                icon="pi pi-list"
                size="small"
                severity="secondary"
                class="ml-auto"
                @click="navigateTo('/info/documents/list')"
            />
        </div>

        <!-- KPI 카드 -->
        <div v-if="pending" class="grid grid-cols-4 gap-4">
            <Skeleton v-for="i in 4" :key="i" height="90px" border-radius="12px" />
        </div>
        <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="text-3xl font-extrabold text-indigo-400">{{ data?.totalCount ?? 0 }}</div>
                <div class="text-xs text-zinc-500 mt-1"><i class="pi pi-file mr-1" />전체 문서</div>
            </div>
            <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="text-3xl font-extrabold text-yellow-500">{{ data?.reviewingCount ?? 0 }}</div>
                <div class="text-xs text-zinc-500 mt-1"><i class="pi pi-search mr-1" />검토 진행 중</div>
            </div>
            <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="text-3xl font-extrabold text-green-500">{{ data?.completedCount ?? 0 }}</div>
                <div class="text-xs text-zinc-500 mt-1"><i class="pi pi-check-circle mr-1" />협의 완료</div>
            </div>
            <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="text-3xl font-extrabold text-red-400">{{ data?.overdueCount ?? 0 }}</div>
                <div class="text-xs text-zinc-500 mt-1"><i class="pi pi-times-circle mr-1" />지연</div>
            </div>
        </div>

        <!-- 하단 2열: 차트 + 검토 목록 -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <!-- 월별 추이 바 차트 -->
            <div class="md:col-span-3 bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="flex items-center gap-2 font-semibold text-sm text-zinc-700 dark:text-zinc-300 mb-4">
                    <i class="pi pi-chart-bar text-indigo-500" />
                    월별 문서 등록 추이 (최근 6개월)
                </div>
                <div v-if="pending" class="space-y-2">
                    <Skeleton v-for="i in 6" :key="i" height="20px" />
                </div>
                <div v-else class="space-y-2">
                    <div
                        v-for="item in chartData"
                        :key="item.month"
                        class="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400"
                    >
                        <span class="w-8 text-right shrink-0">{{ item.month }}</span>
                        <div class="flex-1 h-5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                                class="h-full bg-indigo-400 rounded-full transition-all duration-500"
                                :style="{ width: `${Math.round((item.count / chartMax) * 100)}%` }"
                            />
                        </div>
                        <span class="w-8 shrink-0">{{ item.count }}건</span>
                    </div>
                </div>
            </div>

            <!-- 검토 중인 요청사항 -->
            <div class="md:col-span-2 bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="flex items-center gap-2 font-semibold text-sm text-zinc-700 dark:text-zinc-300 mb-4">
                    <i class="pi pi-search text-indigo-500" />
                    검토 중인 요청사항
                </div>
                <div v-if="pending" class="space-y-3">
                    <Skeleton v-for="i in 3" :key="i" height="48px" />
                </div>
                <div v-else-if="!data?.recentReviewing?.length" class="text-center py-6 text-zinc-400 text-xs">
                    검토 중인 요청사항이 없습니다
                </div>
                <div v-else class="space-y-0">
                    <div
                        v-for="item in data.recentReviewing"
                        :key="item.docMngNo"
                        class="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-700 last:border-0 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded px-1 -mx-1 transition-colors"
                        @click="navigateToItem(item)"
                    >
                        <div class="min-w-0">
                            <div class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                {{ item.title }}
                            </div>
                            <div class="text-xs text-zinc-400 mt-0.5">
                                <i class="pi pi-user mr-1" />{{ item.authorName }} · {{ item.createdAt }}
                            </div>
                        </div>
                        <span
                            class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2"
                            :class="statusBadgeClass(item.status)"
                        >
                            {{ statusLabel(item.status) }}
                        </span>
                    </div>
                </div>
                <div
                    class="mt-3 text-center text-xs text-indigo-500 hover:underline cursor-pointer"
                    @click="navigateTo('/info/documents/list?status=reviewing')"
                >
                    <i class="pi pi-arrow-right mr-1" />전체 보기
                </div>
            </div>
        </div>
    </div>
</template>
```

- [ ] **타입 체크** — `npx nuxt typecheck`  
  예상: 오류 없음

- [ ] **브라우저 확인** — `http://localhost:3000/info/documents`
  - KPI 카드 4개 (로딩 스켈레톤 → 데이터)
  - 6개월 바 차트
  - 검토 중 목록 또는 "없습니다" 메시지

- [ ] **커밋**
```bash
git add it_frontend/app/pages/info/documents/index.vue
git commit -m "feat: 사전협의 Home 대시보드 페이지 구현"
```

---

## Task 8: 프론트엔드 — 전자결재 Home 대시보드 페이지

**Files:**
- Replace: `it_frontend/app/pages/approval/index.vue`

- [ ] **파일 읽기** — 현재 `index.vue` (껍데기 상태) 확인

- [ ] **index.vue 완성** — 아래 전체 내용으로 교체

```vue
<script setup lang="ts">
/**
 * 전자결재 Home 대시보드
 * - KPI: pendingCount(본인), inProgressCount(본인), monthlyCompletedCount(부서), rejectedCount(본인)
 * - 월별 추이: 부서 기준
 * - 결재 대기 목록: 본인 기준 (urgency: urgent=3일 초과, normal)
 */
import { useApprovalDashboard, type ApprovalPendingItem } from '~/composables/useApprovalDashboard';

definePageMeta({ layout: 'default' });

const { data, pending } = useApprovalDashboard();

/** 최근 6개월 차트 데이터 (빈 달 0으로 채움) */
const chartData = computed(() => {
    if (!data.value?.monthlyTrend) return [];
    const map = new Map(data.value.monthlyTrend.map(m => [m.month, m.count]));
    const result = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${d.getMonth() + 1}월`;
        result.push({ month: label, count: map.get(key) ?? 0 });
    }
    return result;
});

const chartMax = computed(() => Math.max(...chartData.value.map(d => d.count), 1));

const urgencyBadgeClass = (urgency: string) =>
    urgency === 'urgent' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-zinc-800';

const urgencyLabel = (urgency: string) => urgency === 'urgent' ? '긴급' : '대기';

const navigateToPending = (_item: ApprovalPendingItem) => {
    navigateTo('/approval/list?tab=pending');
};
</script>

<template>
    <div class="space-y-6">
        <!-- 페이지 헤더 -->
        <div class="flex items-center gap-3">
            <span class="bg-emerald-600 rounded-lg p-2 text-white">
                <i class="pi pi-send text-lg" />
            </span>
            <div>
                <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-100">전자결재 Home</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400">결재 현황</p>
            </div>
            <Button
                label="전체 결재함"
                icon="pi pi-inbox"
                size="small"
                severity="secondary"
                class="ml-auto"
                @click="navigateTo('/approval/list')"
            />
        </div>

        <!-- KPI 카드 -->
        <div v-if="pending" class="grid grid-cols-4 gap-4">
            <Skeleton v-for="i in 4" :key="i" height="90px" border-radius="12px" />
        </div>
        <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="text-3xl font-extrabold text-red-500">{{ data?.pendingCount ?? 0 }}</div>
                <div class="text-xs text-zinc-500 mt-1"><i class="pi pi-inbox mr-1" />결재 대기</div>
            </div>
            <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="text-3xl font-extrabold text-yellow-500">{{ data?.inProgressCount ?? 0 }}</div>
                <div class="text-xs text-zinc-500 mt-1"><i class="pi pi-spin pi-spinner mr-1" />진행 중</div>
            </div>
            <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="text-3xl font-extrabold text-green-500">{{ data?.monthlyCompletedCount ?? 0 }}</div>
                <div class="text-xs text-zinc-500 mt-1"><i class="pi pi-verified mr-1" />이번달 완료</div>
            </div>
            <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="text-3xl font-extrabold text-red-400">{{ data?.rejectedCount ?? 0 }}</div>
                <div class="text-xs text-zinc-500 mt-1"><i class="pi pi-times-circle mr-1" />반려</div>
            </div>
        </div>

        <!-- 하단 2열: 차트 + 결재 대기 목록 -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <!-- 월별 처리 현황 바 차트 -->
            <div class="md:col-span-3 bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="flex items-center gap-2 font-semibold text-sm text-zinc-700 dark:text-zinc-300 mb-4">
                    <i class="pi pi-chart-bar text-emerald-500" />
                    월별 결재 처리 현황 (최근 6개월)
                </div>
                <div v-if="pending" class="space-y-2">
                    <Skeleton v-for="i in 6" :key="i" height="20px" />
                </div>
                <div v-else class="space-y-2">
                    <div
                        v-for="item in chartData"
                        :key="item.month"
                        class="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400"
                    >
                        <span class="w-8 text-right shrink-0">{{ item.month }}</span>
                        <div class="flex-1 h-5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                                class="h-full bg-emerald-400 rounded-full transition-all duration-500"
                                :style="{ width: `${Math.round((item.count / chartMax) * 100)}%` }"
                            />
                        </div>
                        <span class="w-8 shrink-0">{{ item.count }}건</span>
                    </div>
                </div>
            </div>

            <!-- 내 결재 대기 목록 -->
            <div class="md:col-span-2 bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div class="flex items-center gap-2 font-semibold text-sm text-zinc-700 dark:text-zinc-300 mb-1">
                    <i class="pi pi-clock text-emerald-500" />
                    내 결재 대기
                    <span
                        v-if="(data?.pendingCount ?? 0) > 0"
                        class="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                    >
                        {{ data!.pendingCount }}건
                    </span>
                </div>
                <div v-if="pending" class="space-y-3 mt-3">
                    <Skeleton v-for="i in 3" :key="i" height="48px" />
                </div>
                <div v-else-if="!data?.pendingList?.length" class="text-center py-6 text-zinc-400 text-xs mt-3">
                    결재 대기 항목이 없습니다
                </div>
                <div v-else class="space-y-0 mt-3">
                    <div
                        v-for="item in data.pendingList"
                        :key="item.apfMngNo"
                        class="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-700 last:border-0 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded px-1 -mx-1 transition-colors"
                        @click="navigateToPending(item)"
                    >
                        <div class="min-w-0">
                            <div class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                {{ item.title }}
                            </div>
                            <div class="text-xs text-zinc-400 mt-0.5">
                                <i class="pi pi-user mr-1" />{{ item.requesterName }} · {{ item.requestedAt }}
                            </div>
                        </div>
                        <span
                            class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2"
                            :class="urgencyBadgeClass(item.urgency)"
                        >
                            {{ urgencyLabel(item.urgency) }}
                        </span>
                    </div>
                </div>
                <div
                    class="mt-3 text-center text-xs text-emerald-500 hover:underline cursor-pointer"
                    @click="navigateTo('/approval/list?tab=pending')"
                >
                    <i class="pi pi-arrow-right mr-1" />전체 결재함
                </div>
            </div>
        </div>
    </div>
</template>
```

- [ ] **타입 체크** — `npx nuxt typecheck`  
  예상: 오류 없음

- [ ] **브라우저 확인** — `http://localhost:3000/approval`
  - KPI 카드 4개
  - 6개월 바 차트
  - 내 결재 대기 목록 또는 "없습니다" 메시지

- [ ] **커밋**
```bash
git add it_frontend/app/pages/approval/index.vue
git commit -m "feat: 전자결재 Home 대시보드 페이지 구현"
```

---

## 최종 검증

- [ ] **백엔드 전체 빌드** — `cd it_backend && ./gradlew build`
- [ ] **프론트 타입 체크** — `cd it_frontend && npx nuxt typecheck`
- [ ] **통합 확인** (백엔드 + 프론트 동시 기동):
  - `/info/documents` → 대시보드 데이터 정상 로딩
  - `/info/documents/list` → 기존 목록 화면 정상
  - `/approval` → 대시보드 데이터 정상 로딩
  - `/approval/list` → 기존 결재 화면 정상
  - 사이드바 컨텍스트 자동 전환 확인
  - 배지 수치 정상 표시 확인
