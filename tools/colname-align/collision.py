"""전 엔티티에서 재사용(2개 이상 엔티티 등장) 컬럼을 검출한다."""
import sys
import glob
import os
from fieldmap import parse_pairs


def reused_columns(per_entity: dict) -> dict:
    """입력 {엔티티명: [(컬럼,필드),...]} → {컬럼: [보유엔티티 정렬]} (2개 이상만)."""
    owners: dict = {}
    for entity, pairs in per_entity.items():
        for col, _field in pairs:
            owners.setdefault(col, set()).add(entity)
    return {c: sorted(es) for c, es in owners.items() if len(es) >= 2}


def scan_dir(root: str) -> dict:
    """엔티티 디렉토리 트리에서 {엔티티명: [(컬럼,필드)]} 구성. @Entity 파일만."""
    per_entity = {}
    for path in glob.glob(os.path.join(root, "**", "*.java"), recursive=True):
        with open(path, encoding="utf-8", errors="replace") as fh:
            s = fh.read()
        if "@Entity" not in s and "@MappedSuperclass" not in s:
            continue
        name = os.path.basename(path)[:-5]
        per_entity[name] = parse_pairs(s)
    return per_entity


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else "../../it_backend/src/main/java"
    reused = reused_columns(scan_dir(root))
    for col in sorted(reused):
        print(f"{col}\t{', '.join(reused[col])}")
