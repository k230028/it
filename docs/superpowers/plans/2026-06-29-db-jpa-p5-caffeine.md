# P5 — 캐시(Caffeine 전환) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:test-driven-development`. Each task is RED → run-to-fail → GREEN → run-to-pass → commit. Do not skip the run-to-fail step; paste the actual failure. NO placeholders — every code block below is the full file or the exact edit.

**Goal**: `CacheConfig`의 `ConcurrentMapCacheManager`(TTL 미지원)를 **Caffeine `CaffeineCacheManager`**로 교체하여 캐시별 TTL/최대크기를 지정한다. `tiptapMetadata`에 쓰기 evict(`ProjectService` create/update/delete)를 추가하고, notification unread-count에 60초 TTL을 도입하되 기존 `@Cacheable`/`@CacheEvict` 의미(특히 §5.5.1 공통코드 evict-all)는 100% 보존한다.

**Architecture**: Spring Cache 추상화는 그대로 두고 `CacheManager` 빈 구현만 교체한다. `CaffeineCacheManager`는 등록되지 않은 캐시 이름에 대해 기본 spec으로 동적 생성하므로, 캐시별 TTL을 강제하기 위해 **per-cache로 명시 등록**(`registerCustomCache(name, Caffeine.build())`)하고 동적 생성은 비활성화(`setAllowNullValues`는 유지, 미등록 캐시 생성은 막지 않되 등록된 6개는 항상 커스텀 spec 사용). 기존 어노테이션(`@Cacheable`/`@CacheEvict`/`@Caching`)은 변경하지 않으며, 추가되는 것은 `ProjectService` 3개 쓰기 메서드의 `@CacheEvict(tiptapMetadata)`뿐이다.

**Tech Stack**: Spring Boot 4.1.0, Java 25, Gradle. Caffeine `com.github.ben-manes.caffeine:caffeine`(Spring Boot 4.1.0 BOM이 `caffeine.version=3.2.4`로 관리 — **버전 미지정으로 선언**). JUnit5 + AssertJ + Mockito. `it_backend`는 독립 git 저장소.

> ⚠️ **오프라인 의존성 차단 게이트 (Step 0에서 반드시 먼저 해결)**: 본 환경은 폐쇄망 우선 저장소(`C:/maven-repo` 로컬 폴더 → 내부 Nexus `10.6.65.151:20080` → Maven Central 폴백)를 사용한다. 확인 결과 **현재 머신에 `C:/maven-repo` 폴더가 존재하지 않고, Gradle 캐시(`~/.gradle/caches`)에도 `com.github.ben-manes.caffeine:caffeine`가 없으며, Nexus/Central 도달 가능 여부에 의존**한다. 버전은 BOM 관리(3.2.4)이므로 핀 고정은 불필요하지만, **아티팩트 자체가 오프라인 해석 가능해야** 한다. Step 0에서 `caffeine-3.2.4.jar`(+ checker-qual, error_prone_annotations 트랜지티브)가 Nexus 또는 `C:/maven-repo`에 반입되었는지 검증한 뒤에야 코드 작업을 진행한다. 미반입 시 본 PR은 "반입 신청 대기"로 멈춘다(코드 변경 금지).

---

## File Structure

| 파일 | 변경 | 설명 |
| --- | --- | --- |
| `build.gradle` | edit | Caffeine 의존성 1줄 추가(버전 미지정, BOM 관리 3.2.4) |
| `src/main/java/com/kdb/it/config/CacheConfig.java` | rewrite | `ConcurrentMapCacheManager` → `CaffeineCacheManager` + per-cache TTL/max-size |
| `src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java` | edit | `createProject`/`updateProject`/`deleteProject`에 `@CacheEvict(tiptapMetadata)` 추가 + import |
| `src/main/java/com/kdb/it/common/notification/service/NotificationService.java` | edit(주석) | unread-count 캐시 JavaDoc을 TTL 60s 반영으로 갱신(동작 무변경, 키 유지) |
| `src/test/java/com/kdb/it/config/CacheConfigTest.java` | new | CacheManager=Caffeine + 캐시별 TTL/spec 검증(@SpringBootTest 아님, 순수 빈 단위) |
| `src/test/java/com/kdb/it/config/CaffeineCacheTtlTest.java` | new | 짧은 TTL spec으로 expireAfterWrite 만료 동작 검증(매뉴얼 Ticker) |
| `src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceCacheEvictTest.java` | new | `@Import(CacheConfig)` 슬라이스 — create/update/delete가 `tiptapMetadata` evict 검증 |

---

## Task 0 — 오프라인 의존성 반입 검증 (게이트, 코드 변경 없음)

**Files:** (없음 — 검증만)

- [ ] **Step 0.1** — Caffeine 오프라인 해석 가능 여부를 확인한다. 다음을 순서대로 실행:
  - 로컬 폴더 저장소 존재/아티팩트 확인:
    ```bash
    ls -d /c/maven-repo/com/github/ben-manes/caffeine/caffeine/3.2.4/caffeine-3.2.4.jar 2>&1
    ```
  - Gradle 캐시 확인:
    ```bash
    find ~/.gradle/caches -path '*ben-manes/caffeine*' -name 'caffeine-*.jar' 2>/dev/null
    ```
  - Nexus 도달 시 그곳에 있는지(브라우저/운영팀 확인) — `http://10.6.65.151:20080/repository/maven-releases/com/github/ben-manes/caffeine/caffeine/3.2.4/`
