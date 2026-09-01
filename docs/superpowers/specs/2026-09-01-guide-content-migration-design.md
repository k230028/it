# 가이드 콘텐츠 개발→운영 이관 설계

- 작성일: 2026-09-01
- 상태: 사용자 정책 승인 완료, 설계 문서 검토 대기
- 관련 저장소: `it_backend`, `it_frontend`, `it_database`
- 관련 설계: `docs/superpowers/specs/2026-08-29-common-data-migration-design.md`

## 1. 배경

현재 `/admin/migration/common-data`의 공통 데이터 이관은 메뉴·메뉴권한·경로·공통코드·다국어를 5개 시트 xlsx로 개발에서 운영으로 업서트한다. 이 계약은 정형 DB 행을 대상으로 하며 실제 파일 바이너리를 포함하지 않는다.

가이드 콘텐츠는 다음 두 저장소에 걸쳐 있다.

- `TPRMPP_BGDOCM`: 입력 길라잡이(`FDOC-*`)와 사업 가이드(`GDOC-*`)의 제목·HTML 본문
- `TPRMPP_CFILEM` 및 `${FILE_BASE_PATH}`: 본문의 이미지·다이어그램·일반 첨부파일 메타데이터와 실제 바이너리

HTML은 `data-file-id`, `data-attachment-id`, `/api/files/{id}` URL로 파일을 참조하고, Excalidraw 장면 파일은 압축된 JSON 내부에서 추가 이미지의 파일 ID를 참조한다. 따라서 DB 행만 이관하면 운영의 파일 참조가 깨진다.

사업 가이드는 최초 운영 세팅 후에도 개발에서 선택한 가이드만 반복 이관할 수 있어야 한다. 운영에서도 직접 편집할 수 있지만, 사용자가 확정한 정책에 따라 **이관하는 가이드는 개발본으로 전부 덮어쓴다.** 자동 병합이나 운영 변경 보호는 제공하지 않는다.

## 2. 목표

1. 기존 공통 데이터 xlsx 계약을 변경하지 않는다.
2. 입력 길라잡이와 사업 가이드를 문서·참조 파일이 완결된 ZIP으로 이관한다.
3. 사업 가이드만 전체 또는 선택 건으로 독립적으로 반복 이관할 수 있게 한다.
4. 선택한 가이드는 운영의 본문과 소유 파일 집합을 개발본으로 교체한다.
5. ZIP에 포함되지 않은 가이드와 그 파일은 변경하지 않는다.
6. 개발 DB의 파일 ID·물리 경로를 운영에 이식하지 않고 운영에서 새로 채번·저장한다.
7. dry-run과 commit이 같은 검증·계획 로직을 사용한다.

## 3. 비목표

- 운영과 개발의 HTML 자동 병합
- 운영 변경과 개발 변경의 3-way 충돌 판정
- 변경된 행만 담는 증분 패치 포맷
- `BNOTE-*` 예산 카드 참고사항 이관
- `TPRMPP_BGDOCM` 전체 테이블 복제
- Data Pump 또는 파일시스템 디렉터리 단순 복사
- ZIP에 포함되지 않은 운영 가이드 삭제
- 기존 공통 데이터 xlsx와 가이드 ZIP을 하나의 파일로 합치기

## 4. 확정된 정책

### 4.1 화면과 산출물

기존 `/admin/migration/common-data` 화면에 다음 세 영역을 독립적으로 둔다.

1. 공통 데이터 이관: 기존 5시트 xlsx
2. 입력 길라잡이 이관: `FDOC-*` 전용 ZIP
3. 사업 가이드 이관: `GDOC-*` 전용 ZIP

각 영역은 별도의 내보내기·파일 선택·dry-run·확정 버튼을 가진다. 사업 가이드 ZIP은 공통 데이터 xlsx나 입력 길라잡이 ZIP 없이 단독으로 왕복할 수 있다.

### 4.2 덮어쓰기

이관 파일에 포함된 가이드는 개발본이 절대 우선이다.

