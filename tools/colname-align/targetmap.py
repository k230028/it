"""엔티티별 {현재필드: 목표필드} 생성. camel(col) 기본, 충돌 오버라이드 우선."""
import sys
import json
from fieldmap import parse_pairs, camel


def build_target_map(entity: str, pairs, overrides: dict) -> dict:
    """overrides = {엔티티: {컬럼: 목표명}}. 현재필드 != 목표필드 인 항목만 반환."""
    ov = overrides.get(entity, {})
    result = {}
    for col, current in pairs:
        target = ov.get(col, camel(col))
        if current != target:
            result[current] = target
    return result


if __name__ == "__main__":
    java_path, ov_path = sys.argv[1], sys.argv[2]
    with open(java_path, encoding="utf-8") as fh:
        pairs = parse_pairs(fh.read())
    with open(ov_path, encoding="utf-8") as fh:
        overrides = json.load(fh)
    entity = java_path.split("/")[-1][:-5]
    for cur, tgt in build_target_map(entity, pairs, overrides).items():
        print(f"{cur} -> {tgt}")
