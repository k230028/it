# 사용자 가이드 PPT 작성 스킬 설계

- 작성일: 2026-08-26
- 대상: `C:\it\.claude\skills\writing-user-guide-pptx\`
- 관련 자산: `sample/템플릿 1번 A(문서작업용).pptx`, `sample/템플릿 1번 B(다이어그램용).pptx`

## 1. 목적

IT Portal 웹서비스의 화면을 **업무 흐름 순서대로** 배치한 일반 사용자용 가이드 PPT를,
KDB 공식 템플릿 서식을 유지한 채 반복 생성할 수 있게 한다.

성공 기준:

1. 산출물이 KDB 템플릿의 마스터·테마·도형 디자인을 그대로 유지한다.
2. 화면 캡처가 슬라이드의 그림 자리표시자에 자동으로 채워진다.
3. 원본 템플릿의 자리표시자 문구(`내용입력`, `대제목` 등)가 산출물에 남지 않는다.
4. 화면이 바뀌면 캡처만 다시 떠서 덱을 재생성할 수 있다.

## 2. 조사 결과 (사실관계)

### 2.1 템플릿 실측

| 항목 | 템플릿 A(문서작업용) | 템플릿 B(다이어그램용) |
| --- | --- | --- |
| 파일 크기 | 172.9 MB | 161.8 MB |
| 슬라이드 | 365장 | 363장 |
| 레이아웃 | 24개 | 104개 |
| 마스터 | 1개 | 1개 |
| 미디어 | 1,431개 / 129.3 MB | 1,020개 / 122.9 MB |
| 슬라이드 크기 | 12192000 × 6858000 EMU (16:9) | 동일 |

두 템플릿 모두 테마 폰트는 `KDB고딕M_Pro`(라틴/한글) + `한컴 고딕`,
테마 색은 `accent1 #1758C0`, `accent2 #0E3D99`, `accent3 #0C3080`, `accent4 #FF7575`로 **동일**하다.

두 파일의 365/363장은 완성된 발표자료가 아니라 **패턴 라이브러리**다.
모든 슬라이드가 `내용입력`, `하위내용입력`, `대제목`, `소제목 내용 입력` 같은 자리표시자 문구로 채워져 있다.

### 2.2 결정적 발견 — B 템플릿의 그림 자리표시자

B 템플릿의 레이아웃 `내지 1` ~ `내지 75`(slideLayout25~99)에는
`<p:ph type="pic">` 그림 자리표시자가 슬라이드당 1~8개씩 정의되어 있다.
A 템플릿의 레이아웃 24개에는 자리표시자가 하나도 없다.

즉 **화면 캡처를 꽂을 자리가 B 템플릿에 이미 설계되어 있다.**
따라서 덱의 베이스는 B로 고정하고, A의 슬라이드는 필요 시 이식한다.

### 2.3 A → B 이식 시 제약

| 검사 | 결과 | 함의 |
| --- | --- | --- |
| `theme1.xml` 해시 | A ≠ B | 바이트는 다르나 색·폰트 정의는 동일 → 의미상 호환 |
| `slideMaster1.xml` 해시 | A ≠ B | 마스터는 병합하지 않고 B 것만 사용 |
| `slideLayout1~24` 해시 | 24개 전부 상이 | 레이아웃은 **항상 append**, 동일시 금지 |
| 레이아웃 이름 순서 | A의 `스타일7/8/9`가 B에서 `스타일8/9/7` | 이름 기반 매칭 금지 |
| `ppt/media/*` 이름 겹침 | 434개 겹침, 그중 내용 동일은 17개뿐 | **media는 내용 해시 기준으로 재명명 필수** |

이름이 같은데 내용이 다른 미디어가 417개라는 점이 핵심 위험이다.
이름만 보고 병합하면 이미지가 조용히 뒤바뀐다.

### 2.4 실행 환경

| 항목 | 상태 | 결론 |
| --- | --- | --- |
| Python | 3.11.0 (`%LOCALAPPDATA%\Programs\Python\Python311`), 3.14 | 3.11 사용 |
| PyPI 접근 | 가능 (`python-pptx 1.0.2` 설치 가능) | 필수 의존성으로는 쓰지 않음 |
| Node | v24.16.0 | Playwright 캡처에 사용 |
| Playwright | `it_frontend`에 설정 완비 (`baseURL: localhost:3002`) | 그대로 재사용 |
| PowerPoint COM | **없음** (CLSID 미등록) | 슬라이드 렌더링·PDF 변환 불가 |
| LibreOffice | **없음** | 동일 |