- 운영에 같은 가이드가 없으면 생성한다.
- 운영에 같은 활성 가이드가 하나 있으면 제목·본문을 개발본으로 갱신한다.
- 같은 논리 키의 논리삭제 가이드가 하나 있으면 부활시킨 뒤 갱신한다.
- 운영에서 편집한 본문도 별도 충돌 확인 없이 개발본으로 교체한다.
- 해당 운영 가이드가 소유한 기존 활성 파일은 논리 삭제하고 개발 ZIP의 파일로 교체한다.
- 내용이 완전히 같으면 `UNCHANGED`로 분류하고 쓰지 않는다.
- ZIP에 없는 운영 가이드는 유지한다.

dry-run에서 덮어쓸 문서 수와 논리 삭제될 운영 파일 수를 명확히 표시하고, 확정 전에 “운영에서 직접 수정한 내용과 첨부파일이 개발본으로 교체됩니다” 확인을 받는다.

### 4.3 원자성

한 ZIP에 포함된 모든 가이드는 하나의 반영 단위다. 문서 하나라도 검증에 실패하면 전체 commit을 거부한다. 부분 성공은 제공하지 않는다.

## 5. 도메인 범위와 논리 키

### 5.1 입력 길라잡이

- 대상: `DEL_YN='N'`, `DOC_MNG_NO LIKE 'FDOC-%'`
- 추가 제한: `DOC_TTL_CONE`이 `FormGuideCatalog`의 고정 길라잡이 ID와 일치해야 한다.
- 논리 키: `DOC_TTL_CONE`의 길라잡이 ID
- 운영 유일성: 기존 함수 기반 유일 인덱스 `UX_BGDOCM_FDOC_TARGET` 계약을 유지한다.

카탈로그 밖 FDOC 행은 내보내기 오류로 처리한다. 잘못된 행을 패키지에 조용히 섞거나 운영에 생성하지 않는다.

### 5.2 사업 가이드

- 대상: `DEL_YN='N'`, `DOC_MNG_NO LIKE 'GDOC-%'`
- 논리 키: 현재 화면이 단계와 문서를 매핑하는 값인 `DOC_TTL_CONE` 정확 일치값

사업 가이드 제목은 현재 런타임의 실질적인 식별자다. 반복 이관에서 안전하게 사용하려면 운영과 개발 모두 활성 GDOC 제목이 유일해야 한다. 다음 함수 기반 유일 인덱스를 새 Flyway 마이그레이션으로 추가한다.

```sql
CREATE UNIQUE INDEX UX_BGDOCM_GDOC_TITLE
    ON TPRMPP_BGDOCM (
        CASE
            WHEN DEL_YN = 'N' AND DOC_MNG_NO LIKE 'GDOC-%'
            THEN DOC_TTL_CONE
        END
    );
```

마이그레이션은 생성 전에 활성 GDOC 제목 중복을 전수 진단하고, 중복이 있으면 제목과 본문을 출력하지 않은 채 중복 키 건수만으로 실패한다. DBA가 중복 행을 정리한 뒤 재실행한다.

### 5.3 제외 대상

- `BNOTE-*`
- `FDOC-*`, `GDOC-*` 이외의 BGDOCM 행
- 논리삭제된 원본 가이드
- 요청에서 선택하지 않은 가이드

## 6. 가이드 집합 정의

가이드 한 건은 다음 요소를 포함하는 독립 집합이다.

1. BGDOCM의 논리 키, 제목, 정화된 HTML 본문
2. `APG_FL_KD_NM='가이드문서'`이고 `APG_FL_LNK_CTZ_NM=DOC_MNG_NO`인 직접 소유 활성 파일
3. HTML이 직접 참조하는 활성 파일
4. Excalidraw 장면 파일이 참조하는 활성 이미지 파일

참조 탐색은 다음 형식을 지원한다.

- `data-file-id="FL-..."`
- `data-attachment-id="FL-..."`
- `/api/files/{id}/preview`
- `/api/files/{id}/download`
- Excalidraw 압축 장면 JSON의 `files.*.attachmentId`

동일 파일 ID는 한 가이드 안에서 중복 제거한다. 서로 다른 가이드가 같은 원본 파일을 공유해도 운영에서는 가이드별 파일로 각각 생성한다. 그래야 한 가이드의 다음 덮어쓰기가 다른 가이드의 파일을 삭제하지 않는다.

