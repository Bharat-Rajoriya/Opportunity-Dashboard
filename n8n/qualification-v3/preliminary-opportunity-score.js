const item = $json;

const clamp = (value, min, max) => {
  return Math.min(Math.max(Number(value) || 0, min), max);
};

const normalize = (value) => {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
};

const intentLevel = clamp(
  item.intent_level ??
  item.ai_intent_level ??
  item.intent_classification?.intent_level ??
  0,
  0,
  5
);

const intentScore = Math.round(intentLevel * 9);

const confidence = clamp(item.ai_confidence, 0, 1);
const confidenceScore = Math.round(confidence * 15);

const serviceMatchLevel = String(item.service_match_level || 'unsupported').toLowerCase();
const serviceScore = serviceMatchLevel === 'exact' ? 20 :
  serviceMatchLevel === 'related' ? 8 : 0;

const countryMatch = normalize(item.target_country_match);

let countryScore = 5;

if (
  [
    'true',
    'yes',
    'match',
    'matched',
    'target',
    'target_country',
    'strong_match',
  ].includes(countryMatch)
) {
  countryScore = 10;
}

if (
  [
    'false',
    'no',
    'not_match',
    'not_matched',
    'outside_target',
    'mismatch',
  ].includes(countryMatch)
) {
  countryScore = 0;
}

const position = Number(item.position || 999);

let positionScore = 2;

if (position <= 3) {
  positionScore = 10;
} else if (position <= 5) {
  positionScore = 8;
} else if (position <= 10) {
  positionScore = 5;
}

let preliminaryScore =
  intentScore +
  confidenceScore +
  serviceScore +
  countryScore +
  positionScore;

const sourceQuality = clamp(
  item.source_quality_score ?? 0,
  0,
  10
);

let sourceQualityPenalty = 0;

if (sourceQuality <= 3) {
  sourceQualityPenalty = -25;
} else if (sourceQuality <= 5) {
  sourceQualityPenalty = -15;
} else if (sourceQuality <= 7) {
  sourceQualityPenalty = -5;
}

preliminaryScore += sourceQualityPenalty;

const commercialFit = String(
  item.commercial_fit || 'unknown'
).trim().toLowerCase();

let commercialValuePenalty = 0;

if (commercialFit === 'far_below_minimum') {
  commercialValuePenalty = -30;
} else if (commercialFit === 'below_minimum') {
  commercialValuePenalty = -15;
}

preliminaryScore += commercialValuePenalty;

const scopeBudgetFit = String(
  item.scope_budget_fit || 'unknown'
).trim().toLowerCase();

let scopeBudgetPenalty = 0;

if (scopeBudgetFit === 'significantly_below_scope') {
  scopeBudgetPenalty = -25;
} else if (scopeBudgetFit === 'below_scope') {
  scopeBudgetPenalty = -10;
}

preliminaryScore += scopeBudgetPenalty;

preliminaryScore = clamp(
  Math.round(preliminaryScore),
  0,
  100
);
if (serviceMatchLevel === 'related') preliminaryScore = Math.min(preliminaryScore, 60);
if (serviceMatchLevel === 'unsupported') preliminaryScore = 0;

if (
  item.ai_is_opportunity !== true ||
  item.ai_rejection_rule_triggered === true
) {
  preliminaryScore = 0;
}

let recommendedAction = 'review';

if (preliminaryScore >= 80) {
  recommendedAction = 'high_priority_pitch';
} else if (preliminaryScore >= 65) {
  recommendedAction = 'pitch';
} else if (preliminaryScore >= 50) {
  recommendedAction = 'research';
}

if (
  scopeBudgetFit === 'significantly_below_scope' &&
  ['high_priority_pitch', 'pitch'].includes(recommendedAction)
) {
  recommendedAction = 'research';
} else if (
  scopeBudgetFit === 'below_scope' &&
  recommendedAction === 'high_priority_pitch'
) {
  recommendedAction = 'pitch';
}

// Rate-only listings may represent substantial work, but no total value is proven.
// Keep them review-only regardless of a high relevance score.
if (item.budget_review_required === true && recommendedAction !== 'skip') {
  recommendedAction = 'review';
}

return {
  json: {
    ...item,
    intent_level: intentLevel,
    ai_intent_level: intentLevel,
    preliminary_score: preliminaryScore,
    score_stage: 'preliminary',
    recommended_action: recommendedAction,
    preliminary_score_breakdown: {
      intent: {
        value: intentLevel,
        points: intentScore,
        max: 45,
      },
      confidence: {
        value: confidence,
        points: confidenceScore,
        max: 15,
      },
      service_match: {
        service_id: item.matched_service_id || '',
        service_name: item.matched_service_name || '',
        points: serviceScore,
        max: 20,
        level: serviceMatchLevel,
        evidence: item.service_match_evidence || '',
        reason: item.service_match_reason || '',
      },
      country_fit: {
        value: item.target_country_match || 'unknown',
        points: countryScore,
        max: 10,
      },
      search_position: {
        value: position,
        points: positionScore,
        max: 10,
      },
      source_quality: {
        value: sourceQuality,
        buyer_likelihood: item.buyer_likelihood || 'none',
        source_result_type: item.source_result_type || 'unknown',
        penalty: sourceQualityPenalty,
      },
      commercial_value: {
        fit: commercialFit,
        unit: item.budget_unit || 'project',
        review_required: item.budget_review_required === true,
        budget_fit_ratio: item.budget_fit_ratio ?? null,
        matched_service_min_value:
          item.matched_service_min_value ?? null,
        matched_service_currency:
          item.matched_service_currency || null,
        normalized_budget_max:
          item.normalized_budget_max ?? null,
        penalty: commercialValuePenalty,
        reason: item.commercial_value_reason || '',
      },
      scope_budget_fit: {
        scope_complexity:
          item.scope_complexity || 'unknown',
        scope_multiplier:
          item.scope_multiplier ?? 1,
        scope_adjusted_min_value:
          item.scope_adjusted_min_value ?? null,
        fit: scopeBudgetFit,
        ratio:
          item.scope_budget_fit_ratio ?? null,
        penalty: scopeBudgetPenalty,
        reason:
          item.scope_budget_fit_reason || '',
      },
    },
  },
};