PowerPoint와 LibreOffice가 모두 없으므로 **빌드 파이프라인은 렌더링에 의존할 수 없다.**
슬라이드 선택은 XML 구조 분석으로, 최종 확인은 사용자의 PPT 뷰어로 한다.

### 2.5 대상 업무 흐름 (1차 범위)

`it_frontend` 페이지와 기존 E2E 명세에서 확인한 실제 경로:

**흐름 1 — 예산 작성**

| 단계 | 경로 | 화면 |
| --- | --- | --- |
| 1 | `/budget` | 예산 작성 유형 선택 (정보화사업 / 전산업무비 / 경상사업 카드) |
| 2 | `/info/projects/form` | 정보화사업 작성 폼 (경상사업은 `?ordinary=true`) |
| 3 | `/budget/list` | 예산 통합 목록 — 작성 결과 확인 |

**흐름 2 — 예산 결재신청**

| 단계 | 경로 | 화면 |
| --- | --- | --- |
| 1 | `/budget/approval` | 결재 상신 대상 목록, 체크박스 다중 선택 |
| 2 | `/budget/report` | PDF 보고서 생성 + 결재라인(팀장/부서장) 지정 |
| 3 | `/budget/list` | 상신 완료 후 복귀 |

**흐름 3 — 전자결재**

| 단계 | 경로 | 화면 |
| --- | --- | --- |
| 1 | `/approval` | 전자결재 Home 대시보드 (KPI 4종, 월별 추이, 내 결재 대기) |
| 2 | `/approval/list` | 전자결재 목록, 결재 차례 판별 |
| 3 | `/approval/list` (다이얼로그) | 신청서 PDF 뷰어 |
| 4 | `/approval/list` (다이얼로그) | 승인/반려 처리 |

`/budget/work`(편성률 입력)은 예산 담당자 전용이므로 1차 범위에서 제외한다.

## 3. 아키텍처

### 3.1 파이프라인

```
flow.yaml ──①캡처──▶ shots/*.png
    │                     │
    └──②패턴 선택─────▶ deck.yaml ──③빌드──▶ 가이드.pptx ──④검증──▶ 리포트
              ▲
      template-catalog.json
```

각 단계는 독립 실행 가능하고, 앞 단계 산출물만 입력으로 받는다.
화면이 바뀌면 ①만, 문구가 바뀌면 ③만 다시 돌린다.

### 3.2 디렉터리

```
C:\it\.claude\skills\writing-user-guide-pptx\
  SKILL.md                        워크플로 · 규칙 · 체크리스트
  references/
    template-catalog.md           A/B 728장 패턴 색인 (생성물, 커밋)
    it-portal-flows.md            대상 업무 흐름 SoT
    ooxml-notes.md                슬라이드 이식 함정 모음
  scripts/
    catalog_templates.py          템플릿 → template-catalog.json / .md
    capture_screens.ts            Playwright 캡처
    build_deck.py                 deck.yaml + PNG → pptx
    verify_deck.py                산출물 검증
  assets/
    flow.it-portal.yaml           1차 범위 3개 흐름 정의
    deck.example.yaml
```

### 3.3 구성요소

#### catalog_templates.py

입력: 템플릿 A·B 경로. 출력: `template-catalog.json`, `template-catalog.md`.

슬라이드마다 다음을 추출한다.

- 참조 레이아웃 이름
- 그림 자리표시자 개수와 각각의 EMU 위치·크기
- 자리표시자 문구 종류별 개수 (`대제목`, `소제목 내용 입력`, `내용입력`, `하위내용입력`, 숫자 배지 `01`~`10`, 연도)
- 표(`graphicFrame`)·차트 유무, 도형(`sp`) 총개수
- 도형 bbox를 격자로 투영한 **열 개수 / 행 개수** (N분할 판정용)

이 지표로 각 슬라이드를 다음 중 하나로 분류한다.

`캡처형` · `프로세스형` · `N분할형` · `타임라인형` · `표형` · `비교형` · `표지/목차/간지/종지` · `기타`

분류는 규칙 기반이며 규칙은 `catalog_templates.py` 상단에 상수로 둔다.
오분류를 발견하면 `references/template-catalog.md`에 수동 보정 주석을 남기고 규칙을 고친다.

#### capture_screens.ts

`it_frontend`에서 `npx playwright test`로 실행하는 캡처 전용 스펙.

