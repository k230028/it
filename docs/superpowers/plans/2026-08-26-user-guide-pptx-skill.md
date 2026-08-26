# 사용자 가이드 PPT 작성 스킬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KDB 템플릿 서식을 유지한 채 IT Portal 화면을 업무 흐름 순서로 배치한 사용자 가이드 PPT를 반복 생성하는 스킬을 만든다.

**Architecture:** 172MB짜리 템플릿 B를 베이스 패키지로 풀어 필요한 슬라이드만 남기고 재조립한다. 문구 위주 슬라이드는 템플릿 패턴을 복제해 텍스트만 치환하고(`pattern`), 화면 캡처 슬라이드는 헤더만 남긴 내지에 캡처·설명·번호를 조립한다(`screen`). 캡처는 Playwright로 mock API 위에서 결정적으로 뜬다.

**Tech Stack:** Python 3.11 표준 라이브러리(`zipfile`, `xml.etree.ElementTree`, `hashlib`, `json`, `unittest`), Node 24 + `playwright` 1.60.0 (it_frontend에서 빌려 씀), OOXML(PresentationML/DrawingML)

**Spec:** `docs/superpowers/specs/2026-08-26-user-guide-pptx-skill-design.md`

## Global Constraints

- 스킬 루트: `C:\it\.claude\skills\writing-user-guide-pptx\`
- Python 인터프리터: `C:\Users\KDB\AppData\Local\Programs\Python\Python311\python.exe`
- **Python 스크립트는 표준 라이브러리만 쓴다.** `python-pptx`, `lxml`, `PyYAML` 등 외부 패키지 금지
- 설정 파일 형식은 **JSON**. YAML 금지 (양쪽 런타임 모두 무의존성으로 읽어야 함)
- `it_frontend` / `it_backend` / `it_database` 저장소에는 **파일을 추가·수정하지 않는다.** Playwright는 `it_frontend/node_modules`에서 빌려 쓰기만 한다
- 신규 주석·docstring은 한글로 작성한다 (`C:\it\CLAUDE.md` §3)
- `git add -A` / `git add .` / `git commit -a` 금지. 경로를 명시해 스테이징한다 (공유 워킹트리)
- 슬라이드 크기: 12192000 × 6858000 EMU = 33.87 × 19.05 cm. **1 cm = 360000 EMU**
- 템플릿 경로:
  - A: `C:\it\sample\템플릿 1번 A(문서작업용).pptx`
  - B: `C:\it\sample\템플릿 1번 B(다이어그램용).pptx`
- `SCREEN_BASE_SLIDE` = 템플릿 B의 `slide283`
- 테마 색: accent1 `#1758C0`, accent2 `#0E3D99`, accent3 `#0C3080`, accent4 `#FF7575`
- 새로 만드는 텍스트에 글꼴을 지정하지 않는다. 테마 글꼴(`KDB고딕M_Pro`)을 상속시킨다

### OOXML 네임스페이스

모든 스크립트에서 아래 접두어를 쓴다.

```python
NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'ct': 'http://schemas.openxmlformats.org/package/2006/content-types',
    'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
}
```

`ElementTree`는 기본적으로 `ns0:` 같은 접두어를 붙여 직렬화한다. **모든 쓰기 경로에서
`ET.register_namespace()`를 호출해 원본 접두어를 보존해야 한다.** 접두어가 바뀌면 PowerPoint가 파일을 거부한다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `scripts/oox/emu.py` | cm ↔ EMU 변환, 내접(contain) 사각형 계산 |
| `scripts/oox/package.py` | pptx 패키지 읽기/쓰기, rels, `[Content_Types].xml`, 미디어 해시 재명명, 고아 정리 |
| `scripts/oox/text.py` | 문단 단위 텍스트 치환 |
| `scripts/oox/shapes.py` | `<p:pic>` · 텍스트 상자 · 원형 배지 XML 생성 |
| `scripts/oox/slides.py` | 슬라이드 복제, A→B 이식, 최상위 도형 열거·제거 |
| `scripts/catalog_templates.py` | 템플릿 → `template-catalog.json` / `.md` |
| `scripts/build_deck.py` | `deck.json` + PNG → pptx (CLI) |
| `scripts/verify_deck.py` | 산출물 검증 (CLI) |
| `scripts/capture_screens.mjs` | Playwright 캡처 (CLI) |
| `assets/capture-fixtures.json` | 로그인·API mock 선언 |
| `assets/flow.it-portal.json` | 1차 범위 3개 흐름 정의 |
| `assets/deck.example.json` | deck.json 예시 |
| `references/template-catalog.md` | 패턴 색인 (생성물) |
| `references/it-portal-flows.md` | 업무 흐름 SoT |
| `references/ooxml-notes.md` | 이식 함정 모음 |
| `SKILL.md` | 워크플로 · 규칙 · 체크리스트 |
| `tests/__init__.py` | 빈 파일. `tests` 를 패키지로 만들어 테스트 간 import를 가능하게 한다 |
| `tests/test_*.py` | 각 모듈의 단위 테스트 |

모든 테스트 명령의 작업 디렉터리는 `C:/it/.claude/skills/writing-user-guide-pptx` 다.
`tests/__init__.py` 가 없으면 `python -m unittest tests.test_package` 형태의 실행과
`test_verify_deck.py` 의 `from tests.test_build_deck import write_png` 가 모두 깨진다.

`scripts/oox/` 아래 5개 모듈로 나눈 이유는, 하나로 두면 800줄이 넘어 수정 시 맥락 유지가 어렵기 때문이다.

---

### Task 1: EMU 변환과 내접 계산

**Files:**
- Create: `.claude/skills/writing-user-guide-pptx/scripts/oox/__init__.py` (빈 파일)
- Create: `.claude/skills/writing-user-guide-pptx/scripts/oox/emu.py`
- Create: `.claude/skills/writing-user-guide-pptx/tests/__init__.py` (빈 파일)
- Test: `.claude/skills/writing-user-guide-pptx/tests/test_emu.py`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `EMU_PER_CM: int = 360000`
  - `SLIDE_W_EMU: int = 12192000`, `SLIDE_H_EMU: int = 6858000`
  - `cm_to_emu(cm: float) -> int`
  - `emu_to_cm(emu: int) -> float`
  - `contain(src_w: int, src_h: int, box_x: int, box_y: int, box_w: int, box_h: int) -> tuple[int, int, int, int]`
    — 반환은 `(x, y, w, h)` EMU. 종횡비를 유지하며 박스에 내접시키고 중앙 정렬한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# tests/test_emu.py
"""EMU 변환과 내접 배치 계산 테스트."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from oox.emu import EMU_PER_CM, cm_to_emu, emu_to_cm, contain


class TestEmu(unittest.TestCase):
    def test_cm_to_emu(self):
        self.assertEqual(cm_to_emu(1), 360000)
        self.assertEqual(cm_to_emu(33.87), 12193200)

    def test_emu_to_cm_roundtrip(self):
        self.assertAlmostEqual(emu_to_cm(cm_to_emu(4.21)), 4.21, places=4)

    def test_contain_height_bound(self):
        """1600x900 캡처를 24.00 x 13.11 cm 박스에 넣으면 높이가 먼저 찬다."""
        box = (cm_to_emu(1.71), cm_to_emu(4.21), cm_to_emu(24.00), cm_to_emu(13.11))
        x, y, w, h = contain(1600, 900, *box)
        self.assertEqual(h, cm_to_emu(13.11))
        # 13.11 * 16/9 = 23.3067 cm
        self.assertAlmostEqual(emu_to_cm(w), 23.3067, places=3)
        # 폭이 남으므로 가로 중앙 정렬
        self.assertEqual(x, box[0] + (box[2] - w) // 2)
        self.assertEqual(y, box[1])

    def test_contain_width_bound(self):
        """세로로 긴 캡처는 폭이 먼저 찬다."""
        box = (0, 0, cm_to_emu(10), cm_to_emu(10))
        x, y, w, h = contain(500, 1000, *box)
        self.assertEqual(w, cm_to_emu(10))
        self.assertEqual(h, cm_to_emu(20))
        self.assertEqual(x, 0)
        self.assertEqual(y, (cm_to_emu(10) - cm_to_emu(20)) // 2)

    def test_contain_never_exceeds_box_on_both_axes(self):
        """4:3 캡처가 박스를 양쪽 모두 넘지는 않는다."""
        box = (0, 0, cm_to_emu(24), cm_to_emu(13.11))
        _, _, w, h = contain(1600, 1200, *box)
        self.assertLessEqual(h, cm_to_emu(13.11))
        self.assertLessEqual(w, cm_to_emu(24))


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest discover -s "C:/it/.claude/skills/writing-user-guide-pptx/tests" -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'oox'`

- [ ] **Step 3: 최소 구현을 쓴다**

`scripts/oox/__init__.py`는 빈 파일로 만든다.

```python
# scripts/oox/emu.py
"""EMU 단위 변환과 이미지 내접 배치 계산.

PowerPoint의 내부 길이 단위는 EMU(English Metric Unit)이며 1 cm = 360000 EMU다.
슬라이드는 12192000 x 6858000 EMU(33.87 x 19.05 cm, 16:9)다.
"""

EMU_PER_CM = 360000
SLIDE_W_EMU = 12192000
SLIDE_H_EMU = 6858000


def cm_to_emu(cm):
    """센티미터를 EMU 정수로 바꾼다. 소수점은 반올림한다."""
    return int(round(cm * EMU_PER_CM))


def emu_to_cm(emu):
    """EMU를 센티미터 실수로 바꾼다."""
    return emu / EMU_PER_CM


def contain(src_w, src_h, box_x, box_y, box_w, box_h):
    """원본 종횡비를 유지한 채 박스에 내접시키고 중앙 정렬한 사각형을 돌려준다.

    잘라내지 않는다. 화면 캡처는 잘리면 정보가 사라지기 때문이다.

    :param src_w: 원본 픽셀 폭
    :param src_h: 원본 픽셀 높이
    :param box_x, box_y, box_w, box_h: 대상 박스 (EMU)
    :return: (x, y, w, h) EMU
    :raises ValueError: 원본 또는 박스 크기가 0 이하일 때
    """
    if src_w <= 0 or src_h <= 0:
        raise ValueError('원본 크기가 0 이하입니다: %sx%s' % (src_w, src_h))
    if box_w <= 0 or box_h <= 0:
        raise ValueError('박스 크기가 0 이하입니다: %sx%s' % (box_w, box_h))

    scale = min(box_w / src_w, box_h / src_h)
    w = int(round(src_w * scale))
    h = int(round(src_h * scale))
    x = box_x + (box_w - w) // 2
    y = box_y + (box_h - h) // 2
    return x, y, w, h
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest discover -s "C:/it/.claude/skills/writing-user-guide-pptx/tests" -v
```
Expected: PASS — 5 tests

`test_contain_width_bound`가 실패하면 `contain`이 박스를 넘어서는 결과를 허용한 것이다.
세로로 긴 원본은 폭에 맞추면 높이가 박스를 넘는 것이 정상이며, 중앙 정렬로 위아래가 대칭으로 삐져나온다.

- [ ] **Step 5: 커밋한다**

```bash
cd C:/it
git add .claude/skills/writing-user-guide-pptx/scripts/oox/__init__.py .claude/skills/writing-user-guide-pptx/scripts/oox/emu.py .claude/skills/writing-user-guide-pptx/tests/__init__.py .claude/skills/writing-user-guide-pptx/tests/test_emu.py
git commit -m "feat(guide-pptx): EMU 변환과 내접 배치 계산 추가"
```

---

### Task 2: pptx 패키지 읽기·쓰기 코어

**Files:**
- Create: `.claude/skills/writing-user-guide-pptx/scripts/oox/package.py`
- Test: `.claude/skills/writing-user-guide-pptx/tests/test_package.py`

**Interfaces:**
- Consumes: 없음
- Produces: `class Package`
  - `Package.open(path: str) -> Package` — zip을 메모리 dict(`파트명 -> bytes`)로 읽는다
  - `pkg.parts: dict[str, bytes]`
  - `pkg.read_xml(part: str) -> Element`
  - `pkg.write_xml(part: str, elem: Element) -> None`
  - `pkg.rels_of(part: str) -> dict[str, tuple[str, str]]` — `{rId: (Type, Target)}`
  - `pkg.set_rels(part: str, rels: dict[str, tuple[str, str]]) -> None`
  - `pkg.add_rel(part: str, rel_type: str, target: str) -> str` — 새 `rId` 문자열 반환
  - `pkg.media_key(data: bytes) -> str` — SHA-1 앞 12자리
  - `pkg.add_media(data: bytes, ext: str) -> str` — `ppt/media/img<hash>.<ext>` 파트명 반환. 같은 내용이면 재사용
  - `pkg.ensure_default_ext(ext: str, content_type: str) -> None`
  - `pkg.prune_orphans() -> list[str]` — 참조되지 않는 `ppt/media/*`·`ppt/slideLayouts/*` 제거, 제거 목록 반환
  - `pkg.save(path: str) -> None`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# tests/test_package.py
"""pptx 패키지 읽기/쓰기 코어 테스트."""
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from oox.package import Package

TEMPLATE_B = r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx'


class TestPackage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pkg = Package.open(TEMPLATE_B)

    def test_reads_all_parts(self):
        self.assertIn('ppt/presentation.xml', self.pkg.parts)
        self.assertIn('[Content_Types].xml', self.pkg.parts)
        slides = [p for p in self.pkg.parts if p.startswith('ppt/slides/slide')]
        self.assertEqual(len([s for s in slides if s.endswith('.xml')]), 363)

    def test_rels_of_slide283(self):
        rels = self.pkg.rels_of('ppt/slides/slide283.xml')
        self.assertEqual(len(rels), 1)
        (rid, (rtype, target)), = rels.items()
        self.assertEqual(rid, 'rId1')
        self.assertTrue(rtype.endswith('/slideLayout'))
        self.assertEqual(target, '../slideLayouts/slideLayout5.xml')

    def test_add_rel_returns_fresh_id(self):
        pkg = Package.open(TEMPLATE_B)
        rid = pkg.add_rel('ppt/slides/slide283.xml',
                          'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
                          '../media/imgdeadbeef0001.png')
        self.assertNotEqual(rid, 'rId1')
        self.assertIn(rid, pkg.rels_of('ppt/slides/slide283.xml'))

    def test_add_media_dedupes_by_content(self):
        pkg = Package.open(TEMPLATE_B)
        a = pkg.add_media(b'\x89PNG\r\n\x1a\n-fake-a', 'png')
        b = pkg.add_media(b'\x89PNG\r\n\x1a\n-fake-a', 'png')
        c = pkg.add_media(b'\x89PNG\r\n\x1a\n-fake-b', 'png')
        self.assertEqual(a, b)
        self.assertNotEqual(a, c)
        self.assertTrue(a.startswith('ppt/media/img'))

    def test_namespace_prefixes_survive_roundtrip(self):
        """ElementTree 재직렬화가 p:/a:/r: 접두어를 보존해야 한다."""
        pkg = Package.open(TEMPLATE_B)
        elem = pkg.read_xml('ppt/slides/slide283.xml')
        pkg.write_xml('ppt/slides/slide283.xml', elem)
        out = pkg.parts['ppt/slides/slide283.xml'].decode('utf-8')
        self.assertIn('<p:sld', out)
        self.assertNotIn('ns0:', out)
        self.assertIn('xmlns:a=', out)

    def test_save_produces_readable_zip(self):
        pkg = Package.open(TEMPLATE_B)
        with tempfile.TemporaryDirectory() as d:
            out = str(Path(d) / 'out.pptx')
            pkg.save(out)
            with zipfile.ZipFile(out) as z:
                self.assertIsNone(z.testzip())
                self.assertIn('ppt/presentation.xml', z.namelist())


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_package -v
```
(작업 디렉터리는 `C:/it/.claude/skills/writing-user-guide-pptx`)

Expected: FAIL — `ModuleNotFoundError: No module named 'oox.package'`

- [ ] **Step 3: 최소 구현을 쓴다**

```python
# scripts/oox/package.py
"""OPC(pptx) 패키지를 메모리에서 다루는 최소 구현.