- [ ] **Step 0.2** — 위 중 하나라도 `caffeine-3.2.4.jar`(+ 트랜지티브 `org.checkerframework:checker-qual`, `com.google.errorprone:error_prone_annotations`)를 제공하면 게이트 통과 → Task 1 진행. **모두 부재면 STOP**: 본 PR을 진행하지 않고, 운영팀에 `com.github.ben-manes.caffeine:caffeine:3.2.4` + 트랜지티브 반입을 신청한 뒤 대기한다. (코드 변경 시 빌드가 의존성 해석 단계에서 실패하므로 무의미.)
- [ ] **Step 0.3** — git 사전 점검: `it_backend`가 독립 저장소이고 작업 브랜치를 만들 준비가 되었는지 확인.
  ```bash
  cd /c/it/it_backend && git rev-parse --show-toplevel && git fetch origin && git switch main && git switch -c feature/db-jpa-p5-caffeine
  ```
  - 기대: toplevel = `C:/it/it_backend`, 새 브랜치 `feature/db-jpa-p5-caffeine`가 `main`에서 분기됨.
  - **커밋 없음** (게이트 단계).

---

## Task 1 — Caffeine 의존성 추가 + CacheConfig 전환

**Files:** `build.gradle`, `src/main/java/com/kdb/it/config/CacheConfig.java`, `src/test/java/com/kdb/it/config/CacheConfigTest.java`

- [ ] **Step 1.1 (RED)** — `CacheConfigTest`를 작성한다. CacheManager가 Caffeine 타입이고 6개 캐시 이름을 모두 보유하며, 각 캐시가 커스텀 spec(maximumSize/expireAfterWrite)을 갖는지 검증한다. `@SpringBootTest`를 쓰지 않고 `new CacheConfig().cacheManager()`를 직접 호출하는 순수 단위 테스트(컨텍스트·DB 불필요, 따라서 `@Tag("it")` 미부착).

  파일 `src/test/java/com/kdb/it/config/CacheConfigTest.java`:
  ```java
  package com.kdb.it.config;

  import static org.assertj.core.api.Assertions.assertThat;

  import java.time.Duration;

  import org.junit.jupiter.api.DisplayName;
  import org.junit.jupiter.api.Test;
  import org.springframework.cache.CacheManager;

  import com.github.benmanes.caffeine.cache.Cache;
  import com.github.benmanes.caffeine.cache.Policy;
  import org.springframework.cache.caffeine.CaffeineCache;
  import org.springframework.cache.caffeine.CaffeineCacheManager;

  /**
   * CacheConfig 단위 테스트.
   *
   * <p>CacheManager가 Caffeine 기반인지, 6개 캐시(codesByType/codesByCid/budgetPeriod/
   * notificationUnreadCount/tiptapMetadata/menuAuthMap)를 모두 보유하는지, 캐시별 TTL/최대크기
   * spec이 설계대로 적용됐는지 검증합니다. Spring 컨텍스트나 DB 없이 빈을 직접 생성해 실행합니다.</p>
   */
  class CacheConfigTest {

      private final CacheManager cacheManager = new CacheConfig().cacheManager();

      @Test
      @DisplayName("CacheManager는 Caffeine 구현이다")
      void cacheManager_isCaffeine() {
          assertThat(cacheManager).isInstanceOf(CaffeineCacheManager.class);
      }

      @Test
      @DisplayName("기존 6개 캐시 이름을 모두 보유한다 (드롭 없음)")
      void registersAllSixCaches() {
          assertThat(cacheManager.getCacheNames())
                  .containsExactlyInAnyOrder(
                          "codesByType", "codesByCid", "budgetPeriod",
                          "notificationUnreadCount", "tiptapMetadata", "menuAuthMap");
      }

      @Test
      @DisplayName("codesByCid/budgetPeriod/codesByType는 1시간 TTL")
      void staticCaches_oneHourTtl() {
          assertExpireAfterWrite("codesByCid", Duration.ofHours(1));
          assertExpireAfterWrite("budgetPeriod", Duration.ofHours(1));
          assertExpireAfterWrite("codesByType", Duration.ofHours(1));
      }

      @Test
      @DisplayName("menuAuthMap은 1시간 TTL")
      void menuAuthMap_oneHourTtl() {
          assertExpireAfterWrite("menuAuthMap", Duration.ofHours(1));
      }

      @Test
      @DisplayName("tiptapMetadata는 10분 TTL")
      void tiptapMetadata_tenMinuteTtl() {
          assertExpireAfterWrite("tiptapMetadata", Duration.ofMinutes(10));
      }

      @Test
      @DisplayName("notificationUnreadCount는 60초 TTL")
      void notificationUnreadCount_sixtySecondTtl() {
          assertExpireAfterWrite("notificationUnreadCount", Duration.ofSeconds(60));
      }

      /** Caffeine 네이티브 캐시의 expireAfterWrite 설정값이 기대 Duration과 일치하는지 검증. */
      private void assertExpireAfterWrite(String cacheName, Duration expected) {
          CaffeineCache springCache = (CaffeineCache) cacheManager.getCache(cacheName);
          assertThat(springCache).as("캐시 %s 미등록", cacheName).isNotNull();
          Cache<Object, Object> nativeCache = springCache.getNativeCache();
          Policy.FixedExpiration<Object, Object> expiry =
                  nativeCache.policy().expireAfterWrite()
                          .orElseThrow(() -> new AssertionError(cacheName + ": expireAfterWrite 미설정"));
          assertThat(expiry.getExpiresAfter()).isEqualTo(expected);
      }
  }
  ```

