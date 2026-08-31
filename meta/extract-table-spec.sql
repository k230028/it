-- ============================================================================
-- meta/table.txt 형식 그대로 라이브 DB에서 컬럼 정의를 추출한다 (읽기 전용)
-- ============================================================================
-- [용도]
--   `meta/table.txt`는 운영 DB에서 뽑은 데이터 사전이 아니라 설계 정의서다
--   (`docs/db-schema-gap/db-schema-gap-2026-08-31.md` 2.2·5장). 그래서 정의서가
--   운영 물리 상태와 실제로 같은지는 확인된 적이 없다. 이 스크립트를 **운영 DB에서**
--   실행하면 정의서와 같은 10컬럼 TSV가 나오고, `tools/compare-table-spec.mjs`로
--   차이를 그대로 대조할 수 있다.
--
-- [읽기 전용]
--   SELECT만 한다. 데이터도 스키마도 바꾸지 않는다. 운영 읽기 계정으로 충분하다.
--
-- [실행]
--   sqlplus <읽기계정>@<운영TNS> @extract-table-spec.sql
--   또는 Wallet:  sqlplus /@<별칭> @extract-table-spec.sql
--   비밀번호를 명령행에 적지 않는다. 프롬프트나 Wallet을 쓴다.
--   결과: 같은 디렉터리에 table-spec-extract.txt
--
-- [table.txt 표기 규약 — 정의서에서 역산해 맞춘 것]
--   길이   VARCHAR2·CHAR : CHAR_LENGTH. 선언한 숫자 그 자체다. VARCHAR2(100 CHAR)와
--                          VARCHAR2(100 BYTE) 모두 100이 나온다(정의서가 semantics를
--                          표기하지 않으므로 의도된 동작이다. 5장 참조).
--          NUMBER        : DATA_PRECISION, 미지정이면 DATA_LENGTH(=22).
--          DATE·CLOB 등  : 공란.
--   소수점 NUMBER의 DATA_SCALE이 0보다 클 때만 표기. 0과 NULL은 공란.
--   NULL여부  ALL_TAB_COLS.NULLABLE을 그대로 쓴다(Y=NULL 허용, N=NOT NULL).
--            PK 컬럼은 Oracle이 N으로 보고하므로 정의서와 같아진다.
--   PK여부    PK 구성 컬럼이면 Y, 아니면 공란.
--   기본값    DATA_DEFAULT를 RTRIM만 해서 원문 그대로 낸다. 명시적 `DEFAULT NULL`과
--            "기본값 없음"의 구분은 비교 도구가 정규화한다(정의서는 구분 못 함).
--
-- [정렬]
--   테이블명·COLUMN_ID 순이다. `table.txt`의 테이블 순서는 알파벳순이 아닌 설계
--   정의서 순서라 파일을 그대로 diff하면 안 된다. 비교 도구가 (테이블,컬럼) 키로
--   대조하므로 정렬은 문제되지 않는다.
--
-- [제외]
--   Flyway 이력 테이블, 휴지통 객체(BIN$…), 시스템 생성 객체, 뷰, 가상·숨김 컬럼.
--   정의서와 같은 기준이다.
-- ============================================================================

SET SERVEROUTPUT ON SIZE UNLIMITED FORMAT WRAPPED
SET LINESIZE 32767
SET LONG 32767
SET PAGESIZE 0
SET TRIMSPOOL ON
SET FEEDBACK OFF
SET VERIFY OFF
SET ECHO OFF
SET HEADING OFF

SPOOL table-spec-extract.txt

DECLARE
    c_tab    CONSTANT VARCHAR2(1) := CHR(9);
    c_owner  CONSTANT VARCHAR2(30) := 'ITPOWN';

    TYPE t_flags IS TABLE OF PLS_INTEGER INDEX BY VARCHAR2(300);
    v_pk     t_flags;

    v_len    VARCHAR2(40);
    v_scale  VARCHAR2(40);
    v_dflt   VARCHAR2(32767);

    -- TSV가 깨지지 않도록 탭·개행을 공백으로 바꾸고 뒤 공백을 턴다.
    FUNCTION clean(p_text IN VARCHAR2) RETURN VARCHAR2 IS
    BEGIN
        RETURN RTRIM(REPLACE(REPLACE(REPLACE(NVL(p_text, ''),
                     CHR(9), ' '), CHR(13), ' '), CHR(10), ' '));
    END;
