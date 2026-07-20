# TPRMPP_BRDOCM 문서버전(DOC_VRS) 복합키 도입 설계

**날짜:** 2026-04-22  
**대상 테이블:** `TPRMPP_BRDOCM`  
**범위:** 백엔드(Entity/Repository/Service/Controller/DTO) + 프론트엔드(composable/pages)

---

## 1. 배경

`TPRMPP_BRDOCM` 테이블에 `DOC_VRS NUMBER(4,2) NOT NULL` 컬럼이 추가되고, 기존 단일 PK `DOC_MNG_NO`와 함께 `(DOC_MNG_NO, DOC_VRS)` 복합키로 변경되었다. 문서버전은 `0.01`부터 시작한다.

---

## 2. 버전 관리 정책

- **신규 생성:** `DOC_VRS = 0.01` 고정
- **일반 수정:** 현재 최신 버전을 덮어쓰기 (버전 번호 유지)
- **새 버전 생성:** 사용자가 명시적으로 "새 버전으로 저장" 액션을 실행할 때만 `최신 DOC_VRS + 0.01` 버전이 생성됨
- **이전 버전:** 새 버전 생성 후에도 이전 버전은 삭제되지 않고 조회 가능 (완전한 이력 관리)
- **목록 표시:** 각 `DOC_MNG_NO`의 최신 버전 1건만 목록에 표시, 버전 히스토리는 상세 페이지에서 확인
- **삭제:** Soft Delete(`DEL_YN='Y'`), 특정 버전 또는 전체 버전 삭제 가능

---

## 3. 데이터 레이어 (백엔드)

### 3.1 복합키 클래스 — `BrdocmId.java` (신규)

```java
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BrdocmId implements Serializable {
    private String docMngNo;
    private BigDecimal docVrs;
}
```

`CdecimId.java`의 기존 `@IdClass` 패턴을 동일하게 따른다.

### 3.2 엔티티 변경 — `Brdocm.java`

**변경 사항:**
- `@IdClass(BrdocmId.class)` 클래스 레벨 추가
- `@Id String docMngNo` 유지
- `@Id @Column(name="DOC_VRS", nullable=false, precision=4, scale=2) BigDecimal docVrs` 신규 추가
- `update()` 메서드 시그니처 유지 (버전 변경 없음)
- `newVersion(BigDecimal nextVrs)` 메서드 신규 추가 — 현재 엔티티를 복사하여 새 버전 엔티티 반환

```java
public Brdocm newVersion(BigDecimal nextVrs) {
    return Brdocm.builder()
        .docMngNo(this.docMngNo)
        .docVrs(nextVrs)
        .reqNm(this.reqNm)
        .reqCone(this.reqCone)
        .reqDtt(this.reqDtt)
        .bzDtt(this.bzDtt)
        .fsgTlm(this.fsgTlm)
        .build();
}
```

### 3.3 Repository 변경 — `ServiceRequestDocRepository.java`

```java
public interface ServiceRequestDocRepository extends JpaRepository<Brdocm, BrdocmId> {

    // 최신 버전 단건 (목록/상세 기본 조회)
    Optional<Brdocm> findTopByDocMngNoAndDelYnOrderByDocVrsDesc(String docMngNo, String delYn);

    // 특정 버전 단건
    Optional<Brdocm> findByDocMngNoAndDocVrsAndDelYn(String docMngNo, BigDecimal docVrs, String delYn);

    // 전체 버전 목록 (버전 히스토리)
    List<Brdocm> findAllByDocMngNoAndDelYnOrderByDocVrsDesc(String docMngNo, String delYn);

    // 목록 페이지용: 각 docMngNo의 최신 버전만 (Native Query)
    @Query(value = """
        SELECT * FROM TPRMPP_BRDOCM d
        WHERE d.DEL_YN = 'N'
          AND d.DOC_VRS = (
              SELECT MAX(d2.DOC_VRS) FROM TPRMPP_BRDOCM d2
              WHERE d2.DOC_MNG_NO = d.DOC_MNG_NO AND d2.DEL_YN = 'N'
          )
        ORDER BY d.FST_ENR_DTM DESC
        """, nativeQuery = true)
    List<Brdocm> findLatestVersionsAll();

    // 존재 여부 확인 (중복 채번 방지)
    boolean existsByDocMngNoAndDelYn(String docMngNo, String delYn);

    // Oracle 시퀀스 채번
    @Query(value = "SELECT S_DOC.NEXTVAL FROM DUAL", nativeQuery = true)
    Long getNextSequenceValue();
}
```

---

## 4. API 레이어 (백엔드)

### 4.1 엔드포인트

| Method | URL | 설명 |
|--------|-----|------|
| `GET` | `/api/documents` | 목록 (각 문서의 최신 버전만) |
| `GET` | `/api/documents/{docMngNo}` | 최신 버전 단건 조회 |
| `GET` | `/api/documents/{docMngNo}?version=0.01` | 특정 버전 조회 |
| `GET` | `/api/documents/{docMngNo}/versions` | 전체 버전 목록 |
| `POST` | `/api/documents` | 신규 생성 (v0.01) |
| `PUT` | `/api/documents/{docMngNo}` | 현재 최신 버전 수정 (덮어쓰기) |
| `POST` | `/api/documents/{docMngNo}/versions` | 새 버전 생성 (최신+0.01) |
| `DELETE` | `/api/documents/{docMngNo}` | 전체 버전 소프트 삭제 |
| `DELETE` | `/api/documents/{docMngNo}?version=0.01` | 특정 버전 소프트 삭제 |

