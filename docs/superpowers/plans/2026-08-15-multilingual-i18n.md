# 한국어·영어 다국어 적용 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저 쿠키를 기준으로 한국어를 기본 제공하고, 영어 선택 시 화면 고정 문구·시스템 메뉴·공통코드 표시명이 URL과 작업 상태를 유지한 채 함께 전환되도록 한다.

**Architecture:** 화면 고정 문구는 Nuxt i18n 리소스에서, 메뉴·공통코드 번역은 범용 테이블 `TPRMPP_CLANGM`에서 관리한다. 사용자 조회 API는 `lang` 쿼리와 필드별 한국어 fallback을 제공하고, 관리자 API는 한국어 원본과 번역 목록을 한 트랜잭션으로 저장한다. 프론트는 `it-portal-locale` 쿠키를 단일 언어 선호 소스로 사용한다.

**Tech Stack:** Oracle/Flyway, Java 25, Spring Boot 4.1, Spring Data JPA, QueryDSL 5.1, Caffeine, JUnit 5/Mockito/MockMvc, Nuxt 4, Vue 3, `@nuxtjs/i18n` 10.6, PrimeVue 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-15-multilingual-i18n-design.md`

## Global Constraints

- 지원 언어는 소문자 `ko`, `en`이며 쿠키·API 값이 없거나 올바르지 않으면 `ko`로 정규화한다.
- 번역 테이블명은 `TPRMPP_CLANGM`, PK는 `(TC_ID_CONE, DTT_LAN_C, TC_COL_NM)`이다.
- `DTT_NM`은 `메뉴` 또는 `공통코드`이고, 메뉴의 `TC_ID_CONE`은 `MNU_ID`, 공통코드는 길이 접두 복합키다.
- 일반 사용자 API는 기존 표시 필드명을 유지하고 선택 언어 번역 또는 한국어 원본을 담는다.
- 사용자 입력 콘텐츠, 출력 서식 본문, 기술 식별자, `TPRMPP_CMENUD.SRE_MNU_NM`은 번역하지 않는다.
- 언어 전환은 라우트 이동·전체 새로고침·탭 초기화·폼 재생성을 일으키지 않는다.
- 주석과 JavaDoc은 한국어로 작성한다.
- 네 저장소의 기존 dirty 변경은 수정·스테이징·커밋하지 않는다.
- DB → 백엔드 계약 → 프론트 순서로 독립 커밋하고, 호환 커밋 조합을 마지막에 루트 `versions.lock`에 기록한다.

## 계획 묶음과 선행 관계

| 순서 | 계획 | 산출물 | 다음 계획이 의존하는 계약 |
| ---: | --- | --- | --- |
| 1 | [DB·백엔드 계획](2026-08-15-multilingual-i18n-db-backend.md) | DDL, 엔티티, 번역 서비스, 메뉴·공통코드 사용자/관리자 API | `lang`, `translations`, fallback, 캐시 무효화 |
| 2 | [프론트 기반 계획](2026-08-15-multilingual-i18n-frontend-foundation.md) | Nuxt i18n, 쿠키, 선택기, PrimeVue, 포맷터, 메뉴·코드 반응성 | `useAppLocale`, locale-aware menu/code clients |
| 3 | [화면 전환·출시 계획](2026-08-15-multilingual-i18n-screen-rollout.md) | 모든 포함 화면 리소스화, 관리자 번역 UI, 초기 영문 데이터, E2E, 선택기 공개 | 전체 완료 기준 |

하위 계획은 표의 순서로 실행한다. 한 계획 내부에서도 Task 번호 순서를 유지한다. DB 변경은 기존 프론트와 호환되고, 백엔드는 `lang` 생략 시 한국어를 반환하므로 단계별 배포가 가능하다.

## 공유 계약

### 번역 행

```json
{
  "language": "en",
  "columnName": "MNU_NM",
  "text": "System Administration"
}
```

- 관리자 요청에서 `translations`를 생략하면 기존 번역을 건드리지 않는다.
- `translations`에 특정 허용 컬럼의 `text: ""`를 보내면 해당 번역을 논리 삭제한다.
- 일반 사용자 응답에는 `translations`를 노출하지 않는다.

### 허용 대상

| `DTT_NM` | 허용 `TC_COL_NM` |
| --- | --- |
| `메뉴` | `MNU_NM` |
| `공통코드` | `CO_C_NM`, `CDVA_NM`, `CO_CDVA_ABV_NM`, `CO_CDVA_SPS`, `CO_C_INTN_CONE` |

`CO_C_INTN_NM`과 `CO_CDVA_NM`은 기계 처리 필드이므로 번역 요청·응답에서 제외한다.

### 사용자 API

```text
GET /api/menus?lang=ko|en
GET /api/ccodem/{cId}?lang=ko|en
GET /api/ccodem/{cId}/{cdva}?lang=ko|en
GET /api/ccodem/type/{cTp}?lang=ko|en
GET /api/ccodem/budget-period?lang=ko|en
```

모든 엔드포인트는 `lang`을 생략하거나 미지원 값을 보낼 때 `ko`와 동일한 응답을 반환한다. 영어 번역 누락은 응답 실패가 아니라 해당 필드의 한국어 fallback이다.

### 프론트 언어 상태

```ts
type AppLocale = 'ko' | 'en'