- [ ] **Step 1.2 (run-to-fail)** — 컴파일 실패(Caffeine 의존성·임포트 부재, `cacheManager()`가 아직 `ConcurrentMapCacheManager` 반환)를 확인한다.
  ```bash
  cd /c/it/it_backend && ./gradlew compileTestJava --console=plain
  ```
  기대: `error: package com.github.benmanes.caffeine.cache does not exist` 또는 `org.springframework.cache.caffeine` 미해석으로 **컴파일 실패**.

- [ ] **Step 1.3 (GREEN — 의존성)** — `build.gradle`의 `dependencies {}` 블록에 Caffeine을 추가한다. JWT 블록 바로 위(QueryDSL 근처)에 배치.

  `build.gradle`에서 아래를 찾는다:
  ```groovy
  	// HTML 새니타이징 (XSS 서버 측 방어)
  	implementation 'org.jsoup:jsoup:1.18.3'
  ```
  바로 뒤에 추가:
  ```groovy

  	// Caffeine 캐시 — CacheManager를 ConcurrentMap(TTL 미지원)에서 Caffeine으로 전환(P5/T13).
  	// 버전은 Spring Boot 4.1.0 BOM이 관리(caffeine.version=3.2.4)하므로 미지정.
  	// ⚠️ 폐쇄망: caffeine-3.2.4.jar + 트랜지티브(checker-qual, error_prone_annotations)가
  	//    C:/maven-repo 또는 Nexus에 반입되어 있어야 오프라인 해석된다(반입 신청 선행).
  	implementation 'com.github.ben-manes.caffeine:caffeine'
  ```

- [ ] **Step 1.4 (GREEN — CacheConfig)** — `CacheConfig.java`를 아래 전체 내용으로 교체한다. 6개 캐시를 per-cache `Caffeine` spec으로 명시 등록한다.

  `src/main/java/com/kdb/it/config/CacheConfig.java` 전체:
  ```java
  package com.kdb.it.config;

  import java.time.Duration;

  import org.springframework.cache.CacheManager;
  import org.springframework.cache.annotation.EnableCaching;
  import org.springframework.cache.caffeine.CaffeineCacheManager;
  import org.springframework.context.annotation.Bean;
  import org.springframework.context.annotation.Configuration;

  import com.github.benmanes.caffeine.cache.Caffeine;

  /**
   * 캐시 설정 클래스.
   *
   * <p>{@link org.springframework.cache.annotation.Cacheable @Cacheable} 등 Spring 캐시 추상화를 활성화하고
   * Caffeine 기반 캐시 매니저를 등록합니다. JPA Auditing({@link JpaAuditConfig})과 분리해 두어, 캐시만 필요한
   * 단위 테스트가 JPA 메타모델 없이도 컨텍스트를 로드할 수 있습니다.</p>
   *
   * <p><b>Caffeine 전환(P5/T13):</b> 기존 {@code ConcurrentMapCacheManager}는 TTL을 지원하지 않아 정합성을
   * 쓰기 시 즉시 evict(@CacheEvict)로만 보장했습니다. Caffeine으로 교체해 캐시별 TTL/최대크기를 부여하고,
   * 외부 변경·evict 누락에 대한 안전망(stale 한도)을 둡니다. 기존 {@code @Cacheable}/{@code @CacheEvict}
   * 의미(특히 공통코드 {@code codesByCid}/{@code budgetPeriod}의 쓰기 시 evict-all, CLAUDE §5.5.1)는
   * 그대로 유지되며, CacheManager 구현만 교체됩니다.</p>
   *
   * <p><b>캐시별 정책:</b></p>
   * <ul>
   *   <li>{@code codesByType}/{@code codesByCid}/{@code budgetPeriod}/{@code menuAuthMap} — 준정적 참조
   *       데이터. 1시간 TTL(쓰기 시 이미 {@code @CacheEvict}로 무효화하므로 TTL은 안전망).</li>
   *   <li>{@code tiptapMetadata} — 10분 TTL. 추가로 {@code ProjectService} create/update/delete가
   *       {@code @CacheEvict(allEntries=true)}로 즉시 무효화(사업 목록 변경 반영).</li>
   *   <li>{@code notificationUnreadCount} — 60초 TTL, 사용자(eno)별 키. 쓰기 경로에서 evict하지만 TTL로
   *       evict 누락 시에도 stale 한도를 60초로 제한.</li>
   * </ul>
   */
  @Configuration
  @EnableCaching
  public class CacheConfig {

      /** 준정적 참조 데이터(공통코드/예산기간/메뉴권한) TTL — 쓰기 evict 보유, TTL은 안전망. */
      private static final Duration STATIC_TTL = Duration.ofHours(1);
      /** 준정적 캐시 최대 엔트리 수. 코드 그룹/연도/권한맵 키 수가 적어 넉넉히 둠. */
      private static final long STATIC_MAX_SIZE = 1_000L;

      /** Tiptap 변수 카탈로그 TTL — 쓰기 evict 보강 + 준정적 카탈로그라 10분 안전망. */
      private static final Duration TIPTAP_TTL = Duration.ofMinutes(10);
      /** Tiptap 카탈로그 캐시 최대 엔트리 수(키: 'ALL' 또는 부서코드별). */
      private static final long TIPTAP_MAX_SIZE = 500L;

      /** 알림 미읽음 카운트 TTL — 사용자별 고빈도 조회, evict 누락 대비 60초 stale 한도. */
      private static final Duration UNREAD_TTL = Duration.ofSeconds(60);
      /** 미읽음 카운트 캐시 최대 엔트리 수(사용자 약 3,000명 기준 여유). */
      private static final long UNREAD_MAX_SIZE = 10_000L;

      /**
       * Caffeine 기반 캐시 매니저.
       *
       * <p>캐시별로 {@link CaffeineCacheManager#registerCustomCache(String, com.github.benmanes.caffeine.cache.Cache)}
       * 로 명시 등록하여 각자의 TTL/최대크기를 강제합니다. 등록된 6개 캐시는 기존 {@code ConcurrentMapCacheManager}가
       * 등록하던 이름과 동일합니다(드롭 없음).</p>
       *
       * @return 6개 캐시가 per-cache spec으로 등록된 {@link CaffeineCacheManager}
       */
      @Bean
      public CacheManager cacheManager() {
          CaffeineCacheManager manager = new CaffeineCacheManager();

          // 준정적 참조 데이터: 1시간 TTL (쓰기 시 @CacheEvict로 즉시 무효화 — §5.5.1)
          manager.registerCustomCache("codesByType", buildCache(STATIC_TTL, STATIC_MAX_SIZE));
          manager.registerCustomCache("codesByCid", buildCache(STATIC_TTL, STATIC_MAX_SIZE));
          manager.registerCustomCache("budgetPeriod", buildCache(STATIC_TTL, STATIC_MAX_SIZE));
          manager.registerCustomCache("menuAuthMap", buildCache(STATIC_TTL, STATIC_MAX_SIZE));

          // Tiptap 변수 카탈로그: 10분 TTL + ProjectService 쓰기 evict 보강
          manager.registerCustomCache("tiptapMetadata", buildCache(TIPTAP_TTL, TIPTAP_MAX_SIZE));

          // 알림 미읽음 카운트: 60초 TTL, 사용자(eno)별 키
          manager.registerCustomCache("notificationUnreadCount", buildCache(UNREAD_TTL, UNREAD_MAX_SIZE));

          return manager;
      }

      /** 주어진 TTL(expireAfterWrite)과 최대 엔트리 수로 Caffeine 네이티브 캐시를 생성합니다. */
      private com.github.benmanes.caffeine.cache.Cache<Object, Object> buildCache(Duration ttl, long maxSize) {
          return Caffeine.newBuilder()
                  .expireAfterWrite(ttl)
                  .maximumSize(maxSize)
                  .build();
      }
  }
  ```

  > 참고: `notificationUnreadCount`의 `@Cacheable(... unless = "#result == 0")`은 0을 캐시하지 않으므로 Caffeine에 null/0 저장 이슈가 없다. Spring `CaffeineCache`는 기본 `allowNullValues=true`지만 unread-count는 long(0)으로 캐시 제외되고, tiptap/codes는 항상 non-null 반환이라 null 저장 경로가 없다.