다음 상태는 내보내기 오류다.

- 본문 또는 장면이 참조하는 CFILEM 행이 없음
- 참조 파일이 논리 삭제 상태
- 파일 메타데이터의 경로·물리명이 비어 있음
- 실제 파일이 없거나 읽을 수 없음
- Excalidraw 장면 압축 또는 JSON을 해석할 수 없음

직접 소유 파일이 아닌데 본문에서 참조된 파일은 패키지에 포함하되 경고를 남긴다. 운영 반입 시에는 가이드 소유 파일로 정규화한다.

## 7. 이식 가능한 참조 포맷

원본 `FL_MPN_ID`를 운영에 보존하지 않는다. ZIP 생성 시 파일 참조를 패키지 내부 논리 ID로 바꾼다.

논리 ID는 같은 집합에서 항상 같은 값이 나오도록 결정적으로 부여한다. HTML을 문서 순서로 탐색하면서 처음 만난 참조에 `file-0001`부터 부여하고, Excalidraw 장면의 파일 맵은 키 오름차순으로 탐색한다. 본문에서 참조하지 않는 직접 소유 파일은 `(fileType, originalName, blobSha256)` 오름차순으로 뒤에 붙인다. 원본 DB 조회 순서나 ZIP entry 순서는 논리 ID에 영향을 주지 않는다.

예:

```html
<span data-file-id="migfile://attachment-1"></span>
<figure data-type="excalidraw" data-attachment-id="migfile://scene-1"></figure>
```

Excalidraw 장면도 압축을 해제하고 내부 `attachmentId`를 `migfile://...`로 치환한 뒤 다시 압축하지 않고 이식용 JSON으로 ZIP에 저장한다. 운영 import는 모든 대상 파일의 새 `FL_MPN_ID`를 먼저 채번한 다음 다음 위치를 새 ID로 치환한다.

- 가이드 HTML의 `data-file-id`
- 가이드 HTML의 `data-attachment-id`
- 가이드 HTML의 파일 preview/download URL
- Excalidraw 장면 JSON의 이미지 `attachmentId`

이후 장면 JSON을 현재 프론트 계약과 같은 LZ-String Base64 형식으로 압축해 운영 파일로 저장한다. 알 수 없는 `migfile://` 참조가 하나라도 남으면 commit을 거부한다.

## 8. ZIP v1 포맷

한 ZIP에는 입력 길라잡이 또는 사업 가이드 중 한 종류만 들어간다.

```text
guide-content-v1.zip
├─ manifest.json
├─ guides/
│  ├─ guide-0001.json
│  └─ guide-0002.json
├─ scenes/
│  └─ scene-0001.json
└─ blobs/
   ├─ {sha256-1}
   └─ {sha256-2}
```

### 8.1 manifest.json

```json
{
  "format": "ITP_GUIDE_CONTENT",
  "version": 1,
  "bundleType": "BUSINESS_GUIDE",
  "createdAt": "2026-09-01T01:00:00Z",
  "guides": [
    {
      "entryId": "guide-0001",
      "guideKey": "사업계획",
      "sourceDocMngNo": "GDOC-2026-0001",
      "documentPath": "guides/guide-0001.json",
      "aggregateSha256": "..."
    }
  ],
  "files": [
    {
      "guideEntryId": "guide-0001",
      "logicalFileId": "attachment-1",
      "sourceFileId": "FL-00000001",
      "role": "ATTACHMENT",
      "originalName": "업무가이드.pdf",
      "fileType": "첨부파일",
      "size": 12345,
      "blobSha256": "...",
      "blobPath": "blobs/..."
    }
  ]
}
```

`sourceDocMngNo`와 `sourceFileId`는 dry-run 진단용이며 운영 PK로 사용하지 않는다. 원본 물리 경로·물리 파일명·GUID·감사 컬럼은 ZIP에 기록하지 않는다.

`role`은 `ATTACHMENT`, `IMAGE`, `EXCALIDRAW_SCENE`, `EXCALIDRAW_IMAGE` 중 하나다. 장면 항목은 `scenePath`로 이식용 JSON을 가리키며 blob을 사용하지 않는다.

### 8.2 guide JSON

