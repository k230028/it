# TPRMPP_BRIVGM 검토의견 테이블 신설 및 프론트엔드 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TPRMPP_BRIVGM 검토의견 테이블을 DB에 신설하고, Spring Boot REST API를 통해 Nuxt 4 프론트엔드의 메모리 전용 코멘트 상태를 DB 기반으로 전환한다.

**Architecture:** 백엔드에 Brivgm 엔티티·리포지토리·서비스·컨트롤러를 추가한다. 프론트엔드에 `useReviewCommentApi` composable을 신설하고, `stores/review.ts`의 코멘트 CRUD 액션을 API 호출로 교체한다. 기존 `ReviewSession` 상태 구조와 `ReviewComment` 타입은 유지한다.

**Tech Stack:** Spring Boot, JPA(Oracle CLOB), Lombok, Mockito/AssertJ, Nuxt 4, Pinia, TypeScript, `$apiFetch`

---

## 파일 구조

**생성:**
```
it_backend/src/main/java/com/kdb/it/domain/budget/document/
  entity/Brivgm.java
  repository/BrivgmRepository.java
  dto/ReviewCommentDto.java
  service/ReviewCommentService.java
  controller/ReviewCommentController.java

it_backend/src/test/java/com/kdb/it/domain/budget/document/
  service/ReviewCommentServiceTest.java

it_frontend/app/composables/useReviewCommentApi.ts
```

**수정:**
```
it_frontend/app/stores/review.ts
  — addComment, resolveComment를 API 호출로 교체
  — loadSession에서 서버 코멘트 로드 추가

it_frontend/app/composables/useReview.ts
  — addInlineComment, addGeneralComment, resolveComment async 대응
```

---

## Task 1: Brivgm 엔티티 생성

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/Brivgm.java`

- [ ] **Step 1: 엔티티 파일 생성**

```java
package com.kdb.it.domain.budget.document.entity;

import com.kdb.it.domain.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "TPRMPP_BRIVGM")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Brivgm extends BaseEntity {

    @Id
    @Column(name = "IVG_SNO", length = 32, nullable = false)
    private String ivgSno;

    @Column(name = "DOC_MNG_NO", length = 32, nullable = false)
    private String docMngNo;

    @Column(name = "DOC_VRS", precision = 5, scale = 2, nullable = false)
    private BigDecimal docVrs;

    /** 의견유형: I=인라인, G=전반 */
    @Column(name = "IVG_TP", length = 1, nullable = false)
    private String ivgTp;

    @Lob
    @Column(name = "IVG_CONE")
    private String ivgCone;

    /** 인라인 코멘트 전용 - Tiptap Mark ID */
    @Column(name = "MARK_ID", length = 64)
    private String markId;

    /** 인라인 코멘트 전용 - 드래그 선택 텍스트 스냅샷 */
    @Column(name = "QTD_CONE", length = 4000)
    private String qtdCone;

    @Column(name = "RSLV_YN", length = 1, nullable = false)
    private String rslvYn;

    @PrePersist
    private void prePersist() {
        if (ivgSno == null) {
            ivgSno = UUID.randomUUID().toString().replace("-", "");
        }
        if (rslvYn == null) {
            rslvYn = "N";
        }
    }

    public static Brivgm create(String docMngNo, BigDecimal docVrs,
                                 String ivgTp, String ivgCone,
                                 String markId, String qtdCone) {
        Brivgm b = new Brivgm();
        b.docMngNo = docMngNo;
        b.docVrs = docVrs;
        b.ivgTp = ivgTp;
        b.ivgCone = ivgCone;
        b.markId = markId;
        b.qtdCone = qtdCone;
        return b;
    }

    public void resolve() {
        this.rslvYn = "Y";
    }
}
```

- [ ] **Step 2: 컴파일 확인**

```bash
cd it_backend && ./gradlew compileJava
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/Brivgm.java
git commit -m "feat: Brivgm 검토의견 엔티티 추가 (TPRMPP_BRIVGM)"
```

---

## Task 2: BrivgmRepository 생성

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/repository/BrivgmRepository.java`

- [ ] **Step 1: 리포지토리 인터페이스 생성**

