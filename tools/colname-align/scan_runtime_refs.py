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
    derived = re.compile(
        r'\b(?:findAll|find|readAll|read|getAll|get|queryAll|query|stream|count|exists|delete|removeAll|remove)By[A-Za-z]*('
        + '|'.join(_cap(t) for t in tokens) + r')[A-Za-z]*\b'
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