```json
{
  "guideKey": "사업계획",
  "title": "사업계획",
  "contentHtml": "<p>...</p>"
}
```

모든 문자열은 UTF-8이다. JSON 속성명과 enum은 영문 고정이며 화면 언어에 따라 바꾸지 않는다.

### 8.3 집합 해시

`aggregateSha256`은 다음 정규화 JSON의 SHA-256이다.

- bundleType
- guideKey와 title
- `migfile://` 참조를 포함한 정화 HTML
- 논리 파일 ID 순으로 정렬한 role, originalName, fileType, size, blob SHA-256
- 정규화한 Excalidraw 장면 JSON

생성시각, 원본 DB PK, ZIP entry 순서는 해시에서 제외한다. 운영의 현재 가이드 집합도 같은 방식으로 정규화했을 때 해시가 같으면 `UNCHANGED`다.

## 9. 백엔드 API

관리자 전용 기본 경로는 `/api/admin/migration/guide-content`다. `SecurityConfig`의 `/api/admin/**` 제한에 더해 클래스 수준 `@PreAuthorize("hasRole('ADMIN')")`를 적용한다.

### 9.1 목록과 내보내기

| 메서드 | 경로 | 역할 |
| --- | --- | --- |
| GET | `/form-guides` | 이관 가능한 활성 FDOC 목록과 등록 상태 |
| GET | `/business-guides` | 이관 가능한 활성 GDOC 목록 |
| POST | `/form-guides/export` | 선택한 길라잡이 ZIP 다운로드 |
| POST | `/business-guides/export` | 선택한 사업 가이드 ZIP 다운로드 |

내보내기 요청은 `docMngNos[]`를 받는다. 서버는 ID로 원본을 찾은 뒤 prefix·활성 상태·논리 키 중복을 검증한다. 빈 선택은 거부하며 화면의 “전체 선택”은 현재 목록의 ID를 명시적으로 보낸다.

### 9.2 가져오기

| 메서드 | 경로 | 역할 |
| --- | --- | --- |
| POST | `/form-guides/dry-run` | FDOC ZIP 검증·반영 계획 |
| POST | `/form-guides/commit` | FDOC ZIP 확정 반영 |
| POST | `/business-guides/dry-run` | GDOC ZIP 검증·반영 계획 |
| POST | `/business-guides/commit` | GDOC ZIP 확정 반영 |

요청은 `multipart/form-data`의 `file` 한 개다. dry-run과 commit은 같은 ZIP을 각각 업로드한다. 기존 공통 데이터 이관처럼 commit이 모든 검증을 다시 수행하므로 서버 임시 job이나 sticky session에 의존하지 않는다. 프론트는 사용자가 선택한 동일 `File` 객체를 유지한다.

응답 예시:

```json
{
  "committed": false,
  "bundleType": "BUSINESS_GUIDE",
  "bundleSha256": "...",
  "guides": [
    {
      "guideKey": "사업계획",
      "action": "OVERWRITE",
      "filesAdded": 4,
      "filesDeleted": 3
    }
  ],
  "warnings": [],
  "errors": []
}
```

`action`은 `ADD`, `OVERWRITE`, `RESTORE`, `UNCHANGED`다. 오류가 하나라도 있으면 commit은 400으로 거부한다.

## 10. dry-run 검증

### 10.1 ZIP 안전성

- 압축 파일 최대 크기: 200 MiB
- entry 한 개의 압축 해제 후 최대 크기: 50 MiB
- 전체 압축 해제 후 최대 크기: 512 MiB
- 최대 entry 수: 2,000
- 절대경로, `..`, 역슬래시 경로 이탈, 중복 entry, 심볼릭 링크 거부
- manifest에 선언되지 않은 entry 거부
- blob의 실제 크기와 SHA-256 검증

한도는 다음 설정 키로 제공하되 위 값을 운영 기본값으로 한다.

- `app.migration.guide-content.max-bundle-bytes`
- `app.migration.guide-content.max-entry-bytes`
- `app.migration.guide-content.max-uncompressed-bytes`
- `app.migration.guide-content.max-entry-count`

### 10.2 계약 검증

