import unittest
from scan_runtime_refs import find_refs

class TestScan(unittest.TestCase):
    def test_derived_query_incl_findallby(self):
        src = (
            'Optional<Bprojm> findByPrjMngNoAndDelYn(String a, String b);\n'
            'List<Bprojm> findAllByPrjMngNoInAndDelYn(Collection<String> c, String d);\n'
            'boolean existsByPrjMngNoAndDelYn(String a, String b);\n'
        )
        hits = find_refs(src, ["prjMngNo"])
        kinds = sorted({h[0] for h in hits})
        self.assertIn("derived-query", kinds)
        self.assertEqual(len(hits), 3)

    def test_jpql_property_path(self):
        src = '@Query("SELECT p FROM Bprojm p WHERE p.prjMngNo = :id")\n'
        hits = find_refs(src, ["prjMngNo"])
        self.assertEqual([h[0] for h in hits], ["jpql-path"])

    def test_native_query_excluded(self):
        src = '@Query(value = "UPDATE T SET X=1 WHERE C=:prjMngNo", nativeQuery = true)\n'
        self.assertEqual(find_refs(src, ["prjMngNo"]), [])

    def test_sort_string(self):
        src = 'Sort.by("prjMngNo").descending();\n'
        hits = find_refs(src, ["prjMngNo"])
        self.assertEqual([h[0] for h in hits], ["sort-string"])

if __name__ == "__main__":
    unittest.main()