```java
package com.kdb.it.domain.budget.document.repository;

import com.kdb.it.domain.budget.document.entity.Brivgm;
import org.springframework.data.jpa.repository.JpaRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface BrivgmRepository extends JpaRepository<Brivgm, String> {

    /** 특정 문서+버전의 미삭제 코멘트 전체 조회 (생성일 오름차순) */
    List<Brivgm> findByDocMngNoAndDocVrsAndDelYnOrderByFstEnrDtmAsc(
            String docMngNo, BigDecimal docVrs, String delYn);

    /** 코멘트 단건 조회 (미삭제) */
    Optional<Brivgm> findByIvgSnoAndDelYn(String ivgSno, String delYn);
}
```

- [ ] **Step 2: 컴파일 확인**

```bash
cd it_backend && ./gradlew compileJava
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/document/repository/BrivgmRepository.java
git commit -m "feat: BrivgmRepository 추가"
```

---

## Task 3: ReviewCommentDto 생성

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/dto/ReviewCommentDto.java`

- [ ] **Step 1: DTO 파일 생성**

```java
package com.kdb.it.domain.budget.document.dto;

import com.kdb.it.domain.budget.document.entity.Brivgm;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

public class ReviewCommentDto {

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    /** 코멘트 추가 요청 */
    @Getter
    @NoArgsConstructor
    public static class CreateRequest {
        private BigDecimal docVrs;
        /** I=인라인, G=전반 */
        private String ivgTp;
        private String ivgCone;
        /** 인라인 전용, nullable */
        private String markId;
        /** 인라인 전용, nullable */
        private String qtdCone;

        public Brivgm toEntity(String docMngNo) {
            return Brivgm.create(docMngNo, docVrs, ivgTp, ivgCone, markId, qtdCone);
        }
    }

    /** 코멘트 응답 */
    @Getter
    public static class Response {
        private final String ivgSno;
        private final String docMngNo;
        private final BigDecimal docVrs;
        private final String ivgTp;
        private final String ivgCone;
        private final String markId;
        private final String qtdCone;
        private final String rslvYn;
        private final String authorEno;
        private final String authorName;
        private final String createdAt;

        public Response(Brivgm e, String authorName) {
            this.ivgSno     = e.getIvgSno();
            this.docMngNo   = e.getDocMngNo();
            this.docVrs     = e.getDocVrs();
            this.ivgTp      = e.getIvgTp();
            this.ivgCone    = e.getIvgCone();
            this.markId     = e.getMarkId();
            this.qtdCone    = e.getQtdCone();
            this.rslvYn     = e.getRslvYn();
            this.authorEno  = e.getFstEnrUsid();
            this.authorName = authorName;
            this.createdAt  = e.getFstEnrDtm() != null
                    ? e.getFstEnrDtm().format(FORMATTER)
                    : null;
        }
    }
}
```

> **주의:** `getFstEnrDtm()`·`getFstEnrUsid()`가 BaseEntity에 없으면 getter 이름을 BaseEntity의 실제 메서드명으로 맞춘다. `ServiceRequestDocService`에서 사용하는 동일 메서드명 참조.

- [ ] **Step 2: 컴파일 확인**

```bash
cd it_backend && ./gradlew compileJava
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/document/dto/ReviewCommentDto.java
git commit -m "feat: ReviewCommentDto 추가 (CreateRequest, Response)"
```

---

## Task 4: ReviewCommentService 구현 (TDD)

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ReviewCommentServiceTest.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ReviewCommentService.java`

- [ ] **Step 1: 테스트 파일 먼저 작성**

