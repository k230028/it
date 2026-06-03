import unittest
from fieldmap import parse_pairs, camel

class TestFieldmap(unittest.TestCase):
    def test_camel_basic(self):
        self.assertEqual(camel("ABUS_MNG_NO"), "abusMngNo")
        self.assertEqual(camel("SVN_DPM_C"), "svnDpmC")
        self.assertEqual(camel("PRLM_HRK_OGZ_C_CONE"), "prlmHrkOgzCCone")

    def test_parse_skips_parens_in_comment(self):
        src = '''
            @Column(name = "TOT_XP_AMT", precision = 18, scale = 3, comment = "일반관리비 (물리컬럼 TOT_XP_AMT=총비용금액)")
            private BigDecimal mngc;
            @Column(name = "BSE_YY", length = 4, comment = "기준연도")
            private String bgYy;
        '''
        pairs = parse_pairs(src)
        self.assertEqual(pairs, [("TOT_XP_AMT", "mngc"), ("BSE_YY", "bgYy")])

    def test_deviations_only(self):
        src = '''
            @Column(name = "PRJ_NM", length = 100, comment = "프로젝트명")
            private String prjNm;
            @Column(name = "ABUS_MNG_NO", length = 30)
            private String prjMngNo;
        '''
        devs = [(c, f, camel(c)) for c, f in parse_pairs(src) if f != camel(c)]
        self.assertEqual(devs, [("ABUS_MNG_NO", "prjMngNo", "abusMngNo")])

if __name__ == "__main__":
    unittest.main()