### 4.2 DTO 변경 — `ServiceRequestDocDto.java`

**`CreateRequest`:** 변경 없음 (`docVrs`는 서버에서 0.01 자동 설정)

**`UpdateRequest`:** 변경 없음 (버전 변경 없는 수정)

**`Response`:** `docVrs` 필드 추가
```java
@Schema(description = "문서버전")
private BigDecimal docVrs;
```

**`VersionResponse` (신규):** 버전 히스토리 목록용 경량 DTO
```java
// 포함 필드: docMngNo, docVrs, fstEnrDtm, lstChgDtm, delYn
```

### 4.3 서비스 메서드 — `ServiceRequestDocService.java`

```
getDocumentList()            → findLatestVersionsAll() 사용
getDocument(docMngNo, version?)
  - version 없음: findTopByDocMngNoAndDelYnOrderByDocVrsDesc()
  - version 있음: findByDocMngNoAndDocVrsAndDelYn()
getVersionHistory(docMngNo)  → findAllByDocMngNoAndDelYnOrderByDocVrsDesc()
createDocument(request)      → docVrs = BigDecimal("0.01") 고정
updateDocument(docMngNo, request) → 최신 버전 Dirty Checking
createNewVersion(docMngNo)   → 최신 버전 조회 → newVersion(최신+0.01) → save()
deleteDocument(docMngNo, version?)
  - version 없음: 전체 버전 소프트 삭제
  - version 있음: 특정 버전 소프트 삭제
```

### 4.4 컨트롤러 변경 — `ServiceRequestDocController.java`

```java
@GetMapping("/{docMngNo}")
ResponseEntity<Response> getDocument(
    @PathVariable String docMngNo,
    @RequestParam(required = false) BigDecimal version
)

@GetMapping("/{docMngNo}/versions")
ResponseEntity<List<VersionResponse>> getVersionHistory(@PathVariable String docMngNo)

@PostMapping("/{docMngNo}/versions")
ResponseEntity<String> createNewVersion(@PathVariable String docMngNo)

@DeleteMapping("/{docMngNo}")
ResponseEntity<Void> deleteDocument(
    @PathVariable String docMngNo,
    @RequestParam(required = false) BigDecimal version
)
```

---

## 5. 프론트엔드

### 5.1 타입/Composable 변경 — `useDocuments.ts`

```typescript
interface RequirementDocument {
    docMngNo: string;
    docVrs: number;      // 신규 추가
    // ... 기존 필드 유지
}

interface VersionSummary {
    docMngNo: string;
    docVrs: number;
    fstEnrDtm: string;
    lstChgDtm: string;
    delYn: string;
}

// 변경: version 선택적 파라미터
fetchDocument(docMngNo: string, version?: number)
// 신규
fetchVersionHistory(docMngNo: string): VersionSummary[]
createNewVersion(docMngNo: string): Promise<string>
// 변경: version 선택적 파라미터
deleteDocument(docMngNo: string, version?: number)
```

### 5.2 목록 페이지 (`index.vue`)

- `버전` 컬럼 추가 (`docVrs`, 중앙 정렬)
- `data-key` 변경: `"docMngNo"` → `(row) => row.docMngNo + '_' + row.docVrs`

### 5.3 상세 페이지 (`[id]/index.vue`)

- 헤더 영역에 현재 버전 배지 표시 (예: `v0.01`)
- 액션 버튼 추가: **"새 버전으로 저장"** — `createNewVersion()` 호출 후 동일 URL로 refresh
- 우측 사이드바에 **버전 히스토리 패널** 추가:
  - `fetchVersionHistory()` 결과를 버전 내림차순 목록으로 표시
  - 현재 보고 있는 버전 하이라이트
  - 클릭 시 `?version=x.xx` 쿼리 파라미터로 해당 버전 조회
  - 과거 버전 조회 시 읽기 전용 배너 표시

### 5.4 URL 설계

- 최신 버전: `/info/documents/{docMngNo}` (변경 없음)
- 특정 버전: `/info/documents/{docMngNo}?version=0.01`

---

## 6. 구현 순서

1. `BrdocmId.java` 생성
2. `Brdocm.java` 수정 (복합키, `newVersion()` 메서드)
3. `ServiceRequestDocDto.java` 수정 (`docVrs` 추가, `VersionResponse` 추가)
4. `ServiceRequestDocRepository.java` 수정 (복합키 타입, 신규 쿼리 메서드)
5. `ServiceRequestDocService.java` 수정 (전 메서드 + `createNewVersion`, `getVersionHistory`)
6. `ServiceRequestDocController.java` 수정 (신규 엔드포인트)
7. `useDocuments.ts` 수정 (타입, 신규 함수)
8. `index.vue` 수정 (버전 컬럼)
9. `[id]/index.vue` 수정 (버전 배지, 새 버전 버튼, 버전 히스토리 사이드바)