- `tests/e2e/helpers/mockApi.ts`의 `setLoggedIn` / `mockCommonApis` / `mockApi`를 그대로 재사용한다.
  백엔드·DB·SSO 없이 결정적으로 동작하게 하기 위함이다.
- `mocks`에 쓰는 프리셋은 스킬이 함께 두는 `capture-fixtures.ts`에 정의한다.
  초기값은 `tests/e2e/budget.spec.ts`·`approval.spec.ts`의 mock 데이터에서 가져오되,
  가이드에 실릴 화면이므로 `테스트 정보화사업 A` 같은 시험용 문구는 실제로 있음직한 값으로 바꾼다.
- `flow.yaml`의 각 step을 순회하며 `goto` → 대기 조건 → 선택적 조작(`click`/`fill`/`check`) → `screenshot`.
- 뷰포트는 1600×900 고정, `deviceScaleFactor: 2`.
- 캡처 대상은 기본적으로 전체 뷰포트이며, step에 `clip.selector`가 있으면 해당 요소만 캡처한다.
- 출력: `shots/<flow-id>/<NN>-<step-id>.png` + `shots/manifest.json`(경로·해상도·캡처 시각).

`flow.yaml` 스키마:

```yaml
flows:
  - id: budget-write
    title: 예산 작성
    mocks: [projects, costs, budget-period]      # capture-fixtures.ts의 프리셋 이름
    steps:
      - id: type-select
        url: /budget
        waitFor: { role: heading, name: 경상사업 }
        caption: 작성할 예산 유형을 고릅니다
        note: 정보화사업·전산업무비·경상사업 중 하나를 클릭합니다
```

`caption`은 슬라이드 소제목, `note`는 본문 설명으로 흘러간다.

#### build_deck.py

Python 3.11 **표준 라이브러리만** 사용한다(`zipfile`, `xml.etree.ElementTree`, `hashlib`, `shutil`).
폐쇄망 PC에서 추가 설치 없이 빌드되게 하기 위함이다.

처리 순서:

1. B 템플릿을 작업 디렉터리에 풀어 베이스 패키지로 삼는다.
2. `deck.yaml`의 슬라이드 목록을 읽어 필요한 원본 슬라이드를 확정한다.
3. A 출처 슬라이드는 **이식**한다.
   - 슬라이드 XML과 그 rels를 복사
   - 참조 레이아웃을 B에 새 번호로 append하고, 그 레이아웃의 rels·미디어도 함께 이식
   - append한 레이아웃의 마스터 참조는 B의 `slideMaster1`로 다시 건다
   - 미디어는 **내용 SHA-1 앞 12자리를 파일명에 붙여 재명명**한다. 이름 충돌로 인한 조용한 이미지 교체를 막는 유일한 방어선이다.
4. 같은 원본 슬라이드를 두 번 이상 쓰면 그때마다 새 `slideN.xml`로 복제한다.
5. `presentation.xml`의 `<p:sldIdLst>`를 `deck.yaml` 순서대로 재작성하고, `presentation.xml.rels`·`[Content_Types].xml`을 정합화한다.
6. 텍스트 치환: 슬라이드별 `text` 매핑을 `<a:t>` 런 단위로 적용한다.
   - 매핑 키는 원본 자리표시자 문구, 값은 넣을 문구
   - 같은 문구가 여러 번 나오면 `키#2` 형식으로 n번째를 지정한다
   - 런 분할로 한 문단이 쪼개진 경우를 위해 **문단 단위로 먼저 합쳐 비교하고, 치환은 첫 런에 몰아넣고 나머지 런의 텍스트를 비운다**
7. 이미지 삽입: `images` 항목의 `ph` 인덱스에 해당하는 그림 자리표시자를 찾아
   `<p:pic>`으로 대체하고, 원본 종횡비를 유지하며 자리표시자 박스에 맞춰 중앙 크롭(`a:srcRect`)한다.
8. 어느 슬라이드에서도 참조되지 않는 `ppt/media/*`와 `slideLayout*`을 제거한다.
9. 결정적 순서로 다시 zip한다.

`deck.yaml` 스키마:

```yaml
output: 사용자가이드.pptx
slides:
  - from: { template: B, slide: 1 }
    text:
      "템플릿 디자인": IT Project Portal 사용자 가이드
      "부제목을 입력해주세요": 예산 작성부터 전자결재까지
  - from: { template: B, slide: 128 }
    text:
      "대제목": 예산 작성
      "소제목 내용 입력": 작성할 예산 유형을 고릅니다
    images:
      - { ph: 10, src: shots/budget-write/01-type-select.png }
```