interface AppLocaleController {
  locale: Readonly<Ref<AppLocale>>
  initializeLocale(): Promise<void>
  setAppLocale(locale: AppLocale): Promise<void>
  normalizeAppLocale(value: unknown): AppLocale
}
```

쿠키 이름은 `it-portal-locale`, 수명은 1년, `SameSite=Lax`다. URL prefix와 브라우저 언어 자동 감지는 사용하지 않는다.

## 최종 통합 체크포인트

- [ ] **Step 1: 세 하위 계획의 모든 체크박스와 저장소별 테스트 결과를 확인한다**

DB·백엔드, 프론트 기반, 화면 전환·출시 계획의 완료 체크가 남아 있으면 다음 단계로 진행하지 않는다.

- [ ] **Step 2: 저장소별 HEAD와 작업 트리 범위를 확인한다**

```powershell
git -C it_database status --short
git -C it_backend status --short
git -C it_frontend status --short
git status --short
git -C it_database log -1 --oneline
git -C it_backend log -1 --oneline
git -C it_frontend log -1 --oneline
```

Expected: 다국어 변경은 모두 각 저장소 커밋에 포함되고, 사용자 소유의 기존 dirty 파일만 그대로 남는다.

- [ ] **Step 3: 호환 커밋 조합을 갱신한다**

```powershell
.\scripts\update-versions-lock.ps1
git diff -- versions.lock
```

Expected: `it_database`, `it_backend`, `it_frontend`의 SHA가 방금 검증한 HEAD와 일치한다.

- [ ] **Step 4: 루트 문서와 잠금 파일만 커밋한다**

```powershell
git add -- versions.lock docs/superpowers/plans/2026-08-15-multilingual-i18n.md docs/superpowers/plans/2026-08-15-multilingual-i18n-db-backend.md docs/superpowers/plans/2026-08-15-multilingual-i18n-frontend-foundation.md docs/superpowers/plans/2026-08-15-multilingual-i18n-screen-rollout.md
git diff --cached --check
git commit -m "docs: 다국어 구현 버전 조합 기록"
```

Expected: 관련 없는 설계 문서 수정, 샘플 파일 삭제·추가는 staged 목록에 없다.

## 완료 기준

- 쿠키가 없거나 오염된 모든 진입점은 한국어다.
- 한국어·영어 전환 시 URL, 열린 탭, 입력 중인 폼 값이 유지된다.
- 화면 고정 문구, PrimeVue, 메뉴, Breadcrumb, 모든 탭, 공통코드 표시명이 같은 언어를 사용한다.
- 영어 번역이 없는 DB 필드는 해당 한국어 원본만 표시한다.
- 메뉴·공통코드 번역을 저장·삭제하면 모든 언어 캐시가 커밋 후 무효화된다.
- 관리자 화면에서 한국어 원본과 영어 번역을 함께 관리할 수 있다.
- Excel 반입의 명칭→코드 해석은 화면 언어와 관계없이 `lang=ko`를 사용한다.
- 영어 화면의 미정의 서버 오류는 한국어 원문 대신 영어 일반 오류와 요청 ID를 표시한다.
- 백엔드·프론트·E2E·정적 문구·번역 키 일치 검사가 모두 통과한 뒤에만 언어 선택기를 운영에 노출한다.