- format과 version 정확 일치
- 엔드포인트 종류와 `bundleType` 일치
- guideKey·entryId·logicalFileId 중복 없음
- FDOC는 FormGuideCatalog에 존재
- GDOC guideKey는 비어 있지 않음
- 가이드별 모든 `migfile://` 참조가 manifest 파일로 해소됨
- 참조되지 않은 파일은 경고
- 파일명·확장자·크기는 기존 FileValidator 정책 통과
- portable HTML을 DOM으로 파싱할 수 있고 허용한 파일 참조 위치 밖에 `migfile://`가 없음
- dry-run은 논리 파일 ID를 결정적인 검사용 파일 ID로 치환한 뒤 `HtmlSanitizer`로 정화하고, 정화 뒤에도 같은 파일 참조가 보존됨
- 정화·재정규화한 집합 해시가 manifest와 일치
- 운영의 같은 논리 키 활성·삭제 행이 각각 2건 이상이면 오류
- 신규 파일 전체를 쓸 수 있는 저장소 경로인지 확인

### 10.3 운영 변경 표시

운영본 보호나 충돌 차단은 하지 않는다. 다만 `OVERWRITE` 행에는 다음 경고를 붙인다.

> 운영에서 직접 수정한 본문과 가이드 소유 첨부파일이 개발본으로 교체됩니다.

## 11. 확정 반영 흐름

### 11.1 계획 재생성

commit은 ZIP을 다시 해시·검증하고 현재 DB를 다시 조회한다. dry-run 응답을 신뢰하거나 클라이언트가 보낸 건수를 사용하지 않는다.

### 11.2 대상 문서 결정

가이드별 논리 키로 삭제 행을 포함해 조회한다.

- 활성 1건: 해당 운영 `DOC_MNG_NO` 유지
- 활성 0건, 삭제 1건: 해당 행 부활 후 재사용
- 아무 행 없음: 운영 `SQ_TPRMPP_BGDOCM_1`로 새 ID 채번
- 활성 또는 삭제 후보가 2건 이상: 전체 반영 차단

개발의 `sourceDocMngNo`는 운영 문서 ID로 사용하지 않는다.

### 11.3 파일 변환

가이드별 모든 파일에 운영 `SQ_TPRMPP_CFILEM_1` 기반 새 `FL_MPN_ID`를 할당한다. 같은 blob을 여러 가이드가 공유해도 CFILEM 행과 물리 파일은 가이드별로 만든다.

신규 CFILEM은 다음 규칙으로 정규화한다.

- `APG_FL_KD_NM='가이드문서'`
- `APG_FL_LNK_CTZ_NM=운영 DOC_MNG_NO`
- `FL_NM=manifest.originalName`
- `FL_TP_CONE=manifest.fileType`
- `APG_FL_SZ=실제 바이트 크기`
- `FL_PYS_NM`과 `FL_KPN_PTH`는 운영 FileUploadUnitService와 같은 안전한 채번·경로 정책
- 원본 상대경로가 필요하지 않으므로 `APG_FL_PTH=NULL`

논리 ID→운영 파일 ID 매핑으로 HTML과 Excalidraw 장면을 변환한다. 변환 후 `migfile://`가 남거나 운영 파일 ID가 manifest 범위를 벗어나면 반영하지 않는다.

HTML은 운영 파일 ID 치환을 끝낸 뒤 `HtmlSanitizer`로 다시 정화한다. 정화 결과를 다시 파싱해 치환한 파일 ID가 모두 남아 있고 새 ID가 추가되지 않았는지 확인한 결과만 BGDOCM에 저장한다. portable HTML 자체를 먼저 정화해 `migfile://` URL이 소실되는 순서는 사용하지 않는다.

### 11.4 운영 파일 교체

운영에서 논리 삭제할 대상은 다음 조건을 모두 만족하는 활성 파일이다.

- `APG_FL_KD_NM='가이드문서'`
- `APG_FL_LNK_CTZ_NM=대상 운영 DOC_MNG_NO`

해당 행은 `DEL_YN='Y'`로 바꾸며 기존 물리 파일은 현재 공통 파일 삭제 정책과 동일하게 남긴다. 다른 종류이거나 다른 부모에 속한 파일이 이전 HTML에서 참조되더라도 이관이 소유하지 않으므로 삭제하지 않고 경고만 남긴다.

