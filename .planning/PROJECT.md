# IT Portal — Project Context

> 이 파일은 GSD 워크플로우용 얇은 포인터 문서입니다. 프로젝트 SoT는 루트 `CLAUDE.md`와 도메인별 CLAUDE.md입니다.

## 프로젝트 식별
- **명칭**: IT Project Portal (IT 정보화 포탈)
- **사용자**: 약 3,000명 사내 임직원 (CSR 운영)
- **루트 SoT**: [`CLAUDE.md`](../CLAUDE.md)

## 기술 스택 요약
- **백엔드**: Spring Boot 4.0.5 / Java 25 / JPA + QueryDSL / Oracle XEPDB1
  - SoT: [`it_backend/CLAUDE.md`](../it_backend/CLAUDE.md)
- **프론트엔드**: Nuxt 4 / TypeScript / PrimeVue Aura / Tailwind / Pinia
  - SoT: [`it_frontend/CLAUDE.md`](../it_frontend/CLAUDE.md)
- **DB 마이그레이션**: Flyway (`it_database/migrations/`)
- **인증**: httpOnly 쿠키 기반 JWT (Access 15분 / Refresh 7일)

## 명명·설계 규약 (필수)
- 테이블: `TPRMPP_{C|B}{4자리도메인}{M|L|H}`
- 엔티티/컬럼 명명은 [`META.md`](../META.md) 용어사전 기반 필수
- 컬럼 타입/길이는 [`DOMAIN.md`](../DOMAIN.md) 도메인사전 기반 필수
- 모든 업무 엔티티는 `BaseEntity` 상속, Soft Delete만 사용

## 현재 진행
- 마일스톤: **알림 기능 추가 (CINFMM)**
- 상세: [`ROADMAP.md`](ROADMAP.md), [`phases/01-alrm/PLAN.md`](phases/01-alrm/PLAN.md)
