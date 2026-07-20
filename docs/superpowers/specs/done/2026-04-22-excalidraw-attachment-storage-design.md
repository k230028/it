# Excalidraw 장면 외부 저장 + LZ-String 압축 설계

**날짜:** 2026-04-22  
**대상:** DOC-2026-0003 등 문서 컨텐츠 내 Excalidraw 다이어그램 저장 최적화

---

## 배경 및 문제

현재 Excalidraw 다이어그램은 TipTap HTML 전체를 `TPRMPP_BRDOCM.REQ_CONE` BLOB에 인라인으로 저장한다.

**현재 저장 구조 (다이어그램 1개당):**
```html
<figure data-type="excalidraw" data-scene="[Base64(URL-encode(sceneJSON+images))]">
  <img src="data:image/svg+xml;charset=utf-8,[URL-encode(SVG)]"/>
</figure>
```

문제점:
- sceneData가 `data-scene` 속성, SVG 내부 주석 두 곳에 중복 저장
- 이미지 임베드 시 `sceneData.files`에 base64 이미지 데이터 포함 → BLOB 급증
- 문서 내용 자체는 간단해도 DB 저장 크기가 수백 KB에 달할 수 있음

---

## 목표

- HTML BLOB 크기를 수십 바이트 수준으로 최소화
- 재편집을 위한 sceneData는 완전히 보존
- 기존 문서 마이그레이션 불필요

---

## 설계

### 저장 구조

**HTML BLOB (변경 후):**
```html
<figure data-type="excalidraw" data-attachment-id="ATT-xxx"></figure>
```

**첨부파일 레코드:**
- scene JSON 파일 1개 (LZ-String 압축)
- 임베드 이미지 binary 파일 N개 (각각 개별 첨부)

---

### 저장 흐름

```
sceneData (원본)
  └── elements: [도형들...]
  └── files: {
        fileId1: { dataURL: "data:image/png;base64,..." },
        fileId2: { dataURL: "data:image/jpeg;base64,..." }
      }

① files 내 이미지 → 각각 binary로 업로드
        POST /api/attachments → ATT-001, ATT-002

② sceneData.files에서 dataURL 제거, attachmentId 참조로 대체
      files: {
        fileId1: { attachmentId: "ATT-001", mimeType: "image/png" },
        fileId2: { attachmentId: "ATT-002", mimeType: "image/jpeg" }
      }

③ 수정된 sceneData → LZString.compressToBase64() → 업로드
        POST /api/attachments → ATT-003

④ HTML에 ID만 기록
        <figure data-type="excalidraw" data-attachment-id="ATT-003"></figure>
```

---

### 로딩 흐름

```
HTML 파싱 → data-attachment-id="ATT-003" 감지

① GET /api/attachments/ATT-003
   → LZString.decompressFromBase64() → sceneData JSON

② sceneData.files의 attachmentId 목록 병렬 fetch
        GET /api/attachments/ATT-001 → binary → dataURL 복원
        GET /api/attachments/ATT-002 → binary → dataURL 복원

③ files 복원 완료된 sceneData → exportToSvg() → 렌더링
```

---

### 하위 호환성

기존 문서는 `data-scene` 속성 또는 인라인 SVG 형태이므로 `parseHTML`에서 분기 처리한다. 별도 마이그레이션 배치는 불필요하며, 문서 저장 시점에 자연스럽게 신규 형식으로 전환된다.

```typescript
// parseHTML 분기
if (el.dataset.attachmentId) {
  // 신규 형식: 첨부파일에서 비동기 로드
} else if (el.dataset.scene) {
  // 구형식: 기존 방식 유지
}
```

---

## 구현 범위

### 프론트엔드

| 파일 | 변경 내용 |
|------|----------|
| `app/components/extensions/tiptap-extensions.ts` | `renderHTML` → attachment-id 출력, `parseHTML` → 두 형식 분기 |
| `app/components/ExcalidrawNodeView.vue` | attachment-id 감지 → scene fetch → 이미지 병렬 fetch → 렌더링 |
| `app/composables/useExcalidrawDialog.ts` | 저장 시 이미지 분리 업로드 → scene 압축 업로드 로직 추가 |
| `app/composables/useExcalidrawAttachment.ts` | **신규** — 저장/로딩 공통 로직 (이미지 추출, LZ-String, API 호출) |

### 백엔드

변경 없음 — 기존 `/api/attachments` 그대로 활용

### 패키지

```bash
npm install lz-string
```

---

## 효과 예측

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| HTML BLOB 내 다이어그램 크기 | 수십~수백 KB | 수십 바이트 |
| scene JSON 크기 | — | LZ-String으로 40~70% 절감 |
| 이미지 저장 | base64 인라인 | binary 개별 첨부 |
| 기존 문서 영향 | — | 없음 (하위 호환) |