### 11.5 파일시스템과 DB 실패 경계

파일시스템은 DB 트랜잭션에 참여하지 않으므로 다음 순서를 사용한다.

1. 요청별 임시 디렉터리에 ZIP을 안전하게 해제한다.
2. 새 운영 파일 ID·물리명을 확정하고 최종 저장 디렉터리에 새 파일을 쓴다. 기존 파일은 덮어쓰지 않는다.
3. 단일 DB 트랜잭션에서 BGDOCM 갱신·부활·생성, 기존 소유 CFILEM 논리 삭제, 신규 CFILEM 생성을 수행한다.
4. DB 롤백 시 이번 요청이 새로 만든 물리 파일만 삭제한다.
5. commit 성공 또는 실패 후 요청 임시 디렉터리를 삭제한다.

신규 물리명에는 요청 UUID를 포함한다. 프로세스 강제 종료로 2와 3 사이에 파일만 남는 경우를 위해, 24시간이 지난 이관 UUID 파일 중 CFILEM이 참조하지 않는 파일을 시작 시와 정기 작업에서 정리한다. 정리 작업은 기준 디렉터리 포함 검증과 이관 파일명 패턴을 모두 만족한 파일만 삭제한다.

## 12. 프론트엔드 흐름

### 12.1 입력 길라잡이 영역

- 사업 유형별 카탈로그 목록
- 전체/개별 선택
- 선택 ZIP 내보내기
- ZIP 선택 후 dry-run
- 추가·덮어쓰기·부활·변경없음과 파일 추가·삭제 건수 표시
- 오류가 없을 때만 확정 활성화

### 12.2 사업 가이드 영역

- 현재 활성 GDOC 제목과 수정일 목록
- 전체/개별 선택
- 선택 ZIP 내보내기
- ZIP 선택 후 dry-run
- 가이드별 `ADD/OVERWRITE/RESTORE/UNCHANGED` 표시
- `OVERWRITE` 또는 파일 삭제가 하나라도 있으면 위험 확인 대화상자 표시
- 확인 후 같은 File 객체를 commit 엔드포인트에 재업로드

사업 가이드 영역은 공통 데이터와 입력 길라잡이의 선택·파일·dry-run 상태를 공유하지 않는다. 한 영역의 파일을 바꾸거나 실패해도 다른 영역 상태를 초기화하지 않는다.

## 13. 캐시·감사·보안

- BGDOCM 변경은 JPA 엔티티를 경유해 `@LogTarget` 변경로그와 감사 컬럼을 유지한다.
- CFILEM은 엔티티 생성·논리삭제를 사용하고 감사 컬럼을 대상 환경 사용자 기준으로 기록한다.
- 원본 GUID, 등록자, 변경자, 등록일시를 복사하지 않는다.
- export·dry-run·commit 모두 관리자 감사 로그를 남긴다.
- 로그에는 제목, HTML 본문, 원본 파일명, 파일 바이트를 남기지 않는다. bundle SHA-256, bundleType, 가이드 건수, 파일 건수, 총 바이트, 성공/실패만 기록한다.
- 파일 읽기와 쓰기는 기준 경로 포함 검증, 확장자 허용목록, 크기 제한을 적용한다.
- 이관된 파일 종류는 `가이드문서`로 정규화해 `GuideDocFileReadAuthorizer`의 전사 인증 사용자 읽기 계약을 따른다.

## 14. 테스트 전략

### 14.1 백엔드 단위 테스트

- FDOC/GDOC 범위와 BNOTE 제외
- HTML의 세 가지 파일 참조 형식 추출·논리 ID 치환·복원
- Excalidraw 장면 압축 해제, 내부 이미지 참조 치환, 재압축 왕복
- 공유 원본 파일을 가이드별 운영 파일로 분리
- 집합 해시가 DB PK·ZIP 순서·생성시각에 영향받지 않음
- ADD/OVERWRITE/RESTORE/UNCHANGED 분류
- 운영 직접 수정본이 OVERWRITE로 분류됨
- ZIP에 없는 운영 가이드 유지
- 선택 가이드의 기존 소유 파일만 삭제 대상으로 분류
- 알 수 없는 참조·누락 blob·해시 불일치 차단
- ZIP Slip, 중복 entry, 크기·개수 한도 차단