BEGIN
    FOR p IN (
        SELECT cc.TABLE_NAME, cc.COLUMN_NAME
          FROM ALL_CONSTRAINTS c
          JOIN ALL_CONS_COLUMNS cc
            ON cc.OWNER = c.OWNER
           AND cc.CONSTRAINT_NAME = c.CONSTRAINT_NAME
         WHERE c.OWNER = c_owner
           AND c.CONSTRAINT_TYPE = 'P'
    ) LOOP
        v_pk(p.TABLE_NAME || '.' || p.COLUMN_NAME) := 1;
    END LOOP;

    DBMS_OUTPUT.PUT_LINE(
        '테이블명' || c_tab || '테이블한글명' || c_tab || '컬럼명' || c_tab ||
        '컬럼한글명' || c_tab || '"PK여부"' || c_tab || '"NULL여부"' || c_tab ||
        'Default Value' || c_tab || '타입' || c_tab || '길이' || c_tab || '"소수점"');

    FOR c IN (
        SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, c.NULLABLE,
               c.CHAR_LENGTH, c.DATA_PRECISION, c.DATA_SCALE, c.DATA_LENGTH,
               c.DATA_DEFAULT,
               tc.COMMENTS AS TAB_CMT,
               mc.COMMENTS AS COL_CMT
          FROM ALL_TAB_COLS c
          JOIN ALL_TABLES t
            ON t.OWNER = c.OWNER
           AND t.TABLE_NAME = c.TABLE_NAME
          LEFT JOIN ALL_TAB_COMMENTS tc
            ON tc.OWNER = c.OWNER
           AND tc.TABLE_NAME = c.TABLE_NAME
          LEFT JOIN ALL_COL_COMMENTS mc
            ON mc.OWNER = c.OWNER
           AND mc.TABLE_NAME = c.TABLE_NAME
           AND mc.COLUMN_NAME = c.COLUMN_NAME
         WHERE c.OWNER = c_owner
           AND c.HIDDEN_COLUMN = 'NO'
           AND c.VIRTUAL_COLUMN = 'NO'
           AND UPPER(c.TABLE_NAME) <> 'FLYWAY_SCHEMA_HISTORY'
           AND c.TABLE_NAME NOT LIKE 'BIN$%'
           AND c.TABLE_NAME NOT LIKE 'SYS[_]%' ESCAPE '['
         ORDER BY c.TABLE_NAME, c.COLUMN_ID
    ) LOOP
        v_len := CASE
                     WHEN c.DATA_TYPE IN ('VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR')
                         THEN TO_CHAR(c.CHAR_LENGTH)
                     WHEN c.DATA_TYPE = 'NUMBER'
                         THEN TO_CHAR(NVL(c.DATA_PRECISION, c.DATA_LENGTH))
                 END;

        v_scale := CASE
                       WHEN c.DATA_TYPE = 'NUMBER' AND NVL(c.DATA_SCALE, 0) > 0
                           THEN TO_CHAR(c.DATA_SCALE)
                   END;

        -- LONG인 DATA_DEFAULT는 PL/SQL 변수로 받으면 VARCHAR2로 넘어온다.
        v_dflt := clean(c.DATA_DEFAULT);

        DBMS_OUTPUT.PUT_LINE(
            c.TABLE_NAME || c_tab ||
            clean(c.TAB_CMT) || c_tab ||
            c.COLUMN_NAME || c_tab ||
            clean(c.COL_CMT) || c_tab ||
            CASE WHEN v_pk.EXISTS(c.TABLE_NAME || '.' || c.COLUMN_NAME)
                 THEN 'Y' END || c_tab ||
            c.NULLABLE || c_tab ||
            v_dflt || c_tab ||
            c.DATA_TYPE || c_tab ||
            v_len || c_tab ||
            v_scale);
    END LOOP;
END;
/

SPOOL OFF
SET HEADING ON
SET FEEDBACK ON