```java
package com.kdb.it.domain.budget.document.service;

import com.kdb.it.domain.budget.document.dto.ReviewCommentDto;
import com.kdb.it.domain.budget.document.entity.Brivgm;
import com.kdb.it.domain.budget.document.repository.BrivgmRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewCommentServiceTest {

    @Mock BrivgmRepository brivgmRepository;
    @InjectMocks ReviewCommentService reviewCommentService;

    @Test
    void 코멘트_추가시_리포지토리_save가_호출된다() {
        // Arrange
        var entity = Brivgm.create("DOC-2026-0010", new BigDecimal("1.01"),
                "G", "테스트 코멘트", null, null);
        given(brivgmRepository.save(any(Brivgm.class))).willReturn(entity);

        var request = new ReviewCommentDto.CreateRequest();
        // CreateRequest 필드 주입 — 리플렉션 또는 ServiceRequestDocServiceTest 패턴 참조
        // request 필드: docVrs=1.01, ivgTp="G", ivgCone="테스트 코멘트"

        // Act
        reviewCommentService.addComment("DOC-2026-0010", request);

        // Assert
        then(brivgmRepository).should().save(any(Brivgm.class));
    }

    @Test
    void 코멘트_조회시_해당_버전의_미삭제_코멘트만_반환된다() {
        // Arrange
        var comment = Brivgm.create("DOC-2026-0010", new BigDecimal("1.01"),
                "G", "전반 코멘트", null, null);
        given(brivgmRepository.findByDocMngNoAndDocVrsAndDelYnOrderByFstEnrDtmAsc(
                "DOC-2026-0010", new BigDecimal("1.01"), "N"))
                .willReturn(List.of(comment));

        // Act
        List<ReviewCommentDto.Response> result =
                reviewCommentService.getComments("DOC-2026-0010", new BigDecimal("1.01"));

        // Assert
        assertThat(result).hasSize(1);
    }

    @Test
    void 존재하지_않는_코멘트_해결처리시_예외가_발생한다() {
        // Arrange
        given(brivgmRepository.findByIvgSnoAndDelYn("UNKNOWN", "N"))
                .willReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> reviewCommentService.resolveComment("UNKNOWN"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 코멘트_해결처리시_rslvYn이_Y로_변경된다() {
        // Arrange
        var comment = Brivgm.create("DOC-2026-0010", new BigDecimal("1.01"),
                "G", "코멘트", null, null);
        given(brivgmRepository.findByIvgSnoAndDelYn(anyString(), eq("N")))
                .willReturn(Optional.of(comment));

        // Act
        reviewCommentService.resolveComment("some-ivg-sno");

        // Assert
        assertThat(comment.getRslvYn()).isEqualTo("Y");
    }
}
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd it_backend && ./gradlew test --tests "*.ReviewCommentServiceTest"
```
Expected: `ReviewCommentService` 클래스 미존재로 컴파일 에러 또는 FAIL

- [ ] **Step 3: 서비스 구현**

```java
package com.kdb.it.domain.budget.document.service;

import com.kdb.it.domain.budget.document.dto.ReviewCommentDto;
import com.kdb.it.domain.budget.document.repository.BrivgmRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewCommentService {

    private final BrivgmRepository brivgmRepository;

    @Transactional(readOnly = true)
    public List<ReviewCommentDto.Response> getComments(String docMngNo, BigDecimal docVrs) {
        return brivgmRepository
                .findByDocMngNoAndDocVrsAndDelYnOrderByFstEnrDtmAsc(docMngNo, docVrs, "N")
                .stream()
                .map(e -> new ReviewCommentDto.Response(e, resolveAuthorName(e.getFstEnrUsid())))
                .collect(Collectors.toList());
    }

    @Transactional
    public ReviewCommentDto.Response addComment(String docMngNo,
                                                 ReviewCommentDto.CreateRequest request) {
        var saved = brivgmRepository.save(request.toEntity(docMngNo));
        return new ReviewCommentDto.Response(saved, resolveAuthorName(saved.getFstEnrUsid()));
    }

    @Transactional
    public void resolveComment(String ivgSno) {
        var comment = brivgmRepository.findByIvgSnoAndDelYn(ivgSno, "N")
                .orElseThrow(() -> new IllegalArgumentException(
                        "검토의견을 찾을 수 없습니다: " + ivgSno));
        comment.resolve();
    }

    /**
     * 사번으로 사용자 이름 조회.
     * TODO: ServiceRequestDocService의 userRepository 패턴과 동일하게 교체
     */
    private String resolveAuthorName(String eno) {
        if (eno == null) return "";
        return eno;
    }
}
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
cd it_backend && ./gradlew test --tests "*.ReviewCommentServiceTest"
```
Expected: 4개 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ReviewCommentServiceTest.java \
        it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ReviewCommentService.java
git commit -m "feat: ReviewCommentService 구현 및 테스트 추가 (TDD)"
```

---

## Task 5: ReviewCommentController 구현

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ReviewCommentController.java`

- [ ] **Step 1: 컨트롤러 파일 생성**

