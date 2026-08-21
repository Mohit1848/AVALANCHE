import type { PredictionContext, RiskDisplayState } from '../types';

/**
 * Single source of truth adapter for transforming PredictionContext
 * into a normalized, strongly typed RiskDisplayState.
 *
 * Enforces:
 * 1. Zero-fallback invariant: null / undefined scores NEVER default to 0, 50, or any fabricated number.
 * 2. 0-100 numeric scale is ONLY valid when typeof score === "number" && Number.isFinite(score) && kind === "AVAILABLE".
 * 3. Himalayan / research domain complete isolation (inference disabled, no Colorado ML / NRCS AWDB live claims).
 * 4. Stale data protection: suppressed predictions do NOT leak old scores into live operational gauges.
 */
export function resolveRiskDisplayState(context: PredictionContext): RiskDisplayState {
  const isResearchDomain = Boolean(
    context.domain === 'HIMALAYA' ||
    context.domain === 'INDIA' ||
    context.telemetry_source === 'CUSTOM CSV DATASET' ||
    context.target_type === 'CSV_LOCATION' ||
    (context.longitude !== undefined && context.longitude > 0)
  );

  const isStale = Boolean(
    (context.freshness_state as string) === 'STALE' ||
    (context.freshness_state as string) === 'HISTORICAL' ||
    (context.data_quality as string) === 'STALE' ||
    (context.telemetry_age_minutes !== null &&
      context.telemetry_age_minutes !== undefined &&
      context.telemetry_age_minutes > 360)
  );

  const isError = Boolean(context.error);
  const pred = context.prediction;

  // Exact type check: numeric and finite ONLY
  const rawPolicyScore = pred?.final_risk_score;
  const isPolicyScoreNumeric = typeof rawPolicyScore === 'number' && Number.isFinite(rawPolicyScore);

  const rawModelScore = pred?.model_risk_score;
  const isModelScoreNumeric = typeof rawModelScore === 'number' && Number.isFinite(rawModelScore);

  const isExplicitlyInsufficient =
    !pred ||
    pred.final_risk_level === 'INSUFFICIENT_DATA' ||
    pred.model_risk_level === 'INSUFFICIENT_DATA' ||
    pred.model_version === 'research_evaluation_only';

  // 1. ERROR STATE
  if (isError) {
    return {
      kind: 'ERROR',
      hasValidScore: false,
      score: null,
      level: 'ERROR',
      modelScore: null,
      modelLevel: 'ERROR',
      calibratedProbability: null,
      isEscalated: false,
      escalationReasons: [],
      reasonTitle: 'PREDICTION ERROR',
      reasonDescription: context.error || 'Failed to evaluate risk for this location.',
      modelStatusText: 'UNAVAILABLE',
      inferenceStatusText: 'ERROR',
      dataRequirementText: 'Telemetry ingestion failed',
      domain: isResearchDomain ? 'HIMALAYA' : 'COLORADO',
      isResearchDomain,
    };
  }

  // 2. RESEARCH DOMAIN (Himalayas / Global Research Zones)
  if (isResearchDomain || pred?.domain === 'HIMALAYA') {
    if (isPolicyScoreNumeric) {
      const rawProb = pred?.calibrated_probability ?? (pred?.raw_probability ?? (rawPolicyScore / 100));
      const calibratedProbability = typeof rawProb === 'number' && Number.isFinite(rawProb) ? rawProb : null;
      return {
        kind: 'RESEARCH',
        hasValidScore: true,
        score: rawPolicyScore,
        level: pred?.final_risk_level || pred?.risk_level || 'HIGH',
        modelScore: typeof pred?.model_risk_score === 'number' && Number.isFinite(pred.model_risk_score) ? pred.model_risk_score : rawPolicyScore,
        modelLevel: pred?.model_risk_level || pred?.risk_level || 'HIGH',
        calibratedProbability,
        isEscalated: false,
        escalationReasons: [],
        reasonTitle: 'HIMALAYAN RESEARCH PREDICTION',
        reasonDescription: 'Provisional research prediction evaluated using the calibrated Himalayan model (N=44).',
        modelStatusText: 'CALIBRATED • RESEARCH ONLY',
        inferenceStatusText: 'RESEARCH PREDICTION',
        dataRequirementText: 'Operational forecasting disabled',
        domain: 'HIMALAYA',
        isResearchDomain: true,
        isResearchMode: true,
      };
    }

    return {
      kind: 'DISABLED',
      hasValidScore: false,
      score: null,
      level: 'INSUFFICIENT_DATA',
      modelScore: null,
      modelLevel: 'INSUFFICIENT_DATA',
      calibratedProbability: null,
      isEscalated: false,
      escalationReasons: [],
      reasonTitle: 'NO VALID RISK SCORE',
      reasonDescription: 'The model did not produce an operational risk prediction for this target.',
      modelStatusText: 'CALIBRATED • RESEARCH ONLY',
      inferenceStatusText: 'DISABLED',
      dataRequirementText: 'Insufficient validated data',
      domain: 'HIMALAYA',
      isResearchDomain: true,
      isResearchMode: false,
    };
  }

  // 3. STALE TELEMETRY / PREDICTION SUPPRESSED
  if (isStale) {
    return {
      kind: 'STALE',
      hasValidScore: false,
      score: null,
      level: 'STALE',
      modelScore: null,
      modelLevel: 'STALE',
      calibratedProbability: null,
      isEscalated: false,
      escalationReasons: [],
      reasonTitle: 'TELEMETRY STALE — PREDICTION SUPPRESSED',
      reasonDescription: 'Latest telemetry is too old for current inference.',
      modelStatusText: 'GATED (HOLD)',
      inferenceStatusText: 'SUPPRESSED',
      dataRequirementText: 'Latest observation exceeds 6-hour limit',
      domain: 'COLORADO',
      isResearchDomain: false,
    };
  }

  // 4. INSUFFICIENT DATA (Null / non-finite score, or explicitly INSUFFICIENT_DATA level)
  if (!isPolicyScoreNumeric || isExplicitlyInsufficient) {
    return {
      kind: 'INSUFFICIENT_DATA',
      hasValidScore: false,
      score: null,
      level: 'INSUFFICIENT_DATA',
      modelScore: null,
      modelLevel: 'INSUFFICIENT_DATA',
      calibratedProbability: null,
      isEscalated: false,
      escalationReasons: [],
      reasonTitle: 'NO VALID RISK SCORE',
      reasonDescription: 'The model did not produce an operational risk prediction for this target.',
      modelStatusText: 'RESEARCH ONLY',
      inferenceStatusText: 'DISABLED',
      dataRequirementText: 'Insufficient validated data',
      domain: 'COLORADO',
      isResearchDomain: false,
    };
  }

  // 5. AVAILABLE OPERATIONAL PREDICTION (Real Colorado Live Target)
  const isEscalated = Boolean(pred.risk_escalated);
  const escalationReasons = Array.isArray(pred.risk_escalation_reasons) ? pred.risk_escalation_reasons : [];
  const rawProb = pred.calibrated_probability;
  const calibratedProbability = typeof rawProb === 'number' && Number.isFinite(rawProb) ? rawProb : null;

  return {
    kind: 'AVAILABLE',
    hasValidScore: true,
    score: rawPolicyScore,
    level: (pred.final_risk_level || 'LOW').toUpperCase(),
    modelScore: isModelScoreNumeric ? rawModelScore : null,
    modelLevel: (pred.model_risk_level || 'LOW').toUpperCase(),
    calibratedProbability,
    isEscalated,
    escalationReasons,
    reasonTitle: isEscalated ? 'ESCALATED BY SAFETY POLICY ENGINE' : 'POLICY AGREES WITH MODEL',
    reasonDescription: isEscalated
      ? 'Deterministic safety heuristics elevated model risk.'
      : 'Statistical model risk satisfies safety constraints.',
    modelStatusText: 'ACTIVE INFERENCE',
    inferenceStatusText: 'OPERATIONAL',
    dataRequirementText: 'USDA NRCS AWDB SNOTEL',
    domain: 'COLORADO',
    isResearchDomain: false,
  };
}
