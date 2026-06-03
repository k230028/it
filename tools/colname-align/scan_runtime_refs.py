"""옛 필드명 토큰에 대한 컴파일 비가시 참조를 검출한다.
파생 쿼리 메서드명(findAllBy 포함), JPQL 속성 경로, Sort 문자열."""
import re
import sys
import glob


def _cap(token: str) -> str:
    return token[0].upper() + token[1:]


def find_refs(src: str, tokens):
    """[(종류, 라인번호, 라인), ...]. native 쿼리 라인은 제외."""
    hits = []
    # Spring Data JPA 파생 쿼리 구분자: 필드명 다음에 오는 키워드 목록
    # 필드명 뒤에 이 키워드나 메서드명 끝/파라미터 영역이 오는 경우만 매치한다.
    # 이를 통해 docVrsSno처럼 구 필드명이 접두어인 신규 필드명을 false positive에서 제외한다.
    _SEPARATORS = r'(?:And|Or|OrderBy|Order|Asc|Desc|In|NotIn|Is|Not|Null|True|False|Between|Like|Containing|StartingWith|EndingWith|Exists|Before|After|LessThan|GreaterThan|IgnoreCase|AllIgnoreCase|First|Top|Distinct)'
    derived_parts = []
    for t in tokens:
        cap = _cap(t)
        # 토큰 다음에 Spring Data 구분자 키워드, 여는 괄호, 줄끝이 오는 경우만 매치
        derived_parts.append(re.escape(cap) + r'(?=' + _SEPARATORS + r'|[^A-Za-z]|$)')
    derived = re.compile(
        r'\b(?:findAll|find|readAll|read|getAll|get|queryAll|query|stream|count|exists|delete|removeAll|remove)By[A-Za-z]*('
        + '|'.join(derived_parts) + r')'
    )
    for i, line in enumerate(src.splitlines(), 1):
        if 'nativeQuery = true' in line or 'nativeQuery=true' in line:
            continue
        if derived.search(line):
            hits.append(("derived-query", i, line.strip()))
            continue
        for t in tokens:
            if re.search(r'@Query|SELECT |FROM |WHERE |JOIN ', line) and re.search(r'\b[a-z]\.' + re.escape(t) + r'\b', line):
                hits.append(("jpql-path", i, line.strip())); break
            if re.search(r'(Sort\.by|Sort\.Order|orderBy)\s*\(\s*"' + re.escape(t) + r'"', line):
                hits.append(("sort-string", i, line.strip())); break
    return hits


def scan_paths(globs, tokens):
    out = []
    for g in globs:
        for path in glob.glob(g, recursive=True):
            with open(path, encoding="utf-8", errors="replace") as fh:
                for kind, ln, text in find_refs(fh.read(), tokens):
                    out.append((path, kind, ln, text))
    return out


if __name__ == "__main__":
    sep = sys.argv.index("--")
    tokens = sys.argv[1].split(",")
    globs = sys.argv[sep + 1:]
    rows = scan_paths(globs, tokens)
    for path, kind, ln, text in rows:
        print(f"{path}:{ln}\t[{kind}]\t{text}")
    print(f"\n총 {len(rows)}건")
    sys.exit(1 if rows else 0)