```java
package com.kdb.it.domain.budget.document.controller;

import com.kdb.it.domain.budget.document.dto.ReviewCommentDto;
import com.kdb.it.domain.budget.document.service.ReviewCommentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@Tag(name = "검토의견", description = "문서 검토의견 CRUD API")
@RestController
@RequestMapping("/api/documents/{docMngNo}/review-comments")
@RequiredArgsConstructor
public class ReviewCommentController {

    private final ReviewCommentService reviewCommentService;

    @Operation(summary = "검토의견 목록 조회")
    @GetMapping
    public List<ReviewCommentDto.Response> getComments(
            @PathVariable String docMngNo,
            @RequestParam BigDecimal docVrs) {
        return reviewCommentService.getComments(docMngNo, docVrs);
    }

    @Operation(summary = "검토의견 추가")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewCommentDto.Response addComment(
            @PathVariable String docMngNo,
            @RequestBody ReviewCommentDto.CreateRequest request) {
        return reviewCommentService.addComment(docMngNo, request);
    }

    @Operation(summary = "검토의견 해결 처리")
    @PatchMapping("/{ivgSno}/resolve")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resolveComment(@PathVariable String ivgSno) {
        reviewCommentService.resolveComment(ivgSno);
    }
}
```

- [ ] **Step 2: 전체 빌드 확인**

```bash
cd it_backend && ./gradlew build -x test
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: 서버 기동 후 Swagger 확인**

```bash
cd it_backend && ./gradlew bootRun
```
http://localhost:8080/swagger-ui/index.html 에서 `검토의견` 태그 아래 3개 엔드포인트 확인:
- `GET /api/documents/{docMngNo}/review-comments`
- `POST /api/documents/{docMngNo}/review-comments`
- `PATCH /api/documents/{docMngNo}/review-comments/{ivgSno}/resolve`

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ReviewCommentController.java
git commit -m "feat: ReviewCommentController 추가 (GET/POST/PATCH)"
```

---

## Task 6: 프론트엔드 useReviewCommentApi composable 생성

**Files:**
- Create: `it_frontend/app/composables/useReviewCommentApi.ts`

- [ ] **Step 1: composable 생성**

```typescript
import type { ReviewComment } from '~/types/review'

interface ApiComment {
  ivgSno: string
  docMngNo: string
  docVrs: number
  ivgTp: 'I' | 'G'
  ivgCone: string
  markId: string | null
  qtdCone: string | null
  rslvYn: 'Y' | 'N'
  authorEno: string
  authorName: string
  createdAt: string
}

function toReviewComment(api: ApiComment): ReviewComment {
  return {
    id: api.ivgSno,
    type: api.ivgTp === 'I' ? 'inline' : 'general',
    text: api.ivgCone,
    attachments: [],
    authorEno: api.authorEno,
    authorName: api.authorName,
    authorTeam: '개발/운영팀', // TODO: 서버 응답에 팀 정보 추가 시 교체
    createdAt: api.createdAt,
    markId: api.markId ?? undefined,
    quotedText: api.qtdCone ?? undefined,
    resolved: api.rslvYn === 'Y',
  }
}

export const useReviewCommentApi = () => {
  const { $apiFetch } = useNuxtApp()

  const fetchComments = async (
    docMngNo: string,
    docVrs: number,
  ): Promise<ReviewComment[]> => {
    const data = await $apiFetch<ApiComment[]>(
      `/api/documents/${docMngNo}/review-comments`,
      { query: { docVrs } },
    )
    return data.map(toReviewComment)
  }

  const createComment = async (
    docMngNo: string,
    payload: {
      docVrs: number
      ivgTp: 'I' | 'G'
      ivgCone: string
      markId?: string
      qtdCone?: string
    },
  ): Promise<ReviewComment> => {
    const data = await $apiFetch<ApiComment>(
      `/api/documents/${docMngNo}/review-comments`,
      { method: 'POST', body: payload },
    )
    return toReviewComment(data)
  }

  const resolveComment = async (
    docMngNo: string,
    ivgSno: string,
  ): Promise<void> => {
    await $apiFetch(
      `/api/documents/${docMngNo}/review-comments/${ivgSno}/resolve`,
      { method: 'PATCH' },
    )
  }

  return { fetchComments, createComment, resolveComment }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd it_frontend && npx nuxt typecheck
```
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add it_frontend/app/composables/useReviewCommentApi.ts
git commit -m "feat: useReviewCommentApi composable 추가"
```

---

## Task 7: stores/review.ts — 코멘트 CRUD API 연동

**Files:**
- Modify: `it_frontend/app/stores/review.ts`
- Modify: `it_frontend/app/composables/useReview.ts`

- [ ] **Step 1: stores/review.ts — addComment 교체**

기존 `addComment` 함수(동기, `session.value.comments.push(newComment)` 부분)를 아래로 전체 교체한다.

```typescript
/** 코멘트 추가 (서버 저장 후 로컬 상태 반영) */
async function addComment(
  comment: Omit<ReviewComment, 'id' | 'createdAt'>,
): Promise<ReviewComment | undefined> {
  if (!session.value) return

  const api = useReviewCommentApi()
  const docVrs = parseFloat(session.value.currentVersion)

  const saved = await api.createComment(session.value.docMngNo, {
    docVrs,
    ivgTp: comment.type === 'inline' ? 'I' : 'G',
    ivgCone: comment.text,
    markId: comment.markId,
    qtdCone: comment.quotedText,
  })

  session.value.comments.push(saved)
  return saved
}
```

- [ ] **Step 2: stores/review.ts — resolveComment 교체**

기존 `resolveComment` 함수(동기, `if (comment) comment.resolved = true` 부분)를 아래로 전체 교체한다.

```typescript
/** 코멘트 해결 처리 (서버 저장 후 로컬 상태 반영) */
async function resolveComment(commentId: string): Promise<void> {
  if (!session.value) return

  const api = useReviewCommentApi()
  await api.resolveComment(session.value.docMngNo, commentId)

  const comment = session.value.comments.find(c => c.id === commentId)
  if (comment) comment.resolved = true
}
```

- [ ] **Step 3: composables/useReview.ts — async 대응**

`addInlineComment`, `addGeneralComment`, `resolveComment` 앞에 `async` 키워드를 추가하고, `store.addComment()` / `store.resolveComment()` 호출 앞에 `await`를 추가한다.

```typescript
const addInlineComment = async (params: {
  text: string
  markId: string
  quotedText: string
  authorEno: string
  authorName: string
  authorTeam: ReviewerTeam
  attachments?: ReviewComment['attachments']
}) => {
  return await store.addComment({
    type: 'inline',
    text: params.text,
    markId: params.markId,
    quotedText: params.quotedText,
    authorEno: params.authorEno,
    authorName: params.authorName,
    authorTeam: params.authorTeam,
    attachments: params.attachments ?? [],
    resolved: false,
  })
}