- [ ] **Step 1.5 (run-to-pass)** — `CacheConfigTest`가 통과하는지 확인한다. (의존성 미반입이면 여기서 해석 실패 → Task 0으로 복귀.)
  ```bash
  cd /c/it/it_backend && ./gradlew test --tests 'com.kdb.it.config.CacheConfigTest' --console=plain
  ```
  기대: `BUILD SUCCESSFUL`, 7개 테스트 GREEN.

- [ ] **Step 1.6 (commit)**
  ```bash
  cd /c/it/it_backend && git add build.gradle src/main/java/com/kdb/it/config/CacheConfig.java src/test/java/com/kdb/it/config/CacheConfigTest.java && git commit --no-gpg-sign -m "feat: CacheManager를 Caffeine으로 전환(P5/T13) + 캐시별 TTL/max-size

ConcurrentMapCacheManager(TTL 미지원) → CaffeineCacheManager. 6개 캐시를
per-cache spec으로 등록(codes*/budgetPeriod/menuAuthMap 1h, tiptapMetadata 10m,
notificationUnreadCount 60s). 기존 @Cacheable/@CacheEvict 의미(§5.5.1 evict-all) 보존.
build.gradle에 caffeine 의존성 추가(버전 BOM 관리 3.2.4)."
  ```

---

## Task 2 — TTL 만료 동작 검증 (매뉴얼 Ticker)

**Files:** `src/test/java/com/kdb/it/config/CaffeineCacheTtlTest.java`

- [ ] **Step 2.1 (RED)** — expireAfterWrite가 실제로 만료되어 재로딩되는지를, 짧은 TTL + 매뉴얼 `Ticker`로 시간 진행을 시뮬레이션해 검증한다(실제 sleep 없음 — 결정론적). CacheConfig의 spec 자체는 Step1에서 검증했으므로, 본 테스트는 "expireAfterWrite 적용 시 만료 후 get이 null"이라는 Caffeine 동작을 명시적으로 못박는다.

  파일 `src/test/java/com/kdb/it/config/CaffeineCacheTtlTest.java`:
  ```java
  package com.kdb.it.config;

  import static org.assertj.core.api.Assertions.assertThat;

  import java.time.Duration;
  import java.util.concurrent.atomic.AtomicLong;

  import org.junit.jupiter.api.DisplayName;
  import org.junit.jupiter.api.Test;

  import com.github.benmanes.caffeine.cache.Cache;
  import com.github.benmanes.caffeine.cache.Caffeine;
  import com.github.benmanes.caffeine.cache.Ticker;

  /**
   * Caffeine expireAfterWrite 만료 동작 검증.
   *
   * <p>매뉴얼 {@link Ticker}로 가상 시간을 진행시켜, TTL 경과 후 엔트리가 만료(재로딩 대상)되는지를
   * 결정론적으로 확인합니다. 실제 sleep을 쓰지 않으므로 플래키하지 않습니다.</p>
   */
  class CaffeineCacheTtlTest {

      @Test
      @DisplayName("expireAfterWrite TTL 경과 후 엔트리가 만료된다")
      void entryExpiresAfterTtl() {
          AtomicLong nanos = new AtomicLong(0);
          Ticker ticker = nanos::get;
          Cache<String, String> cache = Caffeine.newBuilder()
                  .expireAfterWrite(Duration.ofSeconds(60))
                  .ticker(ticker)
                  .build();

          cache.put("k", "v");
          assertThat(cache.getIfPresent("k")).isEqualTo("v");

          // 59초 경과 — 아직 유효
          nanos.set(Duration.ofSeconds(59).toNanos());
          cache.cleanUp();
          assertThat(cache.getIfPresent("k")).isEqualTo("v");

          // 61초 경과 — 만료
          nanos.set(Duration.ofSeconds(61).toNanos());
          cache.cleanUp();
          assertThat(cache.getIfPresent("k")).isNull();
      }
  }
  ```

