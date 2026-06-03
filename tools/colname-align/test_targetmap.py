import unittest
from targetmap import build_target_map

class TestTargetMap(unittest.TestCase):
    def test_default_camel(self):
        pairs = [("ABUS_MNG_NO", "prjMngNo"), ("PRJ_NM", "prjNm")]
        self.assertEqual(build_target_map("Bprojm", pairs, {}),
                         {"prjMngNo": "abusMngNo"})

    def test_collision_override(self):
        pairs = [("BG_NO", "itMngcNo"), ("TOT_XP_AMT", "itMngcBgAmt")]
        override = {"Bcostm": {"BG_NO": "costBgNo", "TOT_XP_AMT": "costTotXpAmt"}}
        self.assertEqual(
            build_target_map("Bcostm", pairs, override),
            {"itMngcNo": "costBgNo", "itMngcBgAmt": "costTotXpAmt"},
        )

    def test_override_equal_target_still_renamed(self):
        pairs = [("BG_NO", "bgMngNo")]
        override = {"Bbugtm": {"BG_NO": "bgNo"}}
        self.assertEqual(build_target_map("Bbugtm", pairs, override),
                         {"bgMngNo": "bgNo"})

if __name__ == "__main__":
    unittest.main()