python-pptx를 쓰지 않는 이유는 두 가지다. 슬라이드 복제를 지원하지 않고,
폐쇄망 PC에서 추가 설치 없이 돌아가야 하기 때문이다.
"""
import hashlib
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile

NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'ct': 'http://schemas.openxmlformats.org/package/2006/content-types',
    'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
}

# ElementTree는 등록되지 않은 네임스페이스에 ns0: 같은 접두어를 붙인다.
# PowerPoint는 접두어가 바뀐 파일을 열지 못하므로 모듈 임포트 시점에 고정한다.
for _prefix, _uri in NS.items():
    if _prefix not in ('ct', 'pr'):
        ET.register_namespace(_prefix, _uri)
ET.register_namespace('', NS['pr'])  # .rels 기본 네임스페이스

REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
REL_SLIDE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'
REL_LAYOUT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout'
REL_MASTER = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster'

CONTENT_TYPES = {
    'png': 'image/png',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'gif': 'image/gif',
    'wdp': 'image/vnd.ms-photo',
}


def _rels_part(part):
    """파트 경로에 대응하는 .rels 파트 경로를 돌려준다."""
    d, name = posixpath.split(part)
    return posixpath.join(d, '_rels', name + '.rels')


class Package:
    """pptx zip 전체를 메모리에 올려 파트 단위로 조작한다."""

    def __init__(self, parts):
        self.parts = parts

    @classmethod
    def open(cls, path):
        """pptx 파일을 읽어 Package를 만든다."""
        with zipfile.ZipFile(path) as z:
            parts = {n: z.read(n) for n in z.namelist() if not n.endswith('/')}
        return cls(parts)

    def read_xml(self, part):
        """XML 파트를 Element로 파싱한다."""
        return ET.fromstring(self.parts[part])

    def write_xml(self, part, elem):
        """Element를 XML 선언과 함께 직렬화해 파트에 되쓴다."""
        body = ET.tostring(elem, encoding='utf-8', xml_declaration=True)
        self.parts[part] = body

    def rels_of(self, part):
        """파트의 관계 목록을 {rId: (Type, Target)}로 돌려준다. 없으면 빈 dict."""
        rp = _rels_part(part)
        if rp not in self.parts:
            return {}
        root = self.read_xml(rp)
        out = {}
        for rel in root:
            out[rel.get('Id')] = (rel.get('Type'), rel.get('Target'))
        return out

    def set_rels(self, part, rels):
        """관계 목록을 통째로 되쓴다."""
        root = ET.Element('{%s}Relationships' % NS['pr'])
        for rid, (rtype, target) in rels.items():
            ET.SubElement(root, '{%s}Relationship' % NS['pr'],
                          {'Id': rid, 'Type': rtype, 'Target': target})
        self.write_xml(_rels_part(part), root)

    def add_rel(self, part, rel_type, target):
        """새 관계를 추가하고 발급된 rId를 돌려준다.

        같은 (Type, Target) 조합이 이미 있으면 그 rId를 재사용한다.
        """
        rels = self.rels_of(part)
        for rid, existing in rels.items():
            if existing == (rel_type, target):
                return rid
        used = {int(m.group(1)) for rid in rels
                for m in [re.match(r'rId(\d+)$', rid)] if m}
        rid = 'rId%d' % (max(used) + 1 if used else 1)
        rels[rid] = (rel_type, target)
        self.set_rels(part, rels)
        return rid

    def media_key(self, data):
        """미디어 내용의 SHA-1 앞 12자리를 돌려준다."""
        return hashlib.sha1(data).hexdigest()[:12]

    def add_media(self, data, ext):
        """미디어를 내용 해시 이름으로 추가하고 파트 경로를 돌려준다.

        이름이 아니라 내용으로 식별하는 이유는, 템플릿 A와 B에 같은 이름이면서
        내용이 다른 미디어가 417개 있어 이름 기반 병합이 이미지를 조용히 바꾸기 때문이다.
        """
        ext = ext.lower().lstrip('.')
        part = 'ppt/media/img%s.%s' % (self.media_key(data), ext)
        if part not in self.parts:
            self.parts[part] = data
            self.ensure_default_ext(ext, CONTENT_TYPES.get(ext, 'application/octet-stream'))
        return part

    def ensure_default_ext(self, ext, content_type):
        """[Content_Types].xml에 확장자 Default 항목이 없으면 추가한다."""
        root = self.read_xml('[Content_Types].xml')
        tag = '{%s}Default' % NS['ct']
        for d in root.findall(tag):
            if d.get('Extension', '').lower() == ext:
                return
        ET.SubElement(root, tag, {'Extension': ext, 'ContentType': content_type})
        self.write_xml('[Content_Types].xml', root)

    def _referenced_targets(self):
        """모든 .rels가 가리키는 파트 경로 집합을 돌려준다."""
        refs = set()
        for name in list(self.parts):
            if not name.endswith('.rels'):
                continue
            base = posixpath.dirname(posixpath.dirname(name))
            for _rtype, target in self.rels_of(
                    posixpath.join(base, posixpath.basename(name)[:-len('.rels')])).values():
                if target.startswith(('http://', 'https://')):
                    continue
                refs.add(posixpath.normpath(posixpath.join(base, target)).replace('\\', '/'))
        return refs

    def prune_orphans(self):
        """참조되지 않는 미디어와 레이아웃을 제거하고 제거 목록을 돌려준다."""
        removed = []
        # 레이아웃 -> 미디어 순으로 두 번 돌린다. 레이아웃이 빠지면 그 미디어도 고아가 된다.
        for _ in range(2):
            refs = self._referenced_targets()
            for name in list(self.parts):
                if not name.startswith(('ppt/media/', 'ppt/slideLayouts/slideLayout')):
                    continue
                if name.endswith('.rels'):
                    continue
                if name in refs:
                    continue
                del self.parts[name]
                rp = _rels_part(name)
                self.parts.pop(rp, None)
                removed.append(name)
        return removed

    def save(self, path):
        """파트를 이름순으로 정렬해 zip으로 저장한다. 정렬은 빌드 재현성을 위해서다."""
        with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
            for name in sorted(self.parts):
                z.writestr(name, self.parts[name])
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_package -v
```
Expected: PASS — 6 tests

`test_namespace_prefixes_survive_roundtrip`이 실패하면 `register_namespace` 호출이 임포트 시점에 실행되지 않은 것이다.
템플릿 B는 172MB지만 전부 메모리에 올려도 300MB 미만이라 문제되지 않는다.
테스트가 20초 이상 걸리면 `setUpClass`에서 한 번만 열도록 되어 있는지 확인한다.

- [ ] **Step 5: 커밋한다**

```bash
cd C:/it
git add .claude/skills/writing-user-guide-pptx/scripts/oox/package.py .claude/skills/writing-user-guide-pptx/tests/test_package.py
git commit -m "feat(guide-pptx): OPC 패키지 읽기·쓰기 코어 추가"
```

---

### Task 3: 문단 단위 텍스트 치환

**Files:**
- Create: `.claude/skills/writing-user-guide-pptx/scripts/oox/text.py`
- Test: `.claude/skills/writing-user-guide-pptx/tests/test_text.py`

**Interfaces:**
- Consumes: `oox.package.NS`
- Produces:
  - `paragraph_text(para: Element) -> str` — `<a:p>` 안 모든 `<a:t>`를 이어 붙인다
  - `iter_paragraphs(root: Element) -> Iterator[Element]` — 모든 `<a:p>`를 순회
  - `replace_text(root: Element, mapping: dict[str, str]) -> dict[str, int]`
    — 매핑을 적용하고 `{키: 적용횟수}`를 돌려준다. 키 `"문구#2"`는 그 문구의 2번째 출현만 바꾼다

**핵심 규칙:** 한 문단이 여러 `<a:t>` 런으로 쪼개져 있을 수 있다.
`SCREEN_BASE_SLIDE`의 대제목이 실제로 `대제목` + ` 내용 입력` 두 런이다.
따라서 **문단 텍스트를 합쳐서 비교하고, 치환값은 첫 런에 몰아넣고 나머지 런의 텍스트를 빈 문자열로 만든다.**
런을 삭제하지 않는 이유는 서식(`<a:rPr>`)이 첫 런에만 남으면 되고, 요소를 지우면 문단 속성이 깨질 수 있기 때문이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# tests/test_text.py
"""문단 단위 텍스트 치환 테스트."""
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from oox.package import NS, Package
from oox.text import paragraph_text, replace_text

A = NS['a']

TEMPLATE_B = r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx'


def make_paragraph(*runs):
    """런 여러 개로 이루어진 <a:p>를 만든다."""
    p = ET.Element('{%s}p' % A)
    for txt in runs:
        r = ET.SubElement(p, '{%s}r' % A)
        ET.SubElement(r, '{%s}rPr' % A, {'lang': 'ko-KR'})
        t = ET.SubElement(r, '{%s}t' % A)
        t.text = txt
    return p


class TestText(unittest.TestCase):
    def test_paragraph_text_joins_runs(self):
        p = make_paragraph('대제목', ' 내용 입력')
        self.assertEqual(paragraph_text(p), '대제목 내용 입력')

    def test_replace_split_paragraph(self):
        """쪼개진 런을 하나로 합쳐 치환한다."""
        root = ET.Element('root')
        root.append(make_paragraph('대제목', ' 내용 입력'))
        counts = replace_text(root, {'대제목 내용 입력': '예산 작성'})
        self.assertEqual(counts, {'대제목 내용 입력': 1})
        para = root[0]
        self.assertEqual(paragraph_text(para), '예산 작성')
        texts = [t.text for t in para.iter('{%s}t' % A)]
        self.assertEqual(texts, ['예산 작성', ''])

    def test_replace_nth_occurrence(self):
        root = ET.Element('root')
        root.append(make_paragraph('내용입력'))
        root.append(make_paragraph('내용입력'))
        root.append(make_paragraph('내용입력'))
        counts = replace_text(root, {'내용입력#2': '두 번째'})
        self.assertEqual(counts, {'내용입력#2': 1})
        self.assertEqual([paragraph_text(p) for p in root],
                         ['내용입력', '두 번째', '내용입력'])

    def test_replace_all_occurrences_without_index(self):
        root = ET.Element('root')
        root.append(make_paragraph('내용입력'))
        root.append(make_paragraph('내용입력'))
        counts = replace_text(root, {'내용입력': '채움'})
        self.assertEqual(counts, {'내용입력': 2})

    def test_missing_key_reports_zero(self):
        """없는 키는 0으로 보고한다. 호출자가 실패로 처리한다."""
        root = ET.Element('root')
        root.append(make_paragraph('내용입력'))
        counts = replace_text(root, {'없는문구': 'x'})
        self.assertEqual(counts, {'없는문구': 0})

    def test_real_slide283_title(self):
        """실제 SCREEN_BASE_SLIDE의 대제목이 두 런으로 쪼개져 있음을 확인한다."""
        pkg = Package.open(TEMPLATE_B)
        root = pkg.read_xml('ppt/slides/slide283.xml')
        counts = replace_text(root, {
            '대제목 내용 입력': '예산 작성',
            '주제 및 부가적인 내용 입력': '작성할 예산 유형을 고릅니다',
        })
        self.assertEqual(counts['대제목 내용 입력'], 1)
        self.assertEqual(counts['주제 및 부가적인 내용 입력'], 1)


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_text -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'oox.text'`

- [ ] **Step 3: 최소 구현을 쓴다**

```python
# scripts/oox/text.py
"""문단 단위 텍스트 치환.