- [ ] **Step 2.2 (run-to-fail)** — 만료 임계 검증이므로 RED는 의존성 단계에서만 의미가 있다. Task1에서 Caffeine이 이미 컴파일되므로, 여기서는 의도적으로 잘못된 기대(아래)로 한 번 빨갛게 만든 뒤 정정하는 대신, **신규 테스트 파일이 컴파일·실행되는지 우선 확인**한다. 먼저 만료 라인(`isNull()`)을 일시적으로 `isEqualTo("v")`로 바꿔 실패를 관찰:
  ```bash
  cd /c/it/it_backend && ./gradlew test --tests 'com.kdb.it.config.CaffeineCacheTtlTest' --console=plain
  ```
  기대(일시 변조 시): 61초 단언에서 `expected: "v" but was: null`로 **실패**. → 관찰 후 라인을 위 정본(`isNull()`)으로 되돌린다.

- [ ] **Step 2.3 (run-to-pass)**
  ```bash
  cd /c/it/it_backend && ./gradlew test --tests 'com.kdb.it.config.CaffeineCacheTtlTest' --console=plain
  ```
  기대: `BUILD SUCCESSFUL`, 1개 테스트 GREEN.

- [ ] **Step 2.4 (commit)**
  ```bash
  cd /c/it/it_backend && git add src/test/java/com/kdb/it/config/CaffeineCacheTtlTest.java && git commit --no-gpg-sign -m "test: Caffeine expireAfterWrite 만료 동작 검증(매뉴얼 Ticker)"
  ```

---

## Task 3 — ProjectService 쓰기 경로에 tiptapMetadata evict 추가

**Files:** `src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`, `src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceCacheEvictTest.java`

> 배경: `tiptapMetadata`는 `TiptapVariableService.getMetadata()`가 활성 사업 목록(`projectRepository.findActiveProjectRefs*`)을 포함해 캐시한다. 프로젝트 생성/수정/삭제 시 카탈로그가 stale해지므로, 쓰기 직후 전체 evict한다. `allEntries=true`인 이유: 캐시 키가 'ALL'·부서코드별로 분산되어 단일 키 evict로는 모든 사용자 뷰를 무효화할 수 없기 때문.

