# 프론트엔드 npm 오프라인 저장소 스크립트 설계

작성일: 2026-06-19

## 목적
백엔드의 폐쇄망 maven 미러 스크립트 3종(`make-local-maven-repo.ps1`,
`rebuild-local-maven-repo.ps1`, `check-repo-coverage.ps1`)에 대응하는 npm 버전을
`it_frontend/`에 추가한다. 외부망 PC에서 의존성을 모아 폐쇄망으로 반입하고,
내부 Nexus npm 레지스트리에 패키지가 존재하는지 점검·다운로드한다.

## 확정 사항
- 내부 Nexus npm 레지스트리: `http://10.6.65.151:20080/repository/npm-releases`
- 오프라인 메커니즘: **npm 캐시 폴더(`_cacache`)** → `npm ci --offline --cache C:\npm-cache`
- 필요 패키지 목록의 단일 진실 공급원: `it_frontend/package-lock.json` (lockfileVersion 3)

## maven 대비 핵심 차이
- Gradle 캐시는 Maven2 레이아웃으로 **변환**이 필요했으나, npm `_cacache`는 그 자체가
  이식 가능한 포맷이므로 "변환"은 **클린 복사 + manifest 생성**으로 단순화된다.
- 스코프 패키지(`@tiptap/...`)의 Nexus tarball 경로는 `@scope/name/-/name-version.tgz`
  (스코프는 경로에 유지, 파일명에서는 제거). 각 패키지의 tarball 경로는 lockfile의
  `resolved` URL 경로부(호스트 이후)에서 그대로 추출한다. `.tgz`가 아닌 resolved
  (git/http 직접 참조)는 레지스트리 비대상이므로 제외한다.

## 스크립트 3종 (모두 `it_frontend/`)

### 1. make-local-npm-repo.ps1 (← make-local-maven-repo.ps1)
- 인자: `-CacheDir`(채워진 npm 캐시, `_cacache` 상위), `-OutDir`(반입 캐시 폴더, 예 `C:\npm-cache`),
  `-LockFile`(기본 `<스크립트폴더>\package-lock.json`)
- 동작: OutDir 클린 → `<CacheDir>\_cacache`를 `<OutDir>\_cacache`로 복사 →
  lockfile 파싱해 manifest 2종 생성
  - `npm-repo-manifest.txt` : `name<TAB>version<TAB>resolved<TAB>integrity` 전체
  - `npm-repo-manifest-tgz.txt` : Nexus tarball 경로만 (coverage `-ManifestFile` 입력용)
- 출력: 오프라인 설치 안내(`npm ci --offline --cache <OutDir>`)

### 2. rebuild-local-npm-repo.ps1 (← rebuild-local-maven-repo.ps1)
- 인자: `-ProjectDir`(기본 `$PSScriptRoot`), `-CacheHome`(기본 `<ProjectDir>\.npm-cache`),
  `-OutDir`(기본 `C:\npm-cache`)
- 단계:
  1. 전용 캐시(`CacheHome`) 사용으로 글로벌 캐시 오염 방지 (modules-2 삭제 대응)
  2. `node_modules` + `CacheHome` 완전 삭제
  3. 기존 OutDir를 `.bak`으로 백업 후 제거 (실패 시 복원)
  4. `npm ci --ignore-scripts` (`npm_config_cache=CacheHome`) — lockfile 정확히 새로
     다운로드, `nuxt prepare` 스킵
  5. 캐시 검증(`_cacache/content-v2` 존재) → make 스크립트 호출
- 원격(npm-releases/npmjs.org) 미접근 시 다운로드 없음 → 백업 복원 후 중단

### 3. check-npm-repo-coverage.ps1 (← check-repo-coverage.ps1)
- 기준 목록: `-LockFile`(기본 `<스크립트폴더>\package-lock.json`) / `-ManifestFile` / `-RepoDir` 택1
- `-RepoUrl` 기본 `http://10.6.65.151:20080/repository/npm-releases`
- `-DownloadDir` 지정 시 존재 tarball을 scope/name 레이아웃으로 다운로드(재실행 안전),
  미지정 시 HEAD 점검만
- `-Username/-Password` Basic 인증 지원
- 산출: 커버리지 % + `repo-missing-files.txt` + `반입신청목록.csv`
  (그룹=scope, 아티팩트=basename, 버전=version, 타입=tgz, 파일명)

## 비고
- 3개 스크립트는 백엔드와 동일하게 각각 자기완결적(공유 헬퍼 파일 없음).
- 한글 주석/콘솔 UTF-8 출력 보정 등 백엔드 스크립트 규약을 동일하게 따른다.
</content>
</invoke>
