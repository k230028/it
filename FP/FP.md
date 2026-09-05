# 정통법 기능점수 산정 워크플로우

기능점수 산정 지침과 분류 기준은 프로젝트 공용 스킬 [fp](../.agents/skills/fp/SKILL.md)로 이전했습니다.

산정 로직의 SoT는 `FP/lib/`, 리포트 진입점은 `FP/generate-report.mjs`, 보고용 아티팩트 진입점은 `FP/build-artifact.mjs`입니다. 단가·보정계수·이윤·부가세는 문서에 복제하지 않고 `FP/lib/config.mjs`를 확인하십시오.