한 문단이 여러 <a:t> 런으로 쪼개져 있는 경우가 흔하다. 템플릿 B의 대제목은
'대제목' + ' 내용 입력' 두 런이다. 런 단위로 비교하면 이런 문구는 절대 매칭되지 않으므로,
문단 텍스트를 합쳐 비교하고 치환값은 첫 런에 몰아넣는다.
"""
import re

from oox.package import NS

A = NS['a']
_T = '{%s}t' % A
_P = '{%s}p' % A

_INDEX_RE = re.compile(r'^(?P<text>.*)#(?P<n>\d+)$', re.S)


def paragraph_text(para):
    """문단 안 모든 런의 텍스트를 이어 붙인다."""
    return ''.join(t.text or '' for t in para.iter(_T))


def iter_paragraphs(root):
    """트리 안 모든 <a:p>를 문서 순서대로 순회한다."""
    return root.iter(_P)


def _set_paragraph_text(para, value):
    """문단의 첫 런에 값을 넣고 나머지 런의 텍스트를 비운다."""
    runs = list(para.iter(_T))
    if not runs:
        return False
    runs[0].text = value
    for t in runs[1:]:
        t.text = ''
    return True


def replace_text(root, mapping):
    """매핑을 적용하고 {키: 적용횟수}를 돌려준다.

    키가 '문구#N' 형태면 그 문구의 N번째 출현만 바꾼다(1-based).
    색인이 없으면 모든 출현을 바꾼다.

    :param root: 슬라이드 루트 Element
    :param mapping: {찾을 문구 또는 '문구#N': 넣을 문구}
    :return: {키: 실제 적용된 횟수}. 0이면 호출자가 실패로 처리한다.
    """
    counts = {key: 0 for key in mapping}
    # 문구별 출현 순번을 세기 위해 문단을 한 번만 훑는다.
    seen = {}
    paragraphs = list(iter_paragraphs(root))
    for para in paragraphs:
        current = paragraph_text(para)
        if not current:
            continue
        seen[current] = seen.get(current, 0) + 1
        nth = seen[current]
        for key, value in mapping.items():
            m = _INDEX_RE.match(key)
            if m:
                want_text, want_n = m.group('text'), int(m.group('n'))
                if current == want_text and nth == want_n:
                    if _set_paragraph_text(para, value):
                        counts[key] += 1
                    break
            elif current == key:
                if _set_paragraph_text(para, value):
                    counts[key] += 1
                break
    return counts
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_text -v
```
Expected: PASS — 6 tests

`test_replace_split_paragraph`가 `['예산 작성', ' 내용 입력']`을 내면 나머지 런 비우기가 빠진 것이다.
`test_real_slide283_title`이 0을 내면 실제 런 분할이 예상과 다른 것이므로,
아래로 실제 문단 텍스트를 찍어 확인한다.

```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -c "import sys; sys.path.insert(0,'scripts'); from oox.package import Package; from oox.text import iter_paragraphs, paragraph_text; r=Package.open(r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx').read_xml('ppt/slides/slide283.xml'); print([paragraph_text(p) for p in iter_paragraphs(r)][:6])"
```

- [ ] **Step 5: 커밋한다**

```bash
cd C:/it
git add .claude/skills/writing-user-guide-pptx/scripts/oox/text.py .claude/skills/writing-user-guide-pptx/tests/test_text.py
git commit -m "feat(guide-pptx): 문단 단위 텍스트 치환 추가"
```

---

### Task 4: 도형 XML 생성기

**Files:**
- Create: `.claude/skills/writing-user-guide-pptx/scripts/oox/shapes.py`
- Test: `.claude/skills/writing-user-guide-pptx/tests/test_shapes.py`

**Interfaces:**
- Consumes: `oox.package.NS`, `oox.emu`
- Produces:
  - `next_shape_id(sp_tree: Element) -> int` — 트리 안 최대 `<p:cNvPr id>` + 1
  - `make_pic(shape_id: int, name: str, rid: str, x: int, y: int, w: int, h: int) -> Element`
  - `make_textbox(shape_id: int, name: str, x: int, y: int, w: int, h: int, paragraphs: list[str], size_pt: int = 12) -> Element`
  - `make_badge(shape_id: int, name: str, x: int, y: int, d: int, label: str, fill_hex: str = 'FF7575') -> Element`
    — 지름 `d` EMU의 원형 도형에 흰 글씨

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# tests/test_shapes.py
"""도형 XML 생성기 테스트."""
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from oox.emu import cm_to_emu
from oox.package import NS
from oox.shapes import make_badge, make_pic, make_textbox, next_shape_id
from oox.text import paragraph_text

A, P = NS['a'], NS['p']


class TestShapes(unittest.TestCase):
    def test_next_shape_id(self):
        tree = ET.fromstring(
            '<p:spTree xmlns:p="%s" xmlns:a="%s">'
            '<p:sp><p:nvSpPr><p:cNvPr id="7" name="a"/></p:nvSpPr></p:sp>'
            '<p:sp><p:nvSpPr><p:cNvPr id="12" name="b"/></p:nvSpPr></p:sp>'
            '</p:spTree>' % (P, A))
        self.assertEqual(next_shape_id(tree), 13)

    def test_next_shape_id_empty_tree(self):
        tree = ET.fromstring('<p:spTree xmlns:p="%s"/>' % P)
        self.assertEqual(next_shape_id(tree), 2)

    def test_make_pic_structure(self):
        pic = make_pic(10, '화면 캡처', 'rId9',
                       cm_to_emu(1.71), cm_to_emu(4.21), cm_to_emu(23.31), cm_to_emu(13.11))
        self.assertEqual(pic.tag, '{%s}pic' % P)
        blip = pic.find('.//{%s}blip' % A)
        self.assertEqual(blip.get('{%s}embed' % NS['r']), 'rId9')
        off = pic.find('.//{%s}off' % A)
        self.assertEqual(off.get('x'), str(cm_to_emu(1.71)))
        ext = pic.find('.//{%s}ext' % A)
        self.assertEqual(ext.get('cy'), str(cm_to_emu(13.11)))

    def test_make_textbox_paragraphs(self):
        box = make_textbox(11, '단계 설명', 0, 0, cm_to_emu(5), cm_to_emu(10),
                           ['1. 첫째', '2. 둘째'])
        paras = box.findall('.//{%s}p' % A)
        self.assertEqual([paragraph_text(p) for p in paras], ['1. 첫째', '2. 둘째'])

    def test_make_textbox_sets_no_font(self):
        """글꼴을 지정하지 않아야 테마 글꼴을 상속한다."""
        box = make_textbox(11, 'x', 0, 0, 100, 100, ['가나다'])
        self.assertIsNone(box.find('.//{%s}latin' % A))

    def test_make_badge_is_circle_with_label(self):
        badge = make_badge(20, '말풍선 1', cm_to_emu(4.2), cm_to_emu(7.1), cm_to_emu(0.8), '1')
        geom = badge.find('.//{%s}prstGeom' % A)
        self.assertEqual(geom.get('prst'), 'ellipse')
        ext = badge.find('.//{%s}ext' % A)
        self.assertEqual(ext.get('cx'), ext.get('cy'))
        self.assertEqual(paragraph_text(badge.find('.//{%s}p' % A)), '1')

    def test_make_badge_uses_accent4_fill(self):
        badge = make_badge(20, 'x', 0, 0, 100, '1')
        srgb = badge.find('.//{%s}solidFill/{%s}srgbClr' % (A, A))
        self.assertEqual(srgb.get('val'), 'FF7575')


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_shapes -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'oox.shapes'`

- [ ] **Step 3: 최소 구현을 쓴다**

```python
# scripts/oox/shapes.py
"""슬라이드에 새로 얹을 도형의 XML을 만든다.

