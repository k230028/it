import unittest
from collision import reused_columns


class TestCollision(unittest.TestCase):
    def test_detects_reused(self):
        per_entity = {
            "Bbugtm": [("BG_NO", "bgMngNo"), ("BSE_YY", "bgYy")],
            "Bcostm": [("BG_NO", "itMngcNo"), ("TOT_XP_AMT", "itMngcBgAmt")],
            "Bplanm": [("TOT_XP_AMT", "mngc"), ("BSE_YY", "plnYy")],
        }
        result = reused_columns(per_entity)
        self.assertEqual(result["BG_NO"], ["Bbugtm", "Bcostm"])
        self.assertEqual(result["TOT_XP_AMT"], ["Bcostm", "Bplanm"])
        self.assertEqual(result["BSE_YY"], ["Bbugtm", "Bplanm"])

    def test_unique_excluded(self):
        per_entity = {"A": [("X_C", "x")], "B": [("Y_C", "y")]}
        self.assertEqual(reused_columns(per_entity), {})


if __name__ == "__main__":
    unittest.main()