- [ ] **Step 3.1 (RED)** — `@Import(CacheConfig.class)` 기반 슬라이스 테스트로, `ProjectService`의 create/update/delete 호출 후 `tiptapMetadata` 캐시가 비워지는지 검증한다. `ProjectService`의 협력 빈은 전부 `@MockitoBean`으로 대체하고, 실제 Spring 캐시 프록시(@CacheEvict 발화)와 실제 `CacheManager`만 사용한다. DB를 건드리지 않으므로 `@Tag("it")` 미부착.

  파일 `src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceCacheEvictTest.java`:
  ```java
  package com.kdb.it.domain.budget.project.service;

  import static org.assertj.core.api.Assertions.assertThat;
  import static org.mockito.ArgumentMatchers.any;
  import static org.mockito.ArgumentMatchers.anyString;
  import static org.mockito.BDDMockito.given;

  import org.junit.jupiter.api.BeforeEach;
  import org.junit.jupiter.api.DisplayName;
  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.test.context.SpringBootTest;
  import org.springframework.cache.Cache;
  import org.springframework.cache.CacheManager;
  import org.springframework.context.annotation.Import;
  import org.springframework.test.context.bean.override.mockito.MockitoBean;

  import com.kdb.it.config.CacheConfig;
  import com.kdb.it.common.approval.repository.ApplicationMapRepository;
  import com.kdb.it.common.approval.repository.ApplicationRepository;
  import com.kdb.it.common.approval.repository.ApproverRepository;
  import com.kdb.it.common.code.repository.CodeRepository;
  import com.kdb.it.common.code.service.CodeService;
  import com.kdb.it.common.iam.repository.OrganizationRepository;
  import com.kdb.it.common.iam.repository.UserRepository;
  import com.kdb.it.common.util.CodeNameMapBuilder;
  import com.kdb.it.domain.budget.cost.util.XcrLookupService;
  import com.kdb.it.domain.budget.project.dto.ProjectDto;
  import com.kdb.it.domain.budget.project.entity.Bprojm;
  import com.kdb.it.domain.budget.project.repository.BprojaRepository;
  import com.kdb.it.domain.budget.project.repository.ProjectItemRepository;
  import com.kdb.it.domain.budget.project.repository.ProjectRepository;
  import com.kdb.it.domain.budget.work.repository.BbugtmRepository;

  /**
   * ProjectService 쓰기 경로의 tiptapMetadata 캐시 무효화 검증.
   *
   * <p>실제 {@link CacheConfig}(Caffeine)와 Spring 캐시 프록시를 띄워, create/update/delete 호출이
   * {@code @CacheEvict(cacheNames="tiptapMetadata", allEntries=true)}를 발화시키는지 확인합니다.
   * DB·협력 서비스는 Mockito로 대체하므로 DB 미접속이며 {@code @Tag("it")}를 부착하지 않습니다.</p>
   */
  @SpringBootTest(classes = {CacheConfig.class, ProjectService.class})
  class ProjectServiceCacheEvictTest {

      @Autowired
      private ProjectService projectService;

      @Autowired
      private CacheManager cacheManager;

      // ProjectService 협력 빈 — 캐시 발화만 검증하므로 동작은 최소 스텁
      @MockitoBean private ProjectRepository projectRepository;
      @MockitoBean private ApplicationMapRepository capplaRepository;
      @MockitoBean private ApplicationRepository capplmRepository;
      @MockitoBean private ProjectItemRepository bitemmRepository;
      @MockitoBean private OrganizationRepository corgnIRepository;
      @MockitoBean private UserRepository cuserIRepository;
      @MockitoBean private ApproverRepository cdecimRepository;
      @MockitoBean private CodeService codeService;
      @MockitoBean private CodeRepository ccodemRepository;
      @MockitoBean private BbugtmRepository bbugtmRepository;
      @MockitoBean private XcrLookupService xcrLookupService;
      @MockitoBean private ProjectBudgetSummaryService projectBudgetSummaryService;
      @MockitoBean private BprojaRepository bprojaRepository;
      @MockitoBean private BprojaSyncService bprojaSyncService;
      @MockitoBean private CodeNameMapBuilder codeNameMapBuilder;

      private Cache tiptapCache;

      @BeforeEach
      void seedCache() {
          tiptapCache = cacheManager.getCache("tiptapMetadata");
          assertThat(tiptapCache).isNotNull();
          // evict 검증을 위해 임의 엔트리를 미리 적재
          tiptapCache.put("ALL", "stale");
          tiptapCache.put("D001", "stale");
      }

      @Test
      @DisplayName("createProject 호출 시 tiptapMetadata 전체 evict")
      void createProject_evictsTiptapMetadata() {
          given(projectRepository.getNextSequenceValue()).willReturn(1L);

          projectService.createProject(newCreateRequest());

          assertThat(tiptapCache.get("ALL")).isNull();
          assertThat(tiptapCache.get("D001")).isNull();
      }

      @Test
      @DisplayName("updateProject 호출 시 tiptapMetadata 전체 evict")
      void updateProject_evictsTiptapMetadata() {
          Bprojm project = org.mockito.Mockito.mock(Bprojm.class);
          given(project.getSno()).willReturn(1);
          given(project.getAbusMngNo()).willReturn("PRJ-2026-0001");
          given(projectRepository.findByAbusMngNoAndDelYn(anyString(), anyString()))
                  .willReturn(java.util.Optional.of(project));
          given(capplaRepository.existsByFntTbNmAndPkColNmAndFntTbCrySnoAndApfStsIn(
                  anyString(), anyString(), any(), any())).willReturn(false);

          projectService.updateProject("PRJ-2026-0001", newUpdateRequest());

          assertThat(tiptapCache.get("ALL")).isNull();
          assertThat(tiptapCache.get("D001")).isNull();
      }

      @Test
      @DisplayName("deleteProject 호출 시 tiptapMetadata 전체 evict")
      void deleteProject_evictsTiptapMetadata() {
          Bprojm project = org.mockito.Mockito.mock(Bprojm.class);
          given(project.getSno()).willReturn(1);
          given(projectRepository.findByAbusMngNoAndDelYn(anyString(), anyString()))
                  .willReturn(java.util.Optional.of(project));
          given(capplaRepository.existsByFntTbNmAndPkColNmAndFntTbCrySnoAndApfStsIn(
                  anyString(), anyString(), any(), any())).willReturn(false);
          given(bitemmRepository.findByAbusMngNoAndFntTbCrySno(anyString(), any()))
                  .willReturn(java.util.List.of());

          projectService.deleteProject("PRJ-2026-0001");

          assertThat(tiptapCache.get("ALL")).isNull();
          assertThat(tiptapCache.get("D001")).isNull();
      }

      private ProjectDto.CreateRequest newCreateRequest() {
          ProjectDto.CreateRequest req = new ProjectDto.CreateRequest();
          req.setAbusNm("테스트사업");
          req.setBseYy("2026");
          return req;
      }

      private ProjectDto.UpdateRequest newUpdateRequest() {
          ProjectDto.UpdateRequest req = new ProjectDto.UpdateRequest();
          req.setAbusNm("수정사업");
          return req;
      }
  }
  ```

  > ⚠️ 실행 전 조정: `newCreateRequest()`/`newUpdateRequest()`/`mock(Bprojm.class)` 스텁은 `ProjectDto.CreateRequest`/`UpdateRequest`의 실제 필수 필드·`validateModifyPermission`(SecurityContext 의존)·`bprojaSyncService.upsert` 등으로 NPE/AccessDenied가 날 수 있다. `@CacheEvict`는 **메서드가 정상 반환할 때** 발화하므로, 스텁은 "예외 없이 끝까지 도달"하도록 채워야 한다. 작성자는 RED 실행에서 나오는 첫 예외(예: `validateModifyPermission`의 SecurityContext null, `codeService.validateBudgetPeriod()` 등)를 보고 `given(...)`/`SecurityContextHolder` 셋업을 보강한다. (관리자 컨텍스트를 심으려면 `SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(adminUserDetails, null, authorities))`.) 핵심 단언(`tiptapCache.get(...) == null`)은 변경하지 않는다.

