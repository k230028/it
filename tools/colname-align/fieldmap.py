"""엔티티 .java 소스에서 (@Column 물리명, Java 필드명) 쌍을 파싱한다."""
import re
import sys

_COL = re.compile(r'@Column\(\s*name\s*=\s*"([A-Z0-9_]+)"')
_FLD = re.compile(r'private\s+[\w<>\.\[\],\s]+?\s(\w+)\s*;')


def camel(col: str) -> str:
    """물리 컬럼명 → lowerCamelCase. 예: ABUS_MNG_NO → abusMngNo"""
    parts = col.lower().split('_')
    return parts[0] + ''.join(p.capitalize() for p in parts[1:])


def parse_pairs(src: str):
    """소스 문자열에서 [(컬럼명, 필드명), ...] 반환.
    @Column(name="X" 매칭 후 그 뒤 400자 내 첫 'private <타입> <필드>;'를 필드로 본다."""
    out = []
    for m in _COL.finditer(src):
        tail = src[m.end():m.end() + 400]
        fm = _FLD.search(tail)
        if fm:
            out.append((m.group(1), fm.group(1)))
    return out


def deviations(src: str):
    """[(컬럼, 현재필드, 목표필드), ...] — 현재≠목표 인 것만."""
    return [(c, f, camel(c)) for c, f in parse_pairs(src) if f != camel(c)]


if __name__ == "__main__":
    for path in sys.argv[1:]:
        with open(path, encoding="utf-8") as fh:
            s = fh.read()
        for c, f, t in deviations(s):
            print(f"{path}\t{f} -> {t}\t(col {c})")
