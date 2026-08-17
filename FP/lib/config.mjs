/**
 * 보정계수·단가 설정 (전부 대표 가정값).
 *
 * ⚠️ 실제 제안·예산 산정 시 해당 연도 고시 「소프트웨어사업 대가산정 가이드」의
 *    보정계수표와 FP당 단가로 반드시 교체하십시오. 이 파일만 고치면 리포트
 *    (generate-report.mjs)와 보고 아티팩트(build-artifact.mjs)가 함께 갱신됩니다.
 */
export const CONFIG = {
  factors: [
    { label: '규모 보정계수', value: 0.94, basis: '1,000 FP 이상 대규모 구간 (규모↑ → 단위생산성↑ → 계수↓)' },
    { label: '애플리케이션 유형 보정', value: 1.0, basis: '업무용 웹/DB 표준 애플리케이션' },
    { label: '언어 보정계수', value: 1.0, basis: 'Java / JavaScript 표준' },
    { label: '품질·특성 보정계수', value: 1.06, basis: '보안(JWT·RBAC·감사로그)·신뢰성 요건 반영' },
    { label: '다중 사이트 보정', value: 1.0, basis: '단일 운영 사이트' },
  ],
  unitPrice: 600_000, // 원/FP (보정 전 개발원가 단가)
  profitRate: 0.2, // 이윤 20%
  vatRate: 0.1, // 부가세 10%
};

/**
 * UFP에 보정계수·단가·이윤·부가세를 적용해 금액 산식을 전개합니다.
 * @param {number} ufp 미조정 기능점수
 * @param {typeof CONFIG} config 보정계수·단가 설정
 * @returns {{factor:number, adjustedFp:number, devCost:number, profit:number, supply:number, vat:number, total:number}}
 */
export function computeCost(ufp, config = CONFIG) {
  const factor = config.factors.reduce((acc, f) => acc * f.value, 1);
  const adjustedFp = ufp * factor;
  const devCost = adjustedFp * config.unitPrice;
  const profit = devCost * config.profitRate;
  const supply = devCost + profit;
  const vat = supply * config.vatRate;
  return { factor, adjustedFp, devCost, profit, supply, vat, total: supply + vat };
}
