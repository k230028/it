# 백엔드 분석 작업 노트

**분석 일시**: 2026-05-26
**분석 범위**: C:\it\it_backend 전체 (257 Java 파일, 84 테스트, 61 엔티티)

---

## 1. 발견된 현황 (As-Is)

### 코드 규모
- 총 자바 파일: 257개
  - Main: 173개 (com.kdb.it 패키지)
  - Test: 84개 (동일 패키지 구조)
- 엔티티 클래스: 61개 (BaseEntity 상속 + BaseLogEntity 상속 조합)
- 컨트롤러: 28개 (27개 REST API + 1개 개발전용 DevAuthController)
- 서비스: 37개
- Repository: 40개+ (JPA + Custom QueryDSL)

### 아키텍처 현황
- **패턴**: 도메인 기반 레이어드 아키텍처 (3계층: common, domain, infra)
- **ORM**: Spring Data JPA + QueryDSL 5.1.0 (2026-05-17 SQL Injection CVE 대응)
- **인증**: httpOnly 쿠키 기반 JWT (Access 15분 / Refresh 7일)
- **로깅**: JPA @PrePersist/@PreUpdate 리스너 기반 변경로그 (23개 엔티티)
- **알림**: Event-driven @TransactionalEventListener(AFTER_COMMIT) 패턴
- **파일**: 50MB 단일 제한, 200MB 요청 제한, 화이트리스트 확장자 검증

### 최근 추가된 주요 기능 (2026-05-22 이후)
1. **알림 시스템** (`common/notification`): Cinfmm 엔티티, NotificationDispatcher SPI, 5가지 알림종류
2. **Tiptap 변수 시스템** (`common/system/tiptap`): 토큰 형식, 금액 포맷팅 규칙

---

## 2. 운영 배포 전 필수 사항

| 우선순위 | 항목 | 현황 | 계획 |
|----------|------|------|------|
| **P0** | 비밀값 기본값 제거 | `DB_PASSWORD`, `JWT_SECRET`, `GEMINI_API_KEY` 기본값 포함 | 운영 프로파일에서 기본값 제거 |
| **P0** | DevAuthController 제거 | app.dev.user-switch.enabled=true | 운영 배포 패키지에서 제거 또는 차단 |
| **P0** | 쿠키 Secure 플래그 | app.cookie.secure=false | 운영: true + HTTPS 필수 |
| **P0** | CORS 도메인 제한 | http://localhost:* | 운영: https://it.kdb.co.kr (실제 도메인) |

---

## 3. 권한 검증 보강 필요

| 모듈 | 현황 | 필요한 작업 |
|------|------|-----------|
| **FileController** | 단건 삭제만 검증 | 다운로드/미리보기/조회/메타수정 권한 추가 |
| **GeminiController** | 관리자 전용 | 비관리자 개방 전 비용 상한 구현 |

---

## 4. 알림 시스템 후속 작업

| 항목 | 현황 | 계획 |
|------|------|------|
| 채널 확장 | 인앱만 | Phase 2: EMAIL/SMS/TALK |
| 권한 필터링 | 없음 | SecurityContext 기반 필터링 |

---

## 5. Tiptap 변수 시스템 후속 작업

| 항목 | 현황 | 계획 |
|------|------|------|
| 권한 필터링 | 없음 | SecurityContext 기반 부서별 필터링 |
| 캐싱 | 미구현 | 카탈로그 캐싱 검토 |

---

## 6. 참고 자료

| 문서 | 경로 |
|------|------|
| 기술 SoT | C:\it\it_backend\CLAUDE.md |
| 개발 노트 | C:\it\it_backend\README.md (2026-05-26 갱신) |
| 백로그 | C:\it\it_backend\TASK.md |
| 데이터 모델 | C:\it\it_backend\docs\guides\data-model.md |

**최종 상태**: README.md 업데이트 완료 (빠른 시작, 개발자 가이드 섹션 신규 추가)