### 14.2 백엔드 통합 테스트

- 임시 `app.file.base-path`에서 export ZIP의 모든 blob 검증
- commit 후 HTML·일반 첨부·Excalidraw 장면과 이미지 다운로드 성공
- 같은 ZIP 재반입 시 UNCHANGED이고 신규 CFILEM이 생기지 않음
- 운영에서 본문·파일 수정 후 같은 논리 키를 반입하면 개발본으로 복원
- 여러 가이드 중 하나가 실패하면 DB와 신규 물리 파일 모두 반영되지 않음
- DB 실패 시 새 물리 파일 보상 삭제
- 비관리자 403
- GDOC 활성 제목 유일 인덱스 검증

### 14.3 프론트엔드 테스트

- 공통 데이터·입력 길라잡이·사업 가이드 상태 격리
- 선택 ID가 export 요청에 정확히 전달됨
- dry-run 오류 시 확정 비활성
- OVERWRITE/파일 삭제 시 위험 확인 필수
- 취소 시 commit 미호출
- 확인 시 dry-run과 같은 File 객체 업로드
- 성공 뒤 해당 영역만 초기화·목록 재조회

### 14.4 검증 명령

```powershell
cd C:\it\it_backend
./gradlew test
./gradlew check

cd C:\it\it_frontend
npm run format:check
npm run check
npm test
npm run codegen:check
```

DB 마이그레이션은 로컬 Oracle에 적용한 뒤 중복 진단, 함수 기반 인덱스 표현식, Flyway checksum을 검증한다.

## 15. 구현 경계

백엔드는 `domain/migration/guidecontent/`에 다음 책임을 분리한다.

- Controller: 관리자 API와 multipart/ZIP 응답
- Exporter: 원본 가이드 집합 탐색과 portable ZIP 생성
- ReferenceCodec: HTML·Excalidraw 참조 추출과 양방향 치환
- BundleReader: ZIP 안전 해제, manifest·blob 검증
- Planner: 현재 운영 스냅샷과 비교해 ADD/OVERWRITE/RESTORE/UNCHANGED 분류
- MigrationService: 운영 파일 생성, DB 단일 트랜잭션, 롤백 보상
- OrphanCleanup: 중단된 이관의 미참조 물리 파일 제한 정리

공통 파일 API를 HTTP로 재호출하지 않는다. 파일 검증·경로 생성의 공통 정책은 `FileValidator`와 별도 추출한 안전한 저장 경로 컴포넌트를 재사용한다. `FileUploadUnitService`의 `REQUIRES_NEW` 업로드를 그대로 호출하면 가이드 전체 원자성이 깨지므로 이관 서비스는 단일 트랜잭션용 파일 메타데이터 생성 경계를 별도로 둔다.

프론트는 기존 `useCommonDataMigrationPage`에 ZIP 로직을 섞지 않는다. 입력 길라잡이와 사업 가이드 각각의 composable을 두고, ZIP 파일 선택·dry-run·commit의 공통 상태 머신만 작은 공통 composable로 추출한다.

## 16. 완료 기준

1. 기존 공통 데이터 xlsx 왕복 테스트가 변경 없이 통과한다.
2. 사업 가이드 한 건만 선택해 개발에서 ZIP으로 내보내고 운영에 단독 반영할 수 있다.
3. 운영에서 직접 수정한 선택 가이드는 확정 후 개발 본문·파일로 교체된다.
4. 선택하지 않은 운영 가이드와 파일은 변경되지 않는다.
5. 입력 길라잡이와 사업 가이드 패키지를 서로 다른 엔드포인트에 올리면 dry-run에서 차단된다.
6. 일반 첨부, 에디터 이미지, Excalidraw 장면과 포함 이미지가 이관 후 모두 열리고 다운로드된다.
7. 같은 ZIP을 다시 반영해도 변경없음으로 끝나고 파일 메타데이터가 중복 생성되지 않는다.
8. 검증 또는 DB 반영 실패 뒤 신규 DB 행이나 신규 물리 파일이 남지 않는다.