- [ ] **Step 3.2 (run-to-fail)** — 아직 `ProjectService`에 `@CacheEvict(tiptapMetadata)`가 없으므로, 메서드가 정상 반환해도 캐시가 비워지지 않아 단언이 실패한다(또는 스텁 보강 전에는 예외). 스텁을 충분히 보강한 뒤 실행해 "evict 미발생"으로 빨갛게 만든다.
  ```bash
  cd /c/it/it_backend && ./gradlew test --tests 'com.kdb.it.domain.budget.project.service.ProjectServiceCacheEvictTest' --console=plain
  ```
  기대: `tiptapCache.get("ALL")`가 여전히 `"stale"`(non-null) → `expected: null but was: ...` **실패**.

- [ ] **Step 3.3 (GREEN)** — `ProjectService`에 evict 어노테이션을 추가한다.

  먼저 import를 추가한다. `ProjectService.java`의 import 블록에서:
  ```java
  import org.springframework.security.access.AccessDeniedException;
  ```
  바로 위(또는 알파벳 순 적절 위치)에 추가:
  ```java
  import org.springframework.cache.annotation.CacheEvict;
  ```

  그다음 3개 쓰기 메서드의 `@Transactional` 위에 `@CacheEvict`를 추가한다(어노테이션 순서는 `@Transactional`보다 위/아래 무관하나 가독성을 위해 `@Transactional` 위에 둔다).

  `createProject` — 현재:
  ```java
      @Transactional
      public String createProject(ProjectDto.CreateRequest request) {
  ```
  변경 후:
  ```java
      // 프로젝트 생성 시 Tiptap 변수 카탈로그(활성 사업 목록 포함)가 stale → 전체 evict (P5/T13).
      // 캐시 키가 'ALL'·부서코드별로 분산되어 단일 키로는 무효화 불가하므로 allEntries=true.
      @CacheEvict(cacheNames = "tiptapMetadata", allEntries = true)
      @Transactional
      public String createProject(ProjectDto.CreateRequest request) {
  ```

  `updateProject` — 현재:
  ```java
      @Transactional
      public String updateProject(String prjMngNo, ProjectDto.UpdateRequest request) {
  ```
  변경 후:
  ```java
      // 프로젝트 수정 시 Tiptap 변수 카탈로그가 stale → 전체 evict (P5/T13).
      @CacheEvict(cacheNames = "tiptapMetadata", allEntries = true)
      @Transactional
      public String updateProject(String prjMngNo, ProjectDto.UpdateRequest request) {
  ```

  `deleteProject` — 현재:
  ```java
      @Transactional
      public void deleteProject(String prjMngNo) {
  ```
  변경 후:
  ```java
      // 프로젝트 삭제 시 Tiptap 변수 카탈로그가 stale → 전체 evict (P5/T13).
      @CacheEvict(cacheNames = "tiptapMetadata", allEntries = true)
      @Transactional
      public void deleteProject(String prjMngNo) {
  ```

- [ ] **Step 3.4 (run-to-pass)**
  ```bash
  cd /c/it/it_backend && ./gradlew test --tests 'com.kdb.it.domain.budget.project.service.ProjectServiceCacheEvictTest' --console=plain
  ```
  기대: `BUILD SUCCESSFUL`, 3개 테스트 GREEN.

- [ ] **Step 3.5 (commit)**
  ```bash
  cd /c/it/it_backend && git add src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceCacheEvictTest.java && git commit --no-gpg-sign -m "feat: ProjectService 쓰기 경로에 tiptapMetadata evict 추가(P5/T13)

create/update/delete에 @CacheEvict(cacheNames=tiptapMetadata, allEntries=true).
활성 사업 목록 변경 시 Tiptap 변수 카탈로그 즉시 무효화."
  ```

---

## Task 4 — NotificationService unread-count 캐시 주석 현행화 (동작 무변경)

**Files:** `src/main/java/com/kdb/it/common/notification/service/NotificationService.java`

> 동작 변경 없음: 키(`#p0`/`#p1`)와 `unless`·`condition`·evict 지점은 그대로 둔다(이미 사용자별 키 + 쓰기 evict). TTL 60초는 Task1의 CacheConfig에서 이미 부여되었다. JavaDoc만 "ConcurrentMap은 TTL 미지원 → evict-on-write" 설명을 "Caffeine 60초 TTL + evict-on-write 병행"으로 정정한다(§4.1 한글 주석 현행화 — 코드 동작과 불일치하는 설명만 보정).

- [ ] **Step 4.1 (edit)** — `unreadCount` JavaDoc을 정정한다. 현재:
  ```java
      /**
       * 본인 미읽음 알림 건수 조회.
       *
       * <p>AppHeader 배지에서 고빈도 호출되므로 사용자(currentEno)별로 캐시한다. 카운트가 0이면
       * 캐시하지 않아(unless) 신규 알림 발생 시 즉시 반영되도록 한다. 쓰기 경로(send/markRead/
       * markAllRead/softDelete)에서 해당 사용자 키를 evict 한다. (ConcurrentMap은 TTL 미지원 →
       * evict-on-write로 정합 보장, {@link com.kdb.it.config.CacheConfig} 참조.)</p>
       */
  ```
  변경 후:
  ```java
      /**
       * 본인 미읽음 알림 건수 조회.
       *
       * <p>AppHeader 배지에서 고빈도 호출되므로 사용자(currentEno)별로 캐시한다. 카운트가 0이면
       * 캐시하지 않아(unless) 신규 알림 발생 시 즉시 반영되도록 한다. 쓰기 경로(send/markRead/
       * markAllRead/softDelete)에서 해당 사용자 키를 evict 한다. 캐시는 Caffeine 60초 TTL을
       * 가지므로(P5/T13, {@link com.kdb.it.config.CacheConfig} 참조), evict 누락 시에도 stale은
       * 최대 60초로 제한된다(evict-on-write와 TTL 병행).</p>
       */
  ```