글꼴은 어디에서도 지정하지 않는다. 마스터의 테마 글꼴(KDB고딕M_Pro)을 상속시키는 편이
템플릿과 어긋날 여지가 적기 때문이다.
"""
import xml.etree.ElementTree as ET

from oox.package import NS

A, P, R = NS['a'], NS['p'], NS['r']


def _q(ns, tag):
    return '{%s}%s' % (ns, tag)


def next_shape_id(sp_tree):
    """트리 안에서 쓰이지 않은 가장 작은 도형 id를 돌려준다.

    id 1은 <p:spTree> 자신의 nvGrpSpPr가 쓰므로 최소값은 2다.
    """
    ids = [int(e.get('id')) for e in sp_tree.iter(_q(P, 'cNvPr'))
           if (e.get('id') or '').isdigit()]
    return max(ids) + 1 if ids else 2


def _xfrm(parent, x, y, w, h):
    """<a:xfrm>에 위치와 크기를 넣는다."""
    xf = ET.SubElement(parent, _q(A, 'xfrm'))
    ET.SubElement(xf, _q(A, 'off'), {'x': str(x), 'y': str(y)})
    ET.SubElement(xf, _q(A, 'ext'), {'cx': str(w), 'cy': str(h)})
    return xf


def _paragraph(tx_body, text, size_pt, color_hex=None, align=None, bold=False):
    """텍스트 본문에 문단 하나를 붙인다."""
    p = ET.SubElement(tx_body, _q(A, 'p'))
    if align:
        ET.SubElement(p, _q(A, 'pPr'), {'algn': align})
    r = ET.SubElement(p, _q(A, 'r'))
    rpr_attrs = {'lang': 'ko-KR', 'altLang': 'en-US', 'sz': str(int(size_pt * 100)),
                 'dirty': '0'}
    if bold:
        rpr_attrs['b'] = '1'
    rpr = ET.SubElement(r, _q(A, 'rPr'), rpr_attrs)
    if color_hex:
        fill = ET.SubElement(rpr, _q(A, 'solidFill'))
        ET.SubElement(fill, _q(A, 'srgbClr'), {'val': color_hex})
    t = ET.SubElement(r, _q(A, 't'))
    t.text = text
    return p


def make_pic(shape_id, name, rid, x, y, w, h):
    """이미지를 지정 사각형에 놓는 <p:pic>을 만든다."""
    pic = ET.Element(_q(P, 'pic'))
    nv = ET.SubElement(pic, _q(P, 'nvPicPr'))
    ET.SubElement(nv, _q(P, 'cNvPr'), {'id': str(shape_id), 'name': name})
    cnv = ET.SubElement(nv, _q(P, 'cNvPicPr'))
    ET.SubElement(cnv, _q(A, 'picLocks'), {'noChangeAspect': '1'})
    ET.SubElement(nv, _q(P, 'nvPr'))

    blip_fill = ET.SubElement(pic, _q(P, 'blipFill'))
    ET.SubElement(blip_fill, _q(A, 'blip'), {_q(R, 'embed'): rid})
    stretch = ET.SubElement(blip_fill, _q(A, 'stretch'))
    ET.SubElement(stretch, _q(A, 'fillRect'))

    sp_pr = ET.SubElement(pic, _q(P, 'spPr'))
    _xfrm(sp_pr, x, y, w, h)
    geom = ET.SubElement(sp_pr, _q(A, 'prstGeom'), {'prst': 'rect'})
    ET.SubElement(geom, _q(A, 'avLst'))
    return pic


def make_textbox(shape_id, name, x, y, w, h, paragraphs, size_pt=12):
    """문단 목록을 담은 텍스트 상자를 만든다."""
    sp = ET.Element(_q(P, 'sp'))
    nv = ET.SubElement(sp, _q(P, 'nvSpPr'))
    ET.SubElement(nv, _q(P, 'cNvPr'), {'id': str(shape_id), 'name': name})
    cnv = ET.SubElement(nv, _q(P, 'cNvSpPr'), {'txBox': '1'})
    ET.SubElement(cnv, _q(A, 'spLocks'), {'noGrp': '1'})
    ET.SubElement(nv, _q(P, 'nvPr'))

    sp_pr = ET.SubElement(sp, _q(P, 'spPr'))
    _xfrm(sp_pr, x, y, w, h)
    geom = ET.SubElement(sp_pr, _q(A, 'prstGeom'), {'prst': 'rect'})
    ET.SubElement(geom, _q(A, 'avLst'))
    ET.SubElement(sp_pr, _q(A, 'noFill'))

    tx = ET.SubElement(sp, _q(P, 'txBody'))
    ET.SubElement(tx, _q(A, 'bodyPr'), {'wrap': 'square', 'anchor': 't'})
    ET.SubElement(tx, _q(A, 'lstStyle'))
    for line in paragraphs:
        _paragraph(tx, line, size_pt)
    return sp


def make_badge(shape_id, name, x, y, d, label, fill_hex='FF7575'):
    """캡처 위에 얹을 원형 번호 배지를 만든다.

    기본 채움색은 테마 accent4(#FF7575)다. 캡처 위에서 눈에 띄어야 하기 때문이다.
    """
    sp = ET.Element(_q(P, 'sp'))
    nv = ET.SubElement(sp, _q(P, 'nvSpPr'))
    ET.SubElement(nv, _q(P, 'cNvPr'), {'id': str(shape_id), 'name': name})
    ET.SubElement(nv, _q(P, 'cNvSpPr'))
    ET.SubElement(nv, _q(P, 'nvPr'))

    sp_pr = ET.SubElement(sp, _q(P, 'spPr'))
    _xfrm(sp_pr, x, y, d, d)
    geom = ET.SubElement(sp_pr, _q(A, 'prstGeom'), {'prst': 'ellipse'})
    ET.SubElement(geom, _q(A, 'avLst'))
    fill = ET.SubElement(sp_pr, _q(A, 'solidFill'))
    ET.SubElement(fill, _q(A, 'srgbClr'), {'val': fill_hex})

    tx = ET.SubElement(sp, _q(P, 'txBody'))
    ET.SubElement(tx, _q(A, 'bodyPr'), {'anchor': 'ctr'})
    ET.SubElement(tx, _q(A, 'lstStyle'))
    _paragraph(tx, label, 11, color_hex='FFFFFF', align='ctr', bold=True)
    return sp
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_shapes -v
```
Expected: PASS — 7 tests

- [ ] **Step 5: 커밋한다**

```bash
cd C:/it
git add .claude/skills/writing-user-guide-pptx/scripts/oox/shapes.py .claude/skills/writing-user-guide-pptx/tests/test_shapes.py
git commit -m "feat(guide-pptx): 도형 XML 생성기 추가"
```

---

### Task 5: 슬라이드 복제·이식·도형 열거

**Files:**
- Create: `.claude/skills/writing-user-guide-pptx/scripts/oox/slides.py`
- Test: `.claude/skills/writing-user-guide-pptx/tests/test_slides.py`

**Interfaces:**
- Consumes: `oox.package.Package`, `oox.emu`
- Produces:
  - `sp_tree(slide_root: Element) -> Element`
  - `top_level_shapes(slide_root: Element) -> list[Element]` — `<p:spTree>`의 직계 도형 자식만
  - `shape_bbox(shape: Element) -> tuple[int, int, int, int] | None` — 직계 `<a:xfrm>` 기준. 없으면 `None`
  - `clone_slide(dst: Package, src: Package, src_slide_no: int) -> str`
    — 슬라이드 하나를 `dst`에 새 파트로 복제하고 새 파트명(`ppt/slides/slideN.xml`)을 돌려준다.
      `src is dst`면 같은 패키지 안 복제, 아니면 이식이다. 이식일 때 레이아웃을 append하고
      미디어를 내용 해시로 재명명한다.
  - `set_slide_order(pkg: Package, slide_parts: list[str]) -> None`
    — `presentation.xml`의 `<p:sldIdLst>`와 `presentation.xml.rels`를 목록 순서대로 재작성한다.
      목록에 없는 슬라이드 파트는 패키지에서 제거한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# tests/test_slides.py
"""슬라이드 복제·이식 테스트."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from oox.emu import emu_to_cm
from oox.package import NS, Package
from oox.slides import (clone_slide, set_slide_order, shape_bbox,
                        sp_tree, top_level_shapes)

TEMPLATE_A = r'C:\it\sample\템플릿 1번 A(문서작업용).pptx'
TEMPLATE_B = r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx'


class TestSlides(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src_b = Package.open(TEMPLATE_B)

    def test_top_level_shapes_of_base_slide(self):
        """SCREEN_BASE_SLIDE는 최상위 도형이 정확히 3개다."""
        root = self.src_b.read_xml('ppt/slides/slide283.xml')
        shapes = top_level_shapes(root)
        self.assertEqual(len(shapes), 3)

    def test_header_rule_keeps_exactly_two(self):
        """bbox 하단 4.0cm 이하 규칙이 헤더 2개만 남긴다."""
        root = self.src_b.read_xml('ppt/slides/slide283.xml')
        kept = [s for s in top_level_shapes(root)
                if shape_bbox(s) and emu_to_cm(shape_bbox(s)[1] + shape_bbox(s)[3]) <= 4.0]
        self.assertEqual(len(kept), 2)

    def test_clone_within_same_package(self):
        pkg = Package.open(TEMPLATE_B)
        before = len([p for p in pkg.parts if p.startswith('ppt/slides/slide')
                      and p.endswith('.xml')])
        part = clone_slide(pkg, pkg, 283)
        self.assertTrue(part.startswith('ppt/slides/slide'))
        self.assertIn(part, pkg.parts)
        after = len([p for p in pkg.parts if p.startswith('ppt/slides/slide')
                     and p.endswith('.xml')])
        self.assertEqual(after, before + 1)
        # 레이아웃 관계가 살아 있어야 한다
        rels = pkg.rels_of(part)
        self.assertTrue(any(t.endswith('slideLayout5.xml') for _, t in rels.values()))

    def test_import_from_a_renames_media_by_content(self):
        """A에서 이식한 슬라이드의 이미지가 내용 해시 이름으로 들어간다."""
        dst = Package.open(TEMPLATE_B)
        src_a = Package.open(TEMPLATE_A)
        part = clone_slide(dst, src_a, 9)  # A slide9는 이미지 2개를 참조한다
        rels = dst.rels_of(part)
        images = [t for ty, t in rels.values() if ty.endswith('/image')]
        self.assertGreater(len(images), 0)
        for target in images:
            self.assertIn('/media/img', target)
            media_part = 'ppt/media/' + target.rsplit('/', 1)[-1]
            self.assertIn(media_part, dst.parts)
            expected = dst.media_key(dst.parts[media_part])
            self.assertIn(expected, media_part)

    def test_import_appends_layout_without_reusing_b_layout(self):
        """A의 레이아웃은 B의 같은 번호 레이아웃을 재사용하지 않고 새로 붙는다."""
        dst = Package.open(TEMPLATE_B)
        src_a = Package.open(TEMPLATE_A)
        layouts_before = {p for p in dst.parts
                          if p.startswith('ppt/slideLayouts/slideLayout')
                          and p.endswith('.xml')}
        part = clone_slide(dst, src_a, 9)
        layouts_after = {p for p in dst.parts
                         if p.startswith('ppt/slideLayouts/slideLayout')
                         and p.endswith('.xml')}
        self.assertEqual(len(layouts_after), len(layouts_before) + 1)
        new_layout = (layouts_after - layouts_before).pop()
        rels = dst.rels_of(part)
        self.assertTrue(any(t.endswith(new_layout.rsplit('/', 1)[-1])
                            for _, t in rels.values()))
        # 새 레이아웃은 B의 마스터를 가리켜야 한다
        lrels = dst.rels_of(new_layout)
        self.assertTrue(any(t.endswith('slideMaster1.xml') for _, t in lrels.values()))

    def test_set_slide_order_drops_unlisted(self):
        pkg = Package.open(TEMPLATE_B)
        keep = ['ppt/slides/slide1.xml', 'ppt/slides/slide283.xml']
        set_slide_order(pkg, keep)
        remaining = sorted(p for p in pkg.parts
                           if p.startswith('ppt/slides/slide') and p.endswith('.xml'))
        self.assertEqual(remaining, sorted(keep))
        pres = pkg.read_xml('ppt/presentation.xml')
        ids = pres.find('{%s}sldIdLst' % NS['p'])
        self.assertEqual(len(list(ids)), 2)


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_slides -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'oox.slides'`

- [ ] **Step 3: 최소 구현을 쓴다**

```python
# scripts/oox/slides.py
"""슬라이드 복제와 템플릿 간 이식.

이식할 때 레이아웃은 항상 새로 붙인다. 템플릿 A와 B의 slideLayout1~24는 이름이 비슷해도
바이트가 전부 다르고, 이름 순서마저 어긋나 있어(A의 스타일7/8/9 = B의 스타일8/9/7)
번호나 이름으로 동일시하면 디자인이 뒤바뀐다.

미디어는 내용 SHA-1로 재명명한다. 두 템플릿에 이름이 같으면서 내용이 다른 미디어가
417개 있어 이름 기준 병합은 이미지를 조용히 바꿔치기한다.
"""
import posixpath
import re
import xml.etree.ElementTree as ET

from oox.package import (NS, REL_IMAGE, REL_LAYOUT, REL_MASTER, REL_SLIDE)

A, P, R = NS['a'], NS['p'], NS['r']

_SHAPE_TAGS = {'{%s}sp' % P, '{%s}pic' % P, '{%s}grpSp' % P,
               '{%s}graphicFrame' % P, '{%s}cxnSp' % P}


def sp_tree(slide_root):
    """슬라이드의 <p:spTree>를 돌려준다."""
    return slide_root.find('./{%s}cSld/{%s}spTree' % (P, P))


def top_level_shapes(slide_root):
    """<p:spTree>의 직계 도형 자식만 문서 순서대로 돌려준다."""
    return [c for c in sp_tree(slide_root) if c.tag in _SHAPE_TAGS]


def shape_bbox(shape):
    """도형 직계의 <a:xfrm>에서 (x, y, w, h) EMU를 뽑는다. 없으면 None.

    도형 종류마다 xfrm을 감싸는 부모가 다르다.
      <p:sp>/<p:pic>       -> <p:spPr><a:xfrm>
      <p:grpSp>            -> <p:grpSpPr><a:xfrm>
      <p:graphicFrame>     -> <p:xfrm>  (a: 가 아니라 p: 네임스페이스다)

    자리표시자 도형은 xfrm 없이 레이아웃에서 위치를 상속받으므로 None이 나온다.
    """
    xf = None
    for path in ('./{%s}spPr/{%s}xfrm' % (P, A),
                 './{%s}grpSpPr/{%s}xfrm' % (P, A),
                 './{%s}xfrm' % P):
        xf = shape.find(path)
        if xf is not None:
            break
    if xf is None:
        return None
    off, ext = xf.find('{%s}off' % A), xf.find('{%s}ext' % A)
    if off is None or ext is None:
        return None
    return (int(off.get('x')), int(off.get('y')),
            int(ext.get('cx')), int(ext.get('cy')))


def _next_free(pkg, prefix, suffix):
    """ppt/slides/slideN.xml 같은 이름에서 비어 있는 가장 작은 N을 찾는다."""
    used = set()
    pat = re.compile(re.escape(prefix) + r'(\d+)' + re.escape(suffix) + '$')
    for name in pkg.parts:
        m = pat.match(name)
        if m:
            used.add(int(m.group(1)))
    n = 1
    while n in used:
        n += 1
    return '%s%d%s' % (prefix, n, suffix)


def _copy_media_rels(dst, src, src_part, dst_part):
    """src_part의 관계를 dst_part로 옮긴다. 이미지는 내용 해시로 재명명한다.

    레이아웃 관계는 호출자가 따로 건다.
    """
    new_rels = {}
    for rid, (rtype, target) in src.rels_of(src_part).items():
        if rtype == REL_IMAGE:
            src_media = posixpath.normpath(
                posixpath.join(posixpath.dirname(src_part), target)).replace('\\', '/')
            data = src.parts[src_media]
            ext = src_media.rsplit('.', 1)[-1]
            new_media = dst.add_media(data, ext)
            new_rels[rid] = (rtype, '../media/' + posixpath.basename(new_media))
        elif rtype in (REL_LAYOUT, REL_SLIDE, REL_MASTER):
            continue  # 호출자가 다시 건다
        else:
            new_rels[rid] = (rtype, target)
    dst.set_rels(dst_part, new_rels)
    return new_rels


def _import_layout(dst, src, src_layout_part):
    """레이아웃을 dst에 새 번호로 붙이고 새 파트명을 돌려준다."""
    dst_layout = _next_free(dst, 'ppt/slideLayouts/slideLayout', '.xml')
    dst.parts[dst_layout] = src.parts[src_layout_part]
    rels = _copy_media_rels(dst, src, src_layout_part, dst_layout)
    # 레이아웃은 반드시 마스터를 가리켜야 한다. 목적지 패키지의 마스터로 다시 건다.
    rels = dict(rels)
    used = {int(m.group(1)) for rid in rels
            for m in [re.match(r'rId(\d+)$', rid)] if m}
    rels['rId%d' % (max(used) + 1 if used else 1)] = (
        REL_MASTER, '../slideMasters/slideMaster1.xml')
    dst.set_rels(dst_layout, rels)

    # 마스터의 sldLayoutIdLst에도 등록해야 PowerPoint가 레이아웃을 인식한다.
    master = 'ppt/slideMasters/slideMaster1.xml'
    rid = dst.add_rel(master, REL_LAYOUT,
                      '../slideLayouts/' + posixpath.basename(dst_layout))
    root = dst.read_xml(master)
    lst = root.find('{%s}sldLayoutIdLst' % P)
    if lst is None:
        lst = ET.SubElement(root, '{%s}sldLayoutIdLst' % P)
    existing = [int(e.get('id')) for e in lst if (e.get('id') or '').isdigit()]
    new_id = max(existing) + 1 if existing else 2147483649
    ET.SubElement(lst, '{%s}sldLayoutId' % P,
                  {'id': str(new_id), '{%s}id' % R: rid})
    dst.write_xml(master, root)
    return dst_layout


def clone_slide(dst, src, src_slide_no):
    """슬라이드 하나를 dst에 복제하고 새 파트명을 돌려준다.

    src is dst면 같은 패키지 안 복제, 아니면 이식이다.

    :raises KeyError: 원본 슬라이드가 없을 때
    """
    src_part = 'ppt/slides/slide%d.xml' % src_slide_no
    if src_part not in src.parts:
        raise KeyError('원본 슬라이드가 없습니다: %s' % src_part)

    dst_part = _next_free(dst, 'ppt/slides/slide', '.xml')
    dst.parts[dst_part] = src.parts[src_part]
    _copy_media_rels(dst, src, src_part, dst_part)

    # 레이아웃 연결
    src_layout = None
    for rtype, target in src.rels_of(src_part).values():
        if rtype == REL_LAYOUT:
            src_layout = posixpath.normpath(
                posixpath.join(posixpath.dirname(src_part), target)).replace('\\', '/')
            break
    if src_layout is None:
        raise ValueError('슬라이드에 레이아웃 관계가 없습니다: %s' % src_part)

    if src is dst:
        dst_layout = src_layout  # 같은 패키지면 그대로 가리킨다
    else:
        dst_layout = _import_layout(dst, src, src_layout)

    dst.add_rel(dst_part, REL_LAYOUT,
                '../slideLayouts/' + posixpath.basename(dst_layout))
    dst.ensure_default_ext('xml', 'application/xml')
    return dst_part


def set_slide_order(pkg, slide_parts):
    """슬라이드 순서를 재작성하고 목록에 없는 슬라이드를 제거한다."""
    pres_part = 'ppt/presentation.xml'
    keep = list(slide_parts)
    keep_set = set(keep)

    for name in list(pkg.parts):
        if (name.startswith('ppt/slides/slide') and name.endswith('.xml')
                and name not in keep_set):
            del pkg.parts[name]
            pkg.parts.pop('ppt/slides/_rels/%s.rels' % posixpath.basename(name), None)

    # presentation.xml.rels에서 슬라이드 관계를 전부 지우고 순서대로 다시 건다
    rels = {rid: v for rid, v in pkg.rels_of(pres_part).items()
            if v[0] != REL_SLIDE}
    pkg.set_rels(pres_part, rels)
    rids = [pkg.add_rel(pres_part, REL_SLIDE, 'slides/' + posixpath.basename(p))
            for p in keep]

    root = pkg.read_xml(pres_part)
    lst = root.find('{%s}sldIdLst' % P)
    if lst is None:
        lst = ET.Element('{%s}sldIdLst' % P)
        root.insert(0, lst)
    for child in list(lst):
        lst.remove(child)
    for i, rid in enumerate(rids):
        ET.SubElement(lst, '{%s}sldId' % P,
                      {'id': str(256 + i), '{%s}id' % R: rid})
    pkg.write_xml(pres_part, root)
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_slides -v
```
Expected: PASS — 7 tests

`test_import_from_a_renames_media_by_content`가 실패하면 `_copy_media_rels`의 경로 정규화를 확인한다.
`target`이 `../media/image1.png` 형태이므로 `src_part`의 디렉터리(`ppt/slides`) 기준으로 합쳐야 `ppt/media/image1.png`가 나온다.

`test_set_slide_order_drops_unlisted`가 `sldIdLst` 개수 불일치를 내면,
`presentation.xml`에 `sldIdLst`가 여러 개 있거나 `sldMasterIdLst` 뒤에 와야 하는 순서 제약을 어긴 것이다.
OOXML 스키마상 `sldMasterIdLst` → `sldIdLst` → `sldSz` 순서를 지켜야 하므로,
`lst`가 없어 새로 만들 때는 `sldMasterIdLst` 바로 뒤에 넣는다.

- [ ] **Step 5: 커밋한다**

```bash
cd C:/it
git add .claude/skills/writing-user-guide-pptx/scripts/oox/slides.py .claude/skills/writing-user-guide-pptx/tests/test_slides.py
git commit -m "feat(guide-pptx): 슬라이드 복제·이식 추가"
```

---

### Task 6: 덱 빌더

**Files:**
- Create: `.claude/skills/writing-user-guide-pptx/scripts/build_deck.py`
- Create: `.claude/skills/writing-user-guide-pptx/assets/deck.example.json`
- Test: `.claude/skills/writing-user-guide-pptx/tests/test_build_deck.py`

**Interfaces:**
- Consumes: `oox.package.Package`, `oox.slides`, `oox.text.replace_text`, `oox.shapes`, `oox.emu`
- Produces:
  - `SCREEN_BASE_SLIDE: int = 283`
  - `HEADER_MAX_BOTTOM_CM: float = 4.0`
  - `SHOT_BOX_CM = (1.71, 4.21, 24.00, 13.11)`
  - `NOTES_BOX_CM = (26.40, 4.21, 5.72, 13.11)`
  - `BADGE_D_CM: float = 0.8`
  - `build(deck: dict, base_dir: str, template_a: str, template_b: str, out_path: str) -> dict`
    — 통계 dict(`{'slides': n, 'media': n, 'pruned': n}`) 반환
  - `main(argv) -> int` — CLI 진입점

**CLI:**
```
python scripts/build_deck.py --deck deck.json --out 사용자가이드.pptx
```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# tests/test_build_deck.py
"""덱 빌더 통합 테스트."""
import json
import struct
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from build_deck import (BADGE_D_CM, HEADER_MAX_BOTTOM_CM, NOTES_BOX_CM,
                        SCREEN_BASE_SLIDE, SHOT_BOX_CM, build)
from oox.emu import cm_to_emu, emu_to_cm
from oox.package import NS, Package
from oox.slides import shape_bbox, top_level_shapes
from oox.text import iter_paragraphs, paragraph_text

TEMPLATE_A = r'C:\it\sample\템플릿 1번 A(문서작업용).pptx'
TEMPLATE_B = r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx'


def write_png(path, width, height):
    """지정 크기의 최소 유효 PNG를 만든다. 픽셀은 단색이다."""
    import binascii
    import zlib

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', binascii.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    raw = b''.join(b'\x00' + b'\x40\x80\xC0' * width for _ in range(height))
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
    Path(path).write_bytes(png)


class TestBuildDeck(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        (self.base / 'shots').mkdir()
        write_png(self.base / 'shots' / 'a.png', 1600, 900)
        self.addCleanup(self.tmp.cleanup)

    def _build(self, deck):
        out = str(self.base / 'out.pptx')
        stats = build(deck, str(self.base), TEMPLATE_A, TEMPLATE_B, out)
        return out, stats

    def test_pattern_only_deck(self):
        deck = {
            'output': 'out.pptx',
            'slides': [
                {'type': 'pattern', 'from': {'template': 'B', 'slide': 1},
                 'text': {'템플릿 디자인': 'IT Project Portal 사용자 가이드',
                          '부제목을 입력해주세요': '예산 작성부터 전자결재까지'}},
            ],
        }
        out, stats = self._build(deck)
        self.assertEqual(stats['slides'], 1)
        pkg = Package.open(out)
        root = pkg.read_xml('ppt/slides/slide1.xml')
        texts = [paragraph_text(p) for p in iter_paragraphs(root)]
        self.assertIn('IT Project Portal 사용자 가이드', texts)
        self.assertNotIn('템플릿 디자인', texts)

    def test_screen_slide_keeps_only_header_and_adds_content(self):
        deck = {
            'output': 'out.pptx',
            'slides': [
                {'type': 'screen', 'badge': '01', 'title': '예산 작성',
                 'caption': '작성할 예산 유형을 고릅니다',
                 'shot': 'shots/a.png',
                 'steps': ['좌측 메뉴에서 [예산]을 클릭합니다',
                           '해당 유형을 고릅니다'],
                 'callouts': [{'n': 1, 'x': 4.2, 'y': 7.1}]},
            ],
        }
        out, _ = self._build(deck)
        pkg = Package.open(out)
        root = pkg.read_xml('ppt/slides/slide1.xml')
        shapes = top_level_shapes(root)
        # 헤더 2 + 캡처 1 + 설명 상자 1 + 배지 1 = 5
        self.assertEqual(len(shapes), 5)

        texts = [paragraph_text(p) for p in iter_paragraphs(root)]
        self.assertIn('예산 작성', texts)
        self.assertIn('작성할 예산 유형을 고릅니다', texts)
        self.assertIn('1. 좌측 메뉴에서 [예산]을 클릭합니다', texts)
        self.assertIn('2. 해당 유형을 고릅니다', texts)
        self.assertIn('01', texts)

    def test_screen_shot_is_height_bound_and_wide_enough(self):
        deck = {'output': 'out.pptx', 'slides': [
            {'type': 'screen', 'badge': '01', 'title': 'T', 'caption': 'C',
             'shot': 'shots/a.png', 'steps': ['하나']},
        ]}
        out, _ = self._build(deck)
        pkg = Package.open(out)
        root = pkg.read_xml('ppt/slides/slide1.xml')
        pics = [s for s in top_level_shapes(root) if s.tag == '{%s}pic' % NS['p']]
        self.assertEqual(len(pics), 1)
        _, _, w, h = shape_bbox(pics[0])
        self.assertAlmostEqual(emu_to_cm(h), 13.11, places=2)
        self.assertGreater(emu_to_cm(w), 20.0)

    def test_empty_pic_placeholders_are_dropped(self):
        """캡처형 슬라이드를 복제해도 빈 그림 자리표시자가 남지 않는다.

        B slide8은 그림 자리표시자 3개(idx 10, 11, 12)를 비운 채로 갖고 있다.
        """
        deck = {'output': 'out.pptx', 'slides': [
            {'type': 'pattern', 'from': {'template': 'B', 'slide': 8}, 'text': {}},
        ]}
        out, _ = self._build(deck)
        pkg = Package.open(out)
        root = pkg.read_xml('ppt/slides/slide1.xml')
        for shape in top_level_shapes(root):
            ph = shape.find('.//{%s}ph' % NS['p'])
            self.assertFalse(ph is not None and ph.get('type') == 'pic')

    def test_missing_text_key_fails_build(self):
        deck = {'output': 'out.pptx', 'slides': [
            {'type': 'pattern', 'from': {'template': 'B', 'slide': 1},
             'text': {'없는문구입니다': 'x'}},
        ]}
        with self.assertRaises(ValueError) as ctx:
            self._build(deck)
        self.assertIn('없는문구입니다', str(ctx.exception))

    def test_missing_shot_fails_build(self):
        deck = {'output': 'out.pptx', 'slides': [
            {'type': 'screen', 'badge': '01', 'title': 'T', 'caption': 'C',
             'shot': 'shots/nope.png', 'steps': ['하나']},
        ]}
        with self.assertRaises(FileNotFoundError):
            self._build(deck)

    def test_callout_outside_slide_fails_build(self):
        deck = {'output': 'out.pptx', 'slides': [
            {'type': 'screen', 'badge': '01', 'title': 'T', 'caption': 'C',
             'shot': 'shots/a.png', 'steps': ['하나'],
             'callouts': [{'n': 1, 'x': 40.0, 'y': 7.1}]},
        ]}
        with self.assertRaises(ValueError):
            self._build(deck)

    def test_output_is_small_after_pruning(self):
        """172MB 템플릿에서 슬라이드 2장만 남기면 산출물이 훨씬 작아야 한다."""
        deck = {'output': 'out.pptx', 'slides': [
            {'type': 'pattern', 'from': {'template': 'B', 'slide': 1},
             'text': {'템플릿 디자인': 'x', '부제목을 입력해주세요': 'y'}},
            {'type': 'screen', 'badge': '01', 'title': 'T', 'caption': 'C',
             'shot': 'shots/a.png', 'steps': ['하나']},
        ]}
        out, stats = self._build(deck)
        size_mb = Path(out).stat().st_size / 1e6
        self.assertLess(size_mb, 50)
        self.assertGreater(stats['pruned'], 500)

    def test_cross_template_import(self):
        deck = {'output': 'out.pptx', 'slides': [
            {'type': 'pattern', 'from': {'template': 'B', 'slide': 1},
             'text': {'템플릿 디자인': 'x', '부제목을 입력해주세요': 'y'}},
            {'type': 'pattern', 'from': {'template': 'A', 'slide': 9}, 'text': {}},
        ]}
        out, stats = self._build(deck)
        self.assertEqual(stats['slides'], 2)
        with zipfile.ZipFile(out) as z:
            self.assertIsNone(z.testzip())


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_build_deck -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'build_deck'`

- [ ] **Step 3: 최소 구현을 쓴다**

```python
# scripts/build_deck.py
"""deck.json과 화면 캡처로 사용자 가이드 pptx를 만든다.

템플릿 B를 베이스로 삼아 필요한 슬라이드만 남기고 재조립한다.
설계는 docs/superpowers/specs/2026-08-26-user-guide-pptx-skill-design.md를 따른다.
"""
import argparse
import json
import os
import struct
import sys

from oox.emu import SLIDE_H_EMU, SLIDE_W_EMU, cm_to_emu, contain, emu_to_cm
from oox.package import NS, REL_IMAGE, Package
from oox.shapes import make_badge, make_pic, make_textbox, next_shape_id
from oox.slides import (clone_slide, set_slide_order, shape_bbox, sp_tree,
                        top_level_shapes)
from oox.text import replace_text

NS_P = NS['p']

# 템플릿 B에서 screen 슬라이드의 베이스로 쓰는 슬라이드 번호.
# 내지 레이아웃을 쓰는 255장 중 최상위 도형이 3개(헤더 2 + 본문 1)로 가장 적고
# 미디어 참조가 하나도 없어 이식·정리가 가장 깨끗하다. 원래 용도는 SWOT 도해다.
SCREEN_BASE_SLIDE = 283

# 헤더 판정 기준. bbox 하단이 이 값 이하인 최상위 도형만 남긴다.
# 내지 레이아웃 사용 255장 전부에서 번호 배지(하단 3.47)와 대제목 그룹(하단 3.25)만 통과한다.
HEADER_MAX_BOTTOM_CM = 4.0

SHOT_BOX_CM = (1.71, 4.21, 24.00, 13.11)
NOTES_BOX_CM = (26.40, 4.21, 5.72, 13.11)
BADGE_D_CM = 0.8

# SCREEN_BASE_SLIDE 헤더에 원래 들어 있는 자리표시자 문구
BASE_BADGE_TEXT = '01'
BASE_TITLE_TEXT = '대제목 내용 입력'
BASE_CAPTION_TEXT = '주제 및 부가적인 내용 입력'

MIN_SHOT_WIDTH_CM = 20.0


def png_size(path):
    """PNG 헤더에서 픽셀 크기를 읽는다. Pillow 없이 IHDR만 파싱한다."""
    with open(path, 'rb') as f:
        head = f.read(26)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('PNG 파일이 아닙니다: %s' % path)
    w, h = struct.unpack('>II', head[16:24])
    return w, h


def _place_image(pkg, slide_part, root, src_path, box_cm, name):
    """이미지를 지정 사각형에 내접시켜 슬라이드에 얹는다."""
    if not os.path.isfile(src_path):
        raise FileNotFoundError('캡처 파일이 없습니다: %s' % src_path)
    with open(src_path, 'rb') as f:
        data = f.read()
    ext = src_path.rsplit('.', 1)[-1].lower()
    media = pkg.add_media(data, ext)
    rid = pkg.add_rel(slide_part, REL_IMAGE,
                      '../media/' + os.path.basename(media))

    src_w, src_h = png_size(src_path)
    box = (cm_to_emu(box_cm[0]), cm_to_emu(box_cm[1]),
           cm_to_emu(box_cm[2]), cm_to_emu(box_cm[3]))
    x, y, w, h = contain(src_w, src_h, *box)
    if emu_to_cm(w) < MIN_SHOT_WIDTH_CM:
        raise ValueError('캡처 폭이 %.2fcm로 %scm 미만입니다: %s'
                         % (emu_to_cm(w), MIN_SHOT_WIDTH_CM, src_path))

    tree = sp_tree(root)
    pic = make_pic(next_shape_id(tree), name, rid, x, y, w, h)
    tree.append(pic)
    return pic


def _drop_empty_pic_placeholders(root):
    """채우지 않은 그림 자리표시자 도형을 제거하고 제거 개수를 돌려준다.

    남겨두면 PowerPoint가 "그림을 추가하려면 클릭" 안내를 그려서 가이드 문서로 쓸 수 없다.
    """
    tree = sp_tree(root)
    dropped = 0
    for shape in top_level_shapes(root):
        if shape.tag != '{%s}sp' % NS_P:
            continue
        ph = shape.find('.//{%s}ph' % NS_P)
        if ph is not None and ph.get('type') == 'pic':
            tree.remove(shape)
            dropped += 1
    return dropped


def _build_pattern(pkg, src_pkgs, spec, base_dir):
    """템플릿 슬라이드를 복제하고 문구를 치환한다."""
    src = src_pkgs[spec['from']['template']]
    part = clone_slide(pkg, src, spec['from']['slide'])
    root = pkg.read_xml(part)
    _drop_empty_pic_placeholders(root)

    mapping = spec.get('text') or {}
    if mapping:
        counts = replace_text(root, mapping)
        missing = [k for k, n in counts.items() if n == 0]
        if missing:
            raise ValueError(
                '슬라이드 %s에 없는 치환 키: %s' % (spec['from'], ', '.join(missing)))

    pkg.write_xml(part, root)

    for img in spec.get('images') or []:
        root = pkg.read_xml(part)
        if 'rect' not in img:
            # ph 방식은 설계 6절에서 범위 밖으로 정했다. 자리표시자 245개 중 143개가
            # 세로형 사진 상자라 이 스킬의 용도에 맞지 않기 때문이다.
            raise ValueError('images 항목에는 rect가 필요합니다: %s' % img)
        _place_image(pkg, part, root, os.path.join(base_dir, img['src']),
                     tuple(img['rect']), '이미지')
        pkg.write_xml(part, root)

    return part


def _build_screen(pkg, src_pkgs, spec, base_dir):
    """헤더만 남긴 내지에 캡처와 단계 설명을 조립한다."""
    part = clone_slide(pkg, src_pkgs['B'], SCREEN_BASE_SLIDE)
    root = pkg.read_xml(part)
    tree = sp_tree(root)

    # 헤더만 남기고 본문 도형을 제거한다
    kept = 0
    for shape in top_level_shapes(root):
        bbox = shape_bbox(shape)
        if bbox is not None and emu_to_cm(bbox[1] + bbox[3]) <= HEADER_MAX_BOTTOM_CM:
            kept += 1
            continue
        tree.remove(shape)
    if kept == 0:
        raise ValueError(
            'screen 조립 후 헤더 도형이 0개입니다. SCREEN_BASE_SLIDE(%d)가 바뀌었는지 확인하세요.'
            % SCREEN_BASE_SLIDE)

    counts = replace_text(root, {
        BASE_BADGE_TEXT: spec['badge'],
        BASE_TITLE_TEXT: spec['title'],
        BASE_CAPTION_TEXT: spec['caption'],
    })
    missing = [k for k, n in counts.items() if n == 0]
    if missing:
        raise ValueError('screen 헤더 치환 실패: %s' % ', '.join(missing))

    pkg.write_xml(part, root)

    # 캡처
    root = pkg.read_xml(part)
    _place_image(pkg, part, root, os.path.join(base_dir, spec['shot']),
                 SHOT_BOX_CM, '화면 캡처')

    # 단계 설명
    tree = sp_tree(root)
    lines = ['%d. %s' % (i + 1, s) for i, s in enumerate(spec.get('steps') or [])]
    if lines:
        tree.append(make_textbox(
            next_shape_id(tree), '단계 설명',
            cm_to_emu(NOTES_BOX_CM[0]), cm_to_emu(NOTES_BOX_CM[1]),
            cm_to_emu(NOTES_BOX_CM[2]), cm_to_emu(NOTES_BOX_CM[3]),
            lines, size_pt=11))

    # 번호 말풍선
    d = cm_to_emu(BADGE_D_CM)
    for c in spec.get('callouts') or []:
        x, y = cm_to_emu(c['x']), cm_to_emu(c['y'])
        if x < 0 or y < 0 or x + d > SLIDE_W_EMU or y + d > SLIDE_H_EMU:
            raise ValueError('말풍선 좌표가 슬라이드를 벗어납니다: %s' % c)
        tree.append(make_badge(next_shape_id(tree), '말풍선 %s' % c['n'],
                               x, y, d, str(c['n'])))

    pkg.write_xml(part, root)
    return part


def build(deck, base_dir, template_a, template_b, out_path):
    """deck을 읽어 pptx를 만들고 통계를 돌려준다."""
    pkg = Package.open(template_b)
    src_pkgs = {'B': Package.open(template_b), 'A': Package.open(template_a)}

    parts = []
    for spec in deck['slides']:
        kind = spec.get('type', 'pattern')
        if kind == 'pattern':
            parts.append(_build_pattern(pkg, src_pkgs, spec, base_dir))
        elif kind == 'screen':
            parts.append(_build_screen(pkg, src_pkgs, spec, base_dir))
        else:
            raise ValueError('알 수 없는 슬라이드 유형: %s' % kind)

    set_slide_order(pkg, parts)
    pruned = pkg.prune_orphans()
    pkg.save(out_path)

    return {
        'slides': len(parts),
        'media': len([p for p in pkg.parts if p.startswith('ppt/media/')]),
        'pruned': len(pruned),
    }


def main(argv=None):
    """CLI 진입점."""
    ap = argparse.ArgumentParser(description='사용자 가이드 pptx를 만든다')
    ap.add_argument('--deck', required=True, help='deck.json 경로')
    ap.add_argument('--out', help='산출 pptx 경로 (기본: deck.json의 output)')
    ap.add_argument('--template-a', default=r'C:\it\sample\템플릿 1번 A(문서작업용).pptx')
    ap.add_argument('--template-b', default=r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx')
    args = ap.parse_args(argv)

    with open(args.deck, encoding='utf-8') as f:
        deck = json.load(f)
    base_dir = os.path.dirname(os.path.abspath(args.deck))
    out = args.out or os.path.join(base_dir, deck.get('output', 'out.pptx'))

    stats = build(deck, base_dir, args.template_a, args.template_b, out)
    print('생성 완료: %s' % out)
    print('  슬라이드 %d장, 미디어 %d개, 정리한 고아 파트 %d개'
          % (stats['slides'], stats['media'], stats['pruned']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
```

`assets/deck.example.json`은 spec의 `deck.json` 스키마 예시를 그대로 옮겨 적는다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_build_deck -v
```
Expected: PASS — 9 tests

`test_screen_slide_keeps_only_header_and_adds_content`가 도형 5개가 아닌 값을 내면
`top_level_shapes`를 순회하면서 동시에 `tree.remove`를 호출해 순회가 꼬인 것이다.
`top_level_shapes(root)`가 리스트를 돌려주므로 안전하지만, 직접 iterator를 쓰면 깨진다.

`test_output_is_small_after_pruning`이 실패하면 `prune_orphans`가 레이아웃을 지우지 못한 것이다.
`_referenced_targets`가 `.rels` 경로에서 원본 파트 경로를 역산하는 부분을 확인한다.

- [ ] **Step 5: 커밋한다**

```bash
cd C:/it
git add .claude/skills/writing-user-guide-pptx/scripts/build_deck.py .claude/skills/writing-user-guide-pptx/assets/deck.example.json .claude/skills/writing-user-guide-pptx/tests/test_build_deck.py
git commit -m "feat(guide-pptx): 덱 빌더 추가"
```

---

### Task 7: 산출물 검증기

**Files:**
- Create: `.claude/skills/writing-user-guide-pptx/scripts/verify_deck.py`
- Test: `.claude/skills/writing-user-guide-pptx/tests/test_verify_deck.py`

**Interfaces:**
- Consumes: `oox.package.Package`, `oox.text`, `oox.slides`, `oox.emu`
- Produces:
  - `PLACEHOLDER_PHRASES: tuple[str, ...]`
  - `verify(pptx_path: str, expected_slides: int | None = None) -> list[str]` — 문제 목록. 빈 리스트면 통과
  - `main(argv) -> int` — 문제가 있으면 1을 돌려준다

**검사 항목:** spec §3.3 `verify_deck.py` 표 그대로.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# tests/test_verify_deck.py
"""산출물 검증기 테스트."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from build_deck import build
from tests.test_build_deck import write_png  # PNG 생성 헬퍼 재사용
from verify_deck import PLACEHOLDER_PHRASES, verify

TEMPLATE_A = r'C:\it\sample\템플릿 1번 A(문서작업용).pptx'
TEMPLATE_B = r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx'


class TestVerifyDeck(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        (self.base / 'shots').mkdir()
        write_png(self.base / 'shots' / 'a.png', 1600, 900)
        self.addCleanup(self.tmp.cleanup)

    def _make(self, slides):
        out = str(self.base / 'out.pptx')
        build({'output': 'out.pptx', 'slides': slides},
              str(self.base), TEMPLATE_A, TEMPLATE_B, out)
        return out

    def test_clean_deck_passes(self):
        out = self._make([
            {'type': 'screen', 'badge': '01', 'title': '예산 작성',
             'caption': '유형을 고릅니다', 'shot': 'shots/a.png',
             'steps': ['하나']},
        ])
        self.assertEqual(verify(out, expected_slides=1), [])

    def test_detects_leftover_placeholder(self):
        """치환하지 않은 자리표시자가 남으면 잡아낸다."""
        out = self._make([
            {'type': 'pattern', 'from': {'template': 'B', 'slide': 2},
             'text': {}},  # 목차 슬라이드를 치환 없이 그대로 넣는다
        ])
        problems = verify(out)
        self.assertTrue(any('자리표시자' in p for p in problems))

    def test_detects_slide_count_mismatch(self):
        out = self._make([
            {'type': 'screen', 'badge': '01', 'title': 'T', 'caption': 'C',
             'shot': 'shots/a.png', 'steps': ['하나']},
        ])
        problems = verify(out, expected_slides=5)
        self.assertTrue(any('슬라이드 수' in p for p in problems))

    def test_placeholder_phrases_cover_known_template_strings(self):
        for phrase in ('내용입력', '하위내용입력', '대제목', '소제목 내용 입력',
                       '내용을 입력해주세요', '부제목을 입력해주세요'):
            self.assertIn(phrase, PLACEHOLDER_PHRASES)


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_verify_deck -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'verify_deck'`

- [ ] **Step 3: 최소 구현을 쓴다**

```python
# scripts/verify_deck.py
"""산출 pptx를 되읽어 배포 가능한 상태인지 검사한다.

원칙은 조용한 성공보다 시끄러운 실패다. 자리표시자가 남은 PPT는 그대로 배포되기 때문이다.
"""
import argparse
import os
import posixpath
import sys
import zipfile

from oox.emu import emu_to_cm
from oox.package import NS, Package
from oox.slides import shape_bbox, top_level_shapes
from oox.text import iter_paragraphs, paragraph_text

PLACEHOLDER_PHRASES = (
    '내용입력',
    '하위내용입력',
    '대제목',
    '소제목 내용 입력',
    '내용을 입력해주세요',
    '내용을 입력해 주세요',
    '부제목을 입력해주세요',
    '하위 내용을 입력하세요',
    '하위내용입력',
    '주제 및 부가적인 내용 입력',
)

MAX_SIZE_MB = 50
MIN_SHOT_WIDTH_CM = 20.0


def _slide_parts(pkg):
    return sorted(
        (p for p in pkg.parts
         if p.startswith('ppt/slides/slide') and p.endswith('.xml')),
        key=lambda p: int(''.join(c for c in posixpath.basename(p) if c.isdigit())))


def verify(pptx_path, expected_slides=None):
    """검사 결과 문제 목록을 돌려준다. 빈 리스트면 통과."""
    problems = []

    with zipfile.ZipFile(pptx_path) as z:
        if z.testzip() is not None:
            problems.append('zip 무결성: 손상된 엔트리가 있습니다')

    size_mb = os.path.getsize(pptx_path) / 1e6
    if size_mb > MAX_SIZE_MB:
        problems.append('파일 크기: %.1fMB로 %dMB를 넘습니다 (미디어 정리 실패 신호)'
                        % (size_mb, MAX_SIZE_MB))

    pkg = Package.open(pptx_path)
    slides = _slide_parts(pkg)

    if expected_slides is not None and len(slides) != expected_slides:
        problems.append('슬라이드 수: %d장인데 %d장을 기대했습니다'
                        % (len(slides), expected_slides))

    referenced = set()
    for part in slides:
        root = pkg.read_xml(part)
        name = posixpath.basename(part)

        for text in (paragraph_text(p) for p in iter_paragraphs(root)):
            for phrase in PLACEHOLDER_PHRASES:
                if phrase in text:
                    problems.append('잔여 자리표시자: %s에 "%s"' % (name, text))
                    break

        for shape in top_level_shapes(root):
            if shape.tag != '{%s}sp' % NS['p']:
                continue
            ph = shape.find('.//{%s}ph' % NS['p'])
            if ph is not None and ph.get('type') == 'pic':
                problems.append('빈 그림 자리표시자: %s idx=%s'
                                % (name, ph.get('idx')))

        for shape in top_level_shapes(root):
            if shape.tag != '{%s}pic' % NS['p']:
                continue
            bbox = shape_bbox(shape)
            if bbox and emu_to_cm(bbox[2]) < MIN_SHOT_WIDTH_CM:
                problems.append('캡처 크기: %s의 이미지 폭이 %.2fcm로 %scm 미만입니다'
                                % (name, emu_to_cm(bbox[2]), MIN_SHOT_WIDTH_CM))

        for rtype, target in pkg.rels_of(part).values():
            if target.startswith(('http://', 'https://')):
                continue
            resolved = posixpath.normpath(
                posixpath.join(posixpath.dirname(part), target)).replace('\\', '/')
            referenced.add(resolved)
            if resolved not in pkg.parts:
                problems.append('끊어진 관계: %s -> %s' % (name, target))

    for part in pkg.parts:
        if part.startswith('ppt/media/') and part not in referenced:
            # 레이아웃·마스터가 참조할 수도 있으므로 전체 참조를 다시 확인한다
            if not any(part == posixpath.normpath(
                    posixpath.join(posixpath.dirname(owner), t)).replace('\\', '/')
                    for owner in pkg.parts if not owner.endswith('.rels')
                    for _, t in pkg.rels_of(owner).values()):
                problems.append('미디어 고아: %s' % part)

    return problems


def main(argv=None):
    """CLI 진입점. 문제가 있으면 1을 돌려준다."""
    ap = argparse.ArgumentParser(description='산출 pptx를 검증한다')
    ap.add_argument('pptx')
    ap.add_argument('--expect-slides', type=int, default=None)
    args = ap.parse_args(argv)

    problems = verify(args.pptx, args.expect_slides)
    if not problems:
        print('검증 통과: %s' % args.pptx)
        return 0
    print('검증 실패 %d건:' % len(problems))
    for p in problems:
        print('  - %s' % p)
    return 1


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_verify_deck -v
```
Expected: PASS — 4 tests

`test_clean_deck_passes`가 '미디어 고아'를 내면, 레이아웃·마스터가 참조하는 미디어를
슬라이드 참조 집합에만 넣고 비교한 것이다. 마지막 루프의 전체 참조 재확인이 동작하는지 본다.
이 루프가 느리면 `_referenced_targets`를 `Package`에서 한 번만 계산해 재사용한다.

- [ ] **Step 5: 커밋한다**

```bash
cd C:/it
git add .claude/skills/writing-user-guide-pptx/scripts/verify_deck.py .claude/skills/writing-user-guide-pptx/tests/test_verify_deck.py
git commit -m "feat(guide-pptx): 산출물 검증기 추가"
```

---

### Task 8: 템플릿 패턴 카탈로그 생성기

**Files:**
- Create: `.claude/skills/writing-user-guide-pptx/scripts/catalog_templates.py`
- Create: `.claude/skills/writing-user-guide-pptx/references/template-catalog.md` (생성물)
- Test: `.claude/skills/writing-user-guide-pptx/tests/test_catalog.py`

**Interfaces:**
- Consumes: `oox.package.Package`, `oox.slides`, `oox.emu`, `oox.text`
- Produces:
  - `classify(metrics: dict) -> str` — 분류명
  - `slide_metrics(pkg: Package, slide_part: str) -> dict`
  - `build_catalog(template_a: str, template_b: str) -> dict`
  - `main(argv) -> int`

**분류 규칙 (우선순위 순):**

| 순위 | 조건 | 분류 |
| --- | --- | --- |
| 1 | 레이아웃 이름이 `표지`/`1_표지` | `표지` |
| 2 | 레이아웃 이름이 `목차`/`1_목차` | `목차` |
| 3 | 레이아웃 이름이 `간지`/`1_간지` | `간지` |
| 4 | 레이아웃 이름이 `종지`/`1_종지` | `종지` |
| 5 | `graphicFrame` ≥ 1 | `표형` |
| 6 | `pic_ph` ≥ 1 | `캡처형` |
| 7 | 연도 문구(4자리 숫자) ≥ 3 | `타임라인형` |
| 8 | 숫자 배지(`01`~`10`) ≥ 3 이고 열 개수 ≥ 3 | `N분할형` |
| 9 | 숫자 배지 ≥ 2 이고 열 개수 ≤ 2 | `비교형` |
| 10 | 위 어디에도 해당 없고 도형 ≥ 20 | `프로세스형` |
| 11 | 그 외 | `기타` |

열 개수는 최상위 도형의 x 중심을 1.0 cm 격자로 반올림해 서로 다른 값의 개수로 센다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# tests/test_catalog.py
"""템플릿 카탈로그 생성기 테스트."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from catalog_templates import build_catalog, classify, slide_metrics
from oox.package import Package

TEMPLATE_A = r'C:\it\sample\템플릿 1번 A(문서작업용).pptx'
TEMPLATE_B = r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx'


class TestCatalog(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = build_catalog(TEMPLATE_A, TEMPLATE_B)

    def test_covers_every_slide(self):
        self.assertEqual(len(self.catalog['A']), 365)
        self.assertEqual(len(self.catalog['B']), 363)

    def test_no_slide_left_unclassified(self):
        """'기타'가 전체의 20%를 넘으면 규칙이 부실한 것이다."""
        for tpl in ('A', 'B'):
            rows = self.catalog[tpl]
            others = [r for r in rows if r['kind'] == '기타']
            self.assertLess(len(others) / len(rows), 0.20,
                            '%s 템플릿의 기타 비율이 너무 높습니다: %d/%d'
                            % (tpl, len(others), len(rows)))

    def test_cover_slide_classified(self):
        row = next(r for r in self.catalog['B'] if r['slide'] == 1)
        self.assertEqual(row['kind'], '표지')

    def test_toc_slide_classified(self):
        row = next(r for r in self.catalog['B'] if r['slide'] == 2)
        self.assertEqual(row['kind'], '목차')

    def test_pic_placeholder_geometry_recorded(self):
        """캡처형 슬라이드는 사용 가능한 ph idx와 박스 크기를 싣는다."""
        row = next(r for r in self.catalog['B'] if r['slide'] == 8)
        self.assertEqual(row['kind'], '캡처형')
        self.assertEqual(sorted(p['idx'] for p in row['pic_ph']), [10, 11, 12])
        for p in row['pic_ph']:
            self.assertGreater(p['w_cm'], 0)
            self.assertGreater(p['h_cm'], 0)

    def test_base_slide_metrics(self):
        pkg = Package.open(TEMPLATE_B)
        m = slide_metrics(pkg, 'ppt/slides/slide283.xml')
        self.assertEqual(m['layout_name'], '내지')
        self.assertEqual(m['top_shapes'], 3)

    def test_classify_prefers_table_over_capture(self):
        self.assertEqual(classify({
            'layout_name': '내지', 'graphic_frames': 1, 'pic_ph_count': 2,
            'year_labels': 0, 'number_badges': 0, 'columns': 1, 'top_shapes': 5,
        }), '표형')


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_catalog -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog_templates'`

- [ ] **Step 3: 최소 구현을 쓴다**

```python
# scripts/catalog_templates.py
"""템플릿 A·B의 728장을 구조 분석해 패턴 색인을 만든다.

PowerPoint도 LibreOffice도 없어 슬라이드를 렌더링할 수 없으므로,
XML 구조에서 뽑은 지표로 패턴을 분류한다. 눈으로 확인할 때는 PPT 뷰어로 원본을 연다.
"""
import argparse
import json
import posixpath
import re
import sys

from oox.emu import emu_to_cm
from oox.package import NS, REL_LAYOUT, Package
from oox.slides import shape_bbox, top_level_shapes
from oox.text import iter_paragraphs, paragraph_text

COLUMN_GRID_CM = 1.0
_YEAR_RE = re.compile(r'^(19|20)\d{2}')
_BADGE_RE = re.compile(r'^(0[1-9]|10)$')


def classify(m):
    """지표 dict를 받아 패턴 분류명을 돌려준다. 규칙 순서가 곧 우선순위다."""
    name = m['layout_name']
    for key in ('표지', '목차', '간지', '종지'):
        if name in (key, '1_' + key):
            return key
    if m['graphic_frames'] >= 1:
        return '표형'
    if m['pic_ph_count'] >= 1:
        return '캡처형'
    if m['year_labels'] >= 3:
        return '타임라인형'
    if m['number_badges'] >= 3 and m['columns'] >= 3:
        return 'N분할형'
    if m['number_badges'] >= 2 and m['columns'] <= 2:
        return '비교형'
    if m['top_shapes'] >= 20:
        return '프로세스형'
    return '기타'


def _layout_of(pkg, slide_part):
    """슬라이드가 참조하는 레이아웃 파트 경로를 돌려준다."""
    for rtype, target in pkg.rels_of(slide_part).values():
        if rtype == REL_LAYOUT:
            return posixpath.normpath(
                posixpath.join(posixpath.dirname(slide_part), target)).replace('\\', '/')
    return None


def _layout_pic_placeholders(pkg, layout_part):
    """레이아웃의 그림 자리표시자 목록을 [{idx, w_cm, h_cm}]로 돌려준다."""
    root = pkg.read_xml(layout_part)
    out = []
    for sp in root.iter('{%s}sp' % NS['p']):
        ph = sp.find('.//{%s}ph' % NS['p'])
        if ph is None or ph.get('type') != 'pic':
            continue
        bbox = shape_bbox(sp)
        if bbox is None:
            continue
        out.append({'idx': int(ph.get('idx', '0')),
                    'w_cm': round(emu_to_cm(bbox[2]), 2),
                    'h_cm': round(emu_to_cm(bbox[3]), 2)})
    return out


def slide_metrics(pkg, slide_part):
    """슬라이드 하나의 구조 지표를 뽑는다."""
    root = pkg.read_xml(slide_part)
    layout_part = _layout_of(pkg, slide_part)
    layout_root = pkg.read_xml(layout_part) if layout_part else None
    layout_name = ''
    if layout_root is not None:
        cs = layout_root.find('{%s}cSld' % NS['p'])
        layout_name = cs.get('name', '') if cs is not None else ''

    shapes = top_level_shapes(root)
    columns = set()
    for s in shapes:
        bbox = shape_bbox(s)
        if bbox:
            columns.add(round(emu_to_cm(bbox[0] + bbox[2] / 2) / COLUMN_GRID_CM))

    texts = [paragraph_text(p).strip() for p in iter_paragraphs(root)]
    pic_ph = _layout_pic_placeholders(pkg, layout_part) if layout_part else []

    return {
        'layout_part': layout_part,
        'layout_name': layout_name,
        'top_shapes': len(shapes),
        'graphic_frames': len(list(root.iter('{%s}graphicFrame' % NS['p']))),
        'pic_ph': pic_ph,
        'pic_ph_count': len(pic_ph),
        'year_labels': sum(1 for t in texts if _YEAR_RE.match(t)),
        'number_badges': sum(1 for t in texts if _BADGE_RE.match(t)),
        'columns': len(columns),
        'texts': texts[:12],
    }


def build_catalog(template_a, template_b):
    """두 템플릿의 전체 슬라이드 색인을 만든다."""
    catalog = {}
    for tag, path in (('A', template_a), ('B', template_b)):
        pkg = Package.open(path)
        rows = []
        parts = sorted(
            (p for p in pkg.parts
             if p.startswith('ppt/slides/slide') and p.endswith('.xml')),
            key=lambda p: int(''.join(c for c in posixpath.basename(p) if c.isdigit())))
        for part in parts:
            m = slide_metrics(pkg, part)
            m['slide'] = int(''.join(c for c in posixpath.basename(part) if c.isdigit()))
            m['kind'] = classify(m)
            rows.append(m)
        catalog[tag] = rows
    return catalog


def _render_markdown(catalog):
    """사람이 훑어볼 수 있는 색인 마크다운을 만든다."""
    lines = ['# 템플릿 패턴 색인', '',
             '`scripts/catalog_templates.py`가 생성합니다. 손으로 고치지 마세요.',
             '슬라이드 그림은 PPT 뷰어로 원본 템플릿을 열어 확인합니다.', '']
    for tag in ('A', 'B'):
        rows = catalog[tag]
        lines.append('## 템플릿 %s (%d장)' % (tag, len(rows)))
        lines.append('')
        counts = {}
        for r in rows:
            counts[r['kind']] = counts.get(r['kind'], 0) + 1
        lines.append('| 분류 | 장수 |')
        lines.append('| --- | --- |')
        for kind, n in sorted(counts.items(), key=lambda kv: -kv[1]):
            lines.append('| %s | %d |' % (kind, n))
        lines.append('')
        lines.append('| 슬라이드 | 분류 | 레이아웃 | 도형 | 열 | 그림틀 | 첫 문구 |')
        lines.append('| --- | --- | --- | --- | --- | --- | --- |')
        for r in rows:
            ph = ','.join('%d(%.1fx%.1f)' % (p['idx'], p['w_cm'], p['h_cm'])
                          for p in r['pic_ph']) or '-'
            first = next((t for t in r['texts'] if t), '')[:24]
            lines.append('| %d | %s | %s | %d | %d | %s | %s |'
                         % (r['slide'], r['kind'], r['layout_name'],
                            r['top_shapes'], r['columns'], ph, first))
        lines.append('')
    return '\n'.join(lines)


def main(argv=None):
    """CLI 진입점."""
    ap = argparse.ArgumentParser(description='템플릿 패턴 색인을 만든다')
    ap.add_argument('--template-a', default=r'C:\it\sample\템플릿 1번 A(문서작업용).pptx')
    ap.add_argument('--template-b', default=r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx')
    ap.add_argument('--out-json', default='references/template-catalog.json')
    ap.add_argument('--out-md', default='references/template-catalog.md')
    args = ap.parse_args(argv)

    catalog = build_catalog(args.template_a, args.template_b)
    with open(args.out_json, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=1)
    with open(args.out_md, 'w', encoding='utf-8') as f:
        f.write(_render_markdown(catalog))
    print('색인 생성: A %d장, B %d장' % (len(catalog['A']), len(catalog['B'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run:
```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest tests.test_catalog -v
```
Expected: PASS — 7 tests

`test_no_slide_left_unclassified`가 실패하면 `classify`의 규칙 10번(`top_shapes >= 20`) 임계값을 조정한다.
분류 결과를 아래로 확인한다.

```bash
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -c "import sys,collections; sys.path.insert(0,'scripts'); from catalog_templates import build_catalog; c=build_catalog(r'C:\it\sample\템플릿 1번 A(문서작업용).pptx', r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx'); print({t: collections.Counter(r['kind'] for r in c[t]) for t in c})"
```

- [ ] **Step 5: 색인을 생성하고 커밋한다**

```bash
cd "C:/it/.claude/skills/writing-user-guide-pptx"
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" scripts/catalog_templates.py
cd C:/it
git add .claude/skills/writing-user-guide-pptx/scripts/catalog_templates.py .claude/skills/writing-user-guide-pptx/tests/test_catalog.py .claude/skills/writing-user-guide-pptx/references/template-catalog.md .claude/skills/writing-user-guide-pptx/references/template-catalog.json
git commit -m "feat(guide-pptx): 템플릿 패턴 색인 생성기 추가"
```

---

### Task 9: Playwright 화면 캡처

**Files:**
- Create: `.claude/skills/writing-user-guide-pptx/scripts/capture_screens.mjs`
- Create: `.claude/skills/writing-user-guide-pptx/assets/capture-fixtures.json`
- Create: `.claude/skills/writing-user-guide-pptx/assets/flow.it-portal.json`

**Interfaces:**
- Consumes: `it_frontend/node_modules/playwright` (import만; 저장소는 수정하지 않는다)
- Produces:
  - `shots/<flow-id>/<NN>-<step-id>.png`
  - `shots/manifest.json` — `[{flow, step, file, width, height, capturedAt, failed}]`

**CLI:**
```
node scripts/capture_screens.mjs --flow assets/flow.it-portal.json --out shots
```

`--flow-id budget-write`로 흐름 하나만 다시 뜰 수 있다.

**로그인 주입 방식** (`it_frontend/tests/e2e/helpers/mockApi.ts`의 `setLoggedIn`과 동일한 효과):
쿠키 `it-portal-user`에 `encodeURIComponent(JSON.stringify(user))`를 넣고,
`addInitScript`로 `localStorage.setItem('user', ...)`를 건다.

**mock이 필요한 공통 경로** (`mockCommonApis` 기준, 이게 없으면 `networkidle`이 정착하지 않아 60초 타임아웃):
`/api/auth/refresh`, `/api/auth/logout`, `/api/documents/badge-count`, `/api/applications/approval-badge`,
`/api/applications/pending-count`, `/api/ccodem/`, `/api/projects`, `/api/cost`, `/api/menus`,
`/api/boards/meta`, `/api/banners`, `/api/notifications`, `/api/notifications/unread-count`

Playwright의 `route`는 **나중에 등록한 것을 먼저 검사**하므로, 구체적인 경로를 뒤에 등록한다.

- [ ] **Step 1: fixtures와 flow 정의를 쓴다**

`assets/capture-fixtures.json`:

```json
{
  "user": {
    "eno": "E001",
    "empNm": "홍길동",
    "athIds": ["ITPZZ001"],
    "bbrC": "D001",
    "temC": "T001"
  },
  "presets": {
    "common": [
      { "url": "/api/auth/refresh", "body": {} },
      { "url": "/api/auth/logout", "body": {} },
      { "url": "/api/documents/badge-count", "body": 5 },
      { "url": "/api/applications/approval-badge", "body": 3 },
      { "url": "/api/applications/pending-count", "body": 3 },
      { "url": "/api/ccodem/", "body": [] },
      { "url": "/api/projects", "body": [] },
      { "url": "/api/cost", "body": [] },
      { "url": "/api/menus", "body": [] },
      { "url": "/api/boards/meta", "body": [] },
      { "url": "/api/banners", "body": [] },
      { "url": "/api/notifications", "body": { "content": [], "totalElements": 0, "totalPages": 0, "number": 0, "size": 20, "first": true, "last": true } },
      { "url": "/api/notifications/unread-count", "body": { "count": 0 } }
    ],
    "budgetPeriod": [
      { "url": "/api/ccodem/budget-period", "body": { "startDate": "2026-01-01", "endDate": "2099-12-31" } }
    ],
    "projects": [
      {
        "url": "/api/projects",
        "body": [
          {
            "abusMngNo": "PRJ-2026-0001",
            "abusNm": "차세대 여신심사 시스템 구축",
            "stsTc": "예산 작성",
            "prjSts": "예산 작성",
            "apfSts": null,
            "tyyBgAmt": 1250000000,
            "odnYn": "N",
            "bseYy": 2026,
            "svnDpmC": "D001",
            "svnDpmCNm": "디지털전략부",
            "dvmDpmC": "D001",
            "dvmDpmCNm": "IT기획부",
            "abusTc": "신규",
            "assetBg": 0,
            "dvcBg": 0,
            "hwBg": 0,
            "swBg": 0,
            "costBg": 0,
            "sttDtm": "2026-01-01",
            "endDtm": "2026-12-31",
            "prlmHrkOgzCCone": "디지털본부",
            "usidNm": "홍길동"
          }
        ]
      }
    ],
    "costs": [
      {
        "url": "/api/cost",
        "body": [
          {
            "costBgNo": "COST-2026-001",
            "bseYy": "2026",
            "cttNm": "전산장비 임차료",
            "costTotXpAmt": 84000000,
            "apfSts": null,
            "costSvnDpmC": "D001",
            "costSvnDpmNm": "디지털전략부",
            "ioeC": "IOE001",
            "cttOppNm": "한국정보통신",
            "abusTc": "계속",
            "dfrCleC": "월별",
            "fstDfrDt": "2026-01-01",
            "curC": "KRW",
            "cgprId": "E001",
            "cgprNm": "홍길동",
            "svnTemC": "T001",
            "bgUntAbusC": "ABUS001",
            "tmnYn": "N",
            "indRsn": "계속",
            "sectSysUtzYn": "N"
          }
        ]
      }
    ],
    "approvals": [
      {
        "url": "/api/applications",
        "body": [
          {
            "apfMngNo": "APF-2026-001",
            "apfNm": "2026년 전산예산 편성 요청",
            "apfSts": "결재중",
            "apfStsC": "1",
            "rqsEno": "E002",
            "rqsDt": "2026-01-10",
            "rqsOpnn": "검토 부탁드립니다.",
            "approvers": [
              { "dcdSqn": 1, "dcdEno": "E001", "dcdTp": "승인", "dcdDt": "", "dcdOpnn": "" }
            ]
          }
        ]
      },
      {
        "url": "/api/applications/dashboard",
        "body": {
          "pending": 3,
          "inProgress": 5,
          "completedThisMonth": 12,
          "rejected": 1,
          "monthlyTrend": [
            { "month": "2025-09", "count": 8 },
            { "month": "2025-10", "count": 11 },
            { "month": "2025-11", "count": 9 },
            { "month": "2025-12", "count": 14 },
            { "month": "2026-01", "count": 12 },
            { "month": "2026-02", "count": 7 }
          ],
          "myPending": [
            { "apfMngNo": "APF-2026-001", "apfNm": "2026년 전산예산 편성 요청", "rqsDt": "2026-01-10" }
          ]
        }
      }
    ]
  }
}
```

`assets/flow.it-portal.json`:

```json
{
  "baseUrl": "http://localhost:3002",
  "flows": [
    {
      "id": "budget-write",
      "title": "예산 작성",
      "mocks": ["common", "budgetPeriod", "projects", "costs"],
      "steps": [
        {
          "id": "type-select",
          "url": "/budget",
          "waitFor": { "role": "heading", "name": "경상사업" },
          "caption": "작성할 예산 유형을 고릅니다",
          "notes": [
            "좌측 메뉴에서 [예산]을 클릭합니다",
            "정보화사업·전산업무비·경상사업 중 해당 유형을 고릅니다",
            "카드를 클릭하면 작성 폼이 열립니다"
          ]
        },
        {
          "id": "project-form",
          "url": "/info/projects/form",
          "waitFor": { "selector": "form, .p-card" },
          "caption": "사업 내용을 입력합니다",
          "notes": [
            "사업명과 사업 유형을 입력합니다",
            "예산 항목별 금액을 채웁니다",
            "[저장]을 누르면 목록에 반영됩니다"
          ]
        },
        {
          "id": "budget-list",
          "url": "/budget/list",
          "waitFor": { "text": "차세대 여신심사 시스템 구축" },
          "caption": "작성 결과를 확인합니다",
          "notes": [
            "작성한 항목이 통합 목록에 나타납니다",
            "연도 선택으로 대상 예산년도를 바꿀 수 있습니다"
          ]
        }
      ]
    },
    {
      "id": "budget-approval",
      "title": "예산 결재신청",
      "mocks": ["common", "budgetPeriod", "projects", "costs"],
      "steps": [
        {
          "id": "approval-target",
          "url": "/budget/approval",
          "waitFor": { "role": "heading", "name": "결재 상신", "exact": true },
          "caption": "상신할 항목을 고릅니다",
          "notes": [
            "미상신 항목만 선택할 수 있습니다",
            "체크박스로 여러 건을 함께 고릅니다",
            "이미 결재가 진행 중인 항목은 선택되지 않습니다"
          ]
        },
        {
          "id": "approval-report",
          "url": "/budget/report",
          "waitFor": { "selector": "iframe, .p-card" },
          "caption": "보고서를 확인하고 결재라인을 지정합니다",
          "notes": [
            "선택한 항목으로 신청서가 자동 생성됩니다",
            "팀장과 부서장을 직원 검색으로 지정합니다",
            "[결재 상신]을 누르면 전자결재로 넘어갑니다"
          ]
        }
      ]
    },
    {
      "id": "approval",
      "title": "전자결재",
      "mocks": ["common", "approvals"],
      "steps": [
        {
          "id": "approval-home",
          "url": "/approval",
          "waitFor": { "selector": ".p-card, main" },
          "caption": "결재 현황을 한눈에 봅니다",
          "notes": [
            "결재 대기·진행 중·당월 완료·반려 건수를 보여줍니다",
            "월별 결재 완료 추이를 최근 6개월치로 확인합니다",
            "내 결재 대기 목록에서 바로 상세로 이동합니다"
          ]
        },
        {
          "id": "approval-list",
          "url": "/approval/list",
          "waitFor": { "text": "2026년 전산예산 편성 요청" },
          "caption": "결재 문서를 처리합니다",
          "notes": [
            "내 차례인 건만 체크박스가 활성화됩니다",
            "행의 [승인]·[반려]로 단건 처리합니다",
            "여러 건을 골라 [일괄 결재]로 한 번에 처리합니다"
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: 캡처 스크립트를 쓴다**

```javascript
// scripts/capture_screens.mjs
/**
 * flow.json의 화면 흐름을 순회하며 스크린샷을 뜬다.
 *
 * it_frontend의 playwright를 라이브러리로 빌려 쓸 뿐, 그 저장소에는 파일을 추가하지 않는다.
 * API는 전부 mock으로 가로채므로 백엔드·DB·SSO 없이 결정적으로 동작한다.
 *
 * 사용법:
 *   node scripts/capture_screens.mjs --flow assets/flow.it-portal.json --out shots
 *   node scripts/capture_screens.mjs --flow assets/flow.it-portal.json --flow-id budget-write
 */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const FRONTEND = 'C:/it/it_frontend';
const require = createRequire(path.join(FRONTEND, 'package.json'));
const { chromium } = require('playwright');

const VIEWPORT = { width: 1600, height: 900 };

/** 인자를 --key value 형태로 파싱한다. */
function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i += 2) {
        out[argv[i].replace(/^--/, '')] = argv[i + 1];
    }
    return out;
}

/** 프리셋 목록을 순서대로 page.route에 등록한다.
 *  Playwright는 나중에 등록한 라우트를 먼저 검사하므로 구체적인 경로를 뒤에 둔다. */
async function applyMocks(page, fixtures, presetNames) {
    for (const name of presetNames) {
        const preset = fixtures.presets[name];
        if (!preset) throw new Error(`알 수 없는 mock 프리셋: ${name}`);
        for (const { url, body } of preset) {
            await page.route(`**${url}*`, (route) =>
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify(body),
                }),
            );
        }
    }
    // SSO 리다이렉트가 외부로 새지 않게 막는다
    await page.route(/\/sso\//, (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }),
    );
}

/** 로그인 상태를 쿠키와 localStorage로 주입한다. */
async function injectLogin(context, baseUrl, user) {
    await context.addCookies([
        {
            name: 'it-portal-user',
            value: encodeURIComponent(JSON.stringify(user)),
            url: baseUrl,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
            expires: Math.floor(Date.now() / 1000) + 3600,
        },
    ]);
    await context.addInitScript((u) => {
        localStorage.setItem('user', JSON.stringify(u));
    }, user);
}

/** step의 waitFor 조건을 기다린다. 조건이 없으면 networkidle만 기다린다. */
async function waitForStep(page, waitFor) {
    if (!waitFor) return;
    if (waitFor.role) {
        await page
            .getByRole(waitFor.role, { name: waitFor.name, exact: waitFor.exact ?? false })
            .first()
            .waitFor({ state: 'visible', timeout: 30000 });
    } else if (waitFor.text) {
        await page.getByText(waitFor.text).first().waitFor({ state: 'visible', timeout: 30000 });
    } else if (waitFor.selector) {
        await page.locator(waitFor.selector).first().waitFor({ state: 'visible', timeout: 30000 });
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const flowPath = path.resolve(args.flow ?? 'assets/flow.it-portal.json');
    const outDir = path.resolve(args.out ?? 'shots');
    const only = args['flow-id'];

    const flowDoc = JSON.parse(await fs.readFile(flowPath, 'utf-8'));
    const fixtures = JSON.parse(
        await fs.readFile(path.join(path.dirname(flowPath), 'capture-fixtures.json'), 'utf-8'),
    );
    const baseUrl = flowDoc.baseUrl;

    // dev 서버가 떠 있는지 먼저 확인한다. 안 떠 있으면 30초씩 기다릴 이유가 없다.
    try {
        await fetch(baseUrl, { signal: AbortSignal.timeout(3000) });
    } catch {
        console.error(`dev 서버에 접속할 수 없습니다: ${baseUrl}`);
        console.error('  cd C:/it/it_frontend && npm run dev');
        process.exit(2);
    }

    const browser = await chromium.launch();
    const manifest = [];

    for (const flow of flowDoc.flows) {
        if (only && flow.id !== only) continue;
        const flowDir = path.join(outDir, flow.id);
        await fs.mkdir(flowDir, { recursive: true });

        const context = await browser.newContext({
            viewport: VIEWPORT,
            deviceScaleFactor: 2,
            locale: 'ko-KR',
        });
        await injectLogin(context, baseUrl, fixtures.user);
        const page = await context.newPage();
        await applyMocks(page, fixtures, flow.mocks ?? ['common']);

        for (const [i, step] of flow.steps.entries()) {
            const file = path.join(flowDir, `${String(i + 1).padStart(2, '0')}-${step.id}.png`);
            let failed = false;
            try {
                await page.goto(baseUrl + step.url, { waitUntil: 'networkidle', timeout: 60000 });
                await waitForStep(page, step.waitFor);
                const target = step.clipSelector ? page.locator(step.clipSelector).first() : page;
                await target.screenshot({ path: file });
                console.log(`  ok  ${flow.id}/${step.id}`);
            } catch (err) {
                failed = true;
                console.error(`  FAIL ${flow.id}/${step.id}: ${err.message}`);
            }
            manifest.push({
                flow: flow.id,
                flowTitle: flow.title,
                step: step.id,
                caption: step.caption,
                notes: step.notes ?? [],
                file: path.relative(outDir, file).replace(/\\/g, '/'),
                width: VIEWPORT.width * 2,
                height: VIEWPORT.height * 2,
                capturedAt: new Date().toISOString(),
                failed,
            });
        }
        await context.close();
    }

    await browser.close();
    await fs.writeFile(
        path.join(outDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8',
    );

    const failures = manifest.filter((m) => m.failed);
    console.log(`캡처 ${manifest.length}건 중 실패 ${failures.length}건`);
    process.exit(failures.length ? 1 : 0);
}

main();
```

- [ ] **Step 3: dev 서버를 띄우고 캡처를 돌린다**

먼저 dev 서버를 별도 창에서 띄운다.

```bash
cd C:/it/it_frontend && npm run dev
```

그 다음 캡처한다.

```bash
cd "C:/it/.claude/skills/writing-user-guide-pptx"
node scripts/capture_screens.mjs --flow assets/flow.it-portal.json --out shots
```

Expected: `캡처 8건 중 실패 0건`

실패가 나오면 `waitFor` 조건이 실제 화면과 맞지 않는 것이다.
해당 화면을 브라우저로 직접 열어 확인한 뒤 `flow.it-portal.json`의 `waitFor`를 고친다.
`networkidle`이 정착하지 않아 타임아웃이 나면 mock이 빠진 API가 있는 것이므로,
`page.on('request')`로 실제로 나가는 요청을 찍어 확인한다.

- [ ] **Step 4: 캡처 결과를 눈으로 확인한다**

```bash
cd "C:/it/.claude/skills/writing-user-guide-pptx"
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -c "import json; m=json.load(open('shots/manifest.json',encoding='utf-8')); [print(r['flow'], r['step'], r['file'], 'FAILED' if r['failed'] else '') for r in m]"
```

`shots/` 아래 PNG를 하나씩 열어 로그인 화면이나 빈 화면이 찍히지 않았는지 확인한다.
로그인 화면이 찍혔으면 `injectLogin`의 쿠키 주입이 먹지 않은 것이다.

- [ ] **Step 5: 커밋한다**

`shots/`는 산출물이므로 커밋하지 않는다. `.gitignore`에 추가한다.

```bash
cd C:/it
echo ".claude/skills/writing-user-guide-pptx/shots/" >> .gitignore
git add .gitignore .claude/skills/writing-user-guide-pptx/scripts/capture_screens.mjs .claude/skills/writing-user-guide-pptx/assets/capture-fixtures.json .claude/skills/writing-user-guide-pptx/assets/flow.it-portal.json
git commit -m "feat(guide-pptx): Playwright 화면 캡처 추가"
```

---

### Task 10: 전체 파이프라인 실행과 SKILL.md

**Files:**
- Create: `.claude/skills/writing-user-guide-pptx/SKILL.md`
- Create: `.claude/skills/writing-user-guide-pptx/references/it-portal-flows.md`
- Create: `.claude/skills/writing-user-guide-pptx/references/ooxml-notes.md`
- Create: `.claude/skills/writing-user-guide-pptx/assets/deck.it-portal.json`

**Interfaces:**
- Consumes: Task 1~9의 모든 산출물
- Produces: 실행 가능한 스킬 + 실제 가이드 PPT 1부

- [ ] **Step 1: `deck.it-portal.json`을 만든다**

`shots/manifest.json`의 8개 step을 `screen` 슬라이드로, 앞뒤에 `pattern` 슬라이드를 붙인다.
템플릿 슬라이드 번호는 `references/template-catalog.md`에서 고른다.

구성:

| # | 유형 | 내용 |
| --- | --- | --- |
| 1 | pattern | 표지 (B slide1) |
| 2 | pattern | 목차 (B slide2) |
| 3 | pattern | 전체 흐름 요약 — 카탈로그에서 `프로세스형` 중 열 3개짜리 |
| 4 | pattern | 간지 "예산 작성" (B slide6 또는 `간지` 분류 중 하나) |
| 5~7 | screen | budget-write 3단계 |
| 8 | pattern | 간지 "예산 결재신청" |
| 9~10 | screen | budget-approval 2단계 |
| 11 | pattern | 간지 "전자결재" |
| 12~13 | screen | approval 2단계 |
| 14 | pattern | 자주 묻는 질문 — `N분할형` 중 하나 |
| 15 | pattern | 종지 (`종지` 분류) |

`screen` 슬라이드의 `title`은 흐름 제목, `caption`과 `steps`는 `manifest.json`의
`caption`·`notes`를 그대로 옮긴다. `badge`는 흐름 안에서의 순번(`01`, `02`, ...)이다.

골격은 아래 형태다. `?`로 표시한 슬라이드 번호는 Step 1의 문구 확인 명령으로 정한다.

```json
{
  "output": "IT Portal 사용자 가이드.pptx",
  "slides": [
    {
      "type": "pattern",
      "from": { "template": "B", "slide": 1 },
      "text": {
        "템플릿 디자인": "IT Project Portal 사용자 가이드",
        "부제목을 입력해주세요": "예산 작성부터 전자결재까지",
        "한국산업은행": "한국산업은행"
      }
    },
    {
      "type": "pattern",
      "from": { "template": "B", "slide": 2 },
      "text": {
        "내용을 입력해주세요": "예산 작성",
        "내용을 입력해주세요#2": "예산 결재신청",
        "내용을 입력해주세요#3": "전자결재"
      }
    },
    {
      "type": "screen",
      "badge": "01",
      "title": "예산 작성",
      "caption": "작성할 예산 유형을 고릅니다",
      "shot": "shots/budget-write/01-type-select.png",
      "steps": [
        "좌측 메뉴에서 [예산]을 클릭합니다",
        "정보화사업·전산업무비·경상사업 중 해당 유형을 고릅니다",
        "카드를 클릭하면 작성 폼이 열립니다"
      ]
    }
  ]
}
```

목차 슬라이드처럼 같은 문구가 6번 반복되는 경우 `문구#N` 색인이 필요하다.
쓰지 않는 항목(`내용을 입력해주세요#4`~`#6`)도 반드시 치환해야 한다.
남겨두면 `verify_deck.py`가 잔여 자리표시자로 잡는다.
빈 문자열로 지우는 대신 실제 내용을 넣거나, 항목이 적은 목차 슬라이드를 카탈로그에서 다시 고른다.

간지 슬라이드 등의 치환 키는 아래로 실제 문구를 확인해 정한다.

```bash
cd "C:/it/.claude/skills/writing-user-guide-pptx"
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -c "import sys,json; sys.path.insert(0,'scripts'); from oox.package import Package; from oox.text import iter_paragraphs, paragraph_text; p=Package.open(r'C:\it\sample\템플릿 1번 B(다이어그램용).pptx'); n=int(sys.argv[1]); r=p.read_xml('ppt/slides/slide%d.xml'%n); print(json.dumps([paragraph_text(x) for x in iter_paragraphs(r) if paragraph_text(x).strip()], ensure_ascii=False, indent=1))" 6
```

- [ ] **Step 2: 빌드하고 검증한다**

```bash
cd "C:/it/.claude/skills/writing-user-guide-pptx"
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" scripts/build_deck.py --deck assets/deck.it-portal.json --out "IT Portal 사용자 가이드.pptx"
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" scripts/verify_deck.py "IT Portal 사용자 가이드.pptx" --expect-slides 15
```

Expected: `검증 통과`

검증이 실패하면 문제 목록의 항목별로 고친다.
`잔여 자리표시자`가 나오면 해당 슬라이드의 치환 키가 빠진 것이므로,
Step 1의 문구 확인 명령으로 실제 문구를 다시 뽑아 `deck.it-portal.json`에 추가한다.

- [ ] **Step 3: PPT 뷰어로 눈으로 확인한다**

산출된 `IT Portal 사용자 가이드.pptx`를 뷰어로 열어 아래를 확인한다.

- 표지·간지·종지의 KDB 디자인이 원본과 같은가
- 화면 캡처의 UI 글자가 읽히는가
- 단계 설명이 캡처를 가리지 않는가
- 번호 말풍선이 의도한 위치에 있는가
- 글꼴이 `KDB고딕M_Pro`로 나오는가

PowerPoint와 LibreOffice가 없어 이 단계는 자동화할 수 없다. 사람이 확인해야 한다.
어긋난 항목이 있으면 `SHOT_BOX_CM`·`NOTES_BOX_CM` 상수나 `deck.it-portal.json`의 좌표를 조정하고 Step 2를 다시 돌린다.

- [ ] **Step 4: SKILL.md와 참조 문서를 쓴다**

`SKILL.md` 프론트매터:

```markdown
---
name: writing-user-guide-pptx
description: Use when creating a user guide, manual, or training deck as a PowerPoint file for the IT Portal web service, or when asked to make a 사용자 가이드 PPT from web screens using the KDB template
---
```

본문에 담을 것:

- 개요 — 템플릿 슬라이드를 복제해 채우는 방식이지 처음부터 그리는 방식이 아니라는 점
- 4단계 파이프라인과 각 단계의 실행 명령
- `deck.json` 스키마 요약과 `pattern`/`screen` 두 유형의 차이
- 빠른 참조 표: 상수(`SCREEN_BASE_SLIDE`, 좌표), 스크립트별 CLI
- 흔한 실수:
  - 그림 자리표시자에 화면 캡처를 넣으려는 시도 → 대부분 세로형 사진용이라 글자가 안 읽힌다
  - 미디어를 이름으로 병합 → 내용이 다른 동명 파일이 417개라 이미지가 뒤바뀐다
  - 런 단위 텍스트 치환 → 대제목이 두 런으로 쪼개져 있어 매칭되지 않는다
  - `verify_deck.py`를 건너뛰고 배포 → 자리표시자가 남은 채로 나간다
- 체크리스트

`references/it-portal-flows.md`에는 spec §2.6 표를 옮기고, 각 화면의 파일 경로
(`app/pages/budget/approval.vue` 등)를 함께 적는다. 화면이 바뀌면 여기부터 고친다.

`references/ooxml-notes.md`에는 구현하면서 실제로 부딪힌 함정을 적는다. 최소한 아래 5개:

1. `ET.register_namespace`를 임포트 시점에 호출하지 않으면 `ns0:` 접두어가 붙어 PowerPoint가 파일을 거부한다
2. `presentation.xml`의 자식 순서는 `sldMasterIdLst` → `sldIdLst` → `sldSz`를 지켜야 한다
3. 레이아웃을 붙일 때 마스터의 `sldLayoutIdLst`에도 등록해야 인식된다
4. 자리표시자 도형은 직계 `<a:xfrm>`이 없어 `shape_bbox`가 `None`을 돌려준다
5. `[Content_Types].xml`에 확장자 `Default`가 없으면 그 미디어는 무시된다

- [ ] **Step 5: 전체 테스트를 돌리고 커밋한다**

```bash
cd "C:/it/.claude/skills/writing-user-guide-pptx"
"C:/Users/KDB/AppData/Local/Programs/Python/Python311/python.exe" -m unittest discover -s tests -v
```

Expected: PASS — 51 tests (Task 1~8 합계)

```bash
cd C:/it
git add .claude/skills/writing-user-guide-pptx/SKILL.md .claude/skills/writing-user-guide-pptx/references/it-portal-flows.md .claude/skills/writing-user-guide-pptx/references/ooxml-notes.md .claude/skills/writing-user-guide-pptx/assets/deck.it-portal.json
git commit -m "feat(guide-pptx): SKILL.md와 IT Portal 덱 정의 추가"
```

---

## 완료 기준

1. `python -m unittest discover -s tests`가 전부 통과한다
2. `node scripts/capture_screens.mjs`가 실패 0건으로 8장을 뜬다
3. `python scripts/build_deck.py --deck assets/deck.it-portal.json`이 15장짜리 pptx를 만든다
4. `python scripts/verify_deck.py`가 문제 0건으로 통과한다
5. 산출물을 PPT 뷰어로 열었을 때 KDB 디자인이 유지되고 화면 캡처의 글자가 읽힌다
6. `SKILL.md`의 `description`이 "Use when..."으로 시작하고 워크플로를 요약하지 않는다