`ph`는 레이아웃에 정의된 `<p:ph type="pic">`의 `idx` 속성값이며,
`template-catalog.json`이 슬라이드마다 사용 가능한 `idx` 목록과 각 박스 크기를 함께 싣는다.

#### verify_deck.py

산출 pptx를 되읽어 아래를 검사하고 실패 시 비영(non-zero)으로 종료한다.

| 검사 | 실패 조건 |
| --- | --- |
| zip/OPC 정합성 | 깨진 엔트리, 끊어진 `r:embed`/`r:id`, `[Content_Types].xml` 누락 확장자 |
| 슬라이드 수 | `deck.yaml` 슬라이드 수와 불일치 |
| 잔여 자리표시자 | `내용입력` `하위내용입력` `대제목` `소제목 내용 입력` `내용을 입력해주세요` `부제목을 입력해주세요` 중 1건이라도 남음 |
| 그림 자리표시자 | 빈 `<p:ph type="pic">`가 1개라도 남음 |
| 미디어 고아 | 어떤 슬라이드/레이아웃도 참조하지 않는 `ppt/media/*` 존재 |
| 파일 크기 | 50 MB 초과 (미디어 정리 실패 신호) |

이 스크립트가 스킬의 GREEN 테스트 역할을 한다.

### 3.4 산출 덱 구성 (30~50장)

| 구간 | 장수 | 출처 레이아웃 |
| --- | --- | --- |
| 표지 | 1 | `표지` |
| 목차 | 1 | `목차` |
| 전체 흐름 한 장 요약 | 1 | 프로세스형 |
| 흐름별 간지 | 3 | `간지` |
| 흐름별 개요 도해 | 3 | 프로세스형 / N분할형 |
| 화면 단계 | 20~35 | 캡처형 (`내지 1`~`내지 75`) |
| 자주 묻는 질문 | 1~2 | N분할형 |
| 종지 | 1 | `종지` |

화면 단계 슬라이드는 **캡처 + 번호 배지 + 단계 설명 3~5줄** 형태로 통일한다.
한 슬라이드에 화면 2개를 넘기지 않는다. 넘으면 흐름 추적이 끊긴다.

## 4. 오류 처리

| 상황 | 처리 |
| --- | --- |
| dev 서버 미기동 | 캡처 스크립트가 즉시 중단하고 `npm run dev` 안내를 출력 |
| step의 `waitFor` 미충족 | 해당 step만 실패로 기록하고 나머지 계속, `manifest.json`에 `failed: true` |
| 텍스트 매핑 키가 슬라이드에 없음 | 빌드 실패 (오타를 조용히 넘기면 자리표시자가 남는다) |
| 매핑되지 않은 자리표시자 잔존 | `verify_deck.py`가 실패 처리 |
| `ph` 인덱스가 슬라이드에 없음 | 빌드 실패 |
| 캡처 PNG 없음 | 빌드 실패 |

원칙: **조용한 성공보다 시끄러운 실패.** 자리표시자가 남은 PPT는 그대로 배포되기 때문이다.

## 5. 테스트

| 대상 | 방법 |
| --- | --- |
| `catalog_templates.py` | 두 템플릿에 대해 실행 → 슬라이드 365/363건 전부 분류, 미분류 0건 |
| `build_deck.py` 이식 로직 | A·B 양쪽 슬라이드를 섞은 최소 덱(4장)을 빌드 → `verify_deck.py` 통과 |
| 미디어 재명명 | 이름 충돌 슬라이드 쌍을 골라 빌드 → 두 이미지의 SHA-1이 원본과 각각 일치 |
| 텍스트 치환 | 런이 쪼개진 문단을 포함한 슬라이드에서 치환 후 문단 텍스트가 기대값과 일치 |
| 전체 파이프라인 | 3개 흐름 캡처 → 빌드 → `verify_deck.py` 통과 + 사용자 뷰어 육안 확인 |

PowerPoint가 없어 자동 육안 검증은 불가하다. 최종 확인은 사용자의 PPT 뷰어로 한다.

## 6. 범위 밖

- 예산 작성·예산 결재신청·전자결재 외의 흐름 (필요 시 `flow.yaml`에 추가)
- 관리자 화면
- PDF 변환, 슬라이드 이미지 렌더링 (PowerPoint·LibreOffice 부재)
- 애니메이션·화면 전환 효과
- 다국어 덱 (한국어만)