- [ ] **Step 4.2 (run-to-pass)** — 주석 변경이므로 기존 알림 테스트가 깨지지 않는지 확인.
  ```bash
  cd /c/it/it_backend && ./gradlew test --tests 'com.kdb.it.common.notification.*' --console=plain
  ```
  기대: `BUILD SUCCESSFUL` (회귀 없음).

- [ ] **Step 4.3 (commit)**
  ```bash
  cd /c/it/it_backend && git add src/main/java/com/kdb/it/common/notification/service/NotificationService.java && git commit --no-gpg-sign -m "docs: unreadCount 캐시 주석을 Caffeine 60초 TTL 반영으로 현행화"
  ```

---

## Task 5 — 전체 회귀 검증 (기존 캐시 의미 보존 확인)

**Files:** (없음 — 검증만)

- [ ] **Step 5.1** — 캐시 관련 기존 단위 테스트(특히 `CodeServiceTest`의 evict 검증)와 전체 CI 게이트 테스트를 돌려 CacheManager 교체 회귀가 없는지 확인한다. `@Tag("it")` 통합 테스트는 기본 `test`에서 제외되므로 로컬 Oracle 불필요.
  ```bash
  cd /c/it/it_backend && ./gradlew clean test --console=plain
  ```
  기대: `BUILD SUCCESSFUL`. 특히 `CodeServiceTest`(공통코드 create/update/delete의 evict), `CacheConfigTest`, `CaffeineCacheTtlTest`, `ProjectServiceCacheEvictTest`, `NotificationService*` 전부 GREEN.

- [ ] **Step 5.2** — 컴파일러 경고(`-parameters`, UTF-8)와 JaCoCo 게이트(70%)가 깨지지 않는지 확인. (`*Config*`/`*Service*` 중 `CacheConfig`는 `**/*Config*.class` 제외 대상이라 커버리지 영향 없음.) Step 5.1의 `clean test`가 `jacocoTestReport`를 finalizedBy로 실행하므로 별도 명령 불필요. JaCoCo 검증을 명시 실행하려면:
  ```bash
  cd /c/it/it_backend && ./gradlew jacocoTestCoverageVerification --console=plain
  ```
  기대: `BUILD SUCCESSFUL`.

- [ ] **Step 5.3 (no commit)** — 검증 단계이므로 커밋 없음. 실패 시 해당 Task로 복귀해 수정 후 재검증.

---

## Self-Review

작업 완료 전 아래를 점검한다.

- [ ] **의존성 게이트**: Task 0에서 `caffeine-3.2.4.jar` + 트랜지티브(`checker-qual`, `error_prone_annotations`)가 오프라인(`C:/maven-repo` 또는 Nexus) 해석 가능함을 확인했는가? 미반입이면 PR을 진행하지 않고 반입 신청 대기로 멈췄는가? 버전은 BOM 관리(3.2.4)라 `build.gradle`에 핀을 박지 않았는가?
- [ ] **캐시 드롭 없음**: `CaffeineCacheManager`가 기존 6개 캐시(`codesByType`, `codesByCid`, `budgetPeriod`, `notificationUnreadCount`, `tiptapMetadata`, `menuAuthMap`)를 모두 등록하는가? (`codesByType`은 현재 `@Cacheable` 사용처가 없지만 기존 등록을 유지해 드롭 회귀를 막았는가?) `CacheConfigTest.registersAllSixCaches`로 강제되는가?
- [ ] **기존 의미 보존(§5.5.1)**: `CodeService`의 `@Caching(evict={budgetPeriod, codesByCid})`, `MenuAuthMapProvider`/`AdminMenuService`의 `menuAuthMap`, `NotificationService`의 사용자별 evict가 **어노테이션 변경 없이** 그대로 동작하는가? `CodeServiceTest`가 GREEN인가?
- [ ] **tiptap evict**: `ProjectService` create/update/delete 3곳 모두 `@CacheEvict(cacheNames="tiptapMetadata", allEntries=true)`를 가졌는가? `allEntries=true`인 이유(키 분산: 'ALL'/부서코드별)가 주석에 남았는가? 슬라이스 테스트 3건이 GREEN인가?
- [ ] **TTL 정확성**: codes*/budgetPeriod/menuAuthMap=1h, tiptapMetadata=10m, notificationUnreadCount=60s가 `CacheConfigTest`로 검증되는가? 만료 동작이 `CaffeineCacheTtlTest`(매뉴얼 Ticker, 비플래키)로 검증되는가?
- [ ] **null/0 캐시**: unread-count의 `unless="#result==0"`로 0은 캐시 제외되고, tiptap/codes는 non-null 반환이라 Caffeine null 저장 경로가 없는가?
- [ ] **테스트 태깅**: 신규 3개 테스트 모두 DB 미접속(순수 빈/Mockito)이라 `@Tag("it")`를 부착하지 않았는가? 기본 `./gradlew test`(CI 게이트)에서 실행되는가?
- [ ] **규약 준수**: 한글 JavaDoc, AssertJ, JUnit5, 생성자 주입 유지. 비즈니스 로직 변경 없음(캐시 인프라 + 어노테이션 + 주석만).
- [ ] **git**: 작업이 `feature/db-jpa-p5-caffeine`(it_backend `main`에서 분기)에서 이뤄졌고, 각 커밋이 `--no-gpg-sign`인가? 컨트롤러가 PR을 만들 것이므로 본 작업자는 PR을 생성하지 않는다.