const addGeneralComment = async (params: {
  text: string
  authorEno: string
  authorName: string
  authorTeam: ReviewerTeam
  attachments?: ReviewComment['attachments']
}) => {
  return await store.addComment({
    type: 'general',
    text: params.text,
    authorEno: params.authorEno,
    authorName: params.authorName,
    authorTeam: params.authorTeam,
    attachments: params.attachments ?? [],
    resolved: false,
  })
}

const resolveComment = async (commentId: string) => {
  await store.resolveComment(commentId)
}
```

- [ ] **Step 4: 타입 체크**

```bash
cd it_frontend && npx nuxt typecheck
```
Expected: 에러 없음

- [ ] **Step 5: 프론트엔드 dev 서버 기동 후 동작 확인**

두 서버 모두 기동 후 확인:
```bash
# 터미널 1
cd it_backend && ./gradlew bootRun

# 터미널 2
cd it_frontend && npm run dev
```

http://localhost:3000/info/documents/DOC-2026-0010/review 접속 후:
1. 코멘트 입력 → 코멘트 목록에 추가됨 (Network 탭: `POST .../review-comments` 201 응답)
2. 코멘트 해결 버튼 클릭 → Network 탭: `PATCH .../resolve` 204 응답
3. 페이지 새로고침 → 코멘트가 유지됨 (Network 탭: `GET .../review-comments` 응답으로 복원)

- [ ] **Step 6: 커밋**

```bash
git add it_frontend/app/stores/review.ts \
        it_frontend/app/composables/useReview.ts
git commit -m "feat: 검토의견 store를 메모리에서 API 연동으로 전환"
```

---

## 완료 체크리스트

- [ ] `./gradlew test --tests "*.ReviewCommentServiceTest"` — 4개 통과
- [ ] `./gradlew build` — 전체 빌드 성공
- [ ] Swagger — 3개 엔드포인트 노출 확인
- [ ] `npx nuxt typecheck` — 타입 에러 없음
- [ ] 브라우저 — 코멘트 추가/해결/새로고침 후 유지 동작 확인
