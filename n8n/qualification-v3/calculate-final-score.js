const context =
  $('Build Final Scoring Context').item.json || {};

const opportunity =
  context.opportunity || {};

const ai = $json.output || {};
const recoveryOnly = $('Scoring Run Context').first().json.recovery_only === true;

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const clamp = (value, min, max) => {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return min;
  }

  return Math.min(Math.max(num, min), max);
};

const round2 = (value) => {
  return Math.round(value * 100) / 100;
};

// --------------------------------------------------
// RAW AI FIT VALUES — EACH 0 TO 10
// --------------------------------------------------

const serviceFit = clamp(ai.service_fit_score, 0, 10);
const matchData = opportunity.raw_payload?.service_match || {};
const rawMatchLevel = String(matchData.level || 'legacy').toLowerCase();
const matchEvidence = String(matchData.evidence || '').trim();
const matchReason = String(matchData.reason || '').trim();
// Do not accept an "exact" label with no buyer-supported evidence.
const serviceMatchLevel = rawMatchLevel === 'exact' && !matchEvidence
  ? 'related' : rawMatchLevel;

const industryFit = clamp(ai.industry_fit_score, 0, 10);
const geographicFit = clamp(ai.geographic_fit_score, 0, 10);
const clientQuality = clamp(ai.client_quality_score, 0, 10);
const portfolioRelevance = clamp(
  ai.portfolio_relevance_score,
  0,
  10
);

const aiConfidence = clamp(ai.confidence, 0, 1);

// --------------------------------------------------
// 1. SERVICE MATCH — MAX 25
// --------------------------------------------------

const modelServiceScore = Math.round(serviceFit * 2.5);
const serviceMatchScore = serviceMatchLevel === 'related'
  ? Math.min(modelServiceScore, 10)
  : serviceMatchLevel === 'unsupported'
    ? 0 : modelServiceScore;

// --------------------------------------------------
// 2. BUYING INTENT — MAX 25
// intent_level is 0–5
// --------------------------------------------------

const intentLevel = clamp(
  opportunity.intent_level ?? 0,
  0,
  5
);

const intentScore = Math.round(
  intentLevel * 5
);

// --------------------------------------------------
// 3. PROJECT VALUE — MAX 10
// Preserve existing research score when available.
// If value is unknown, use a neutral score instead
// of pretending the project has no value.
// --------------------------------------------------

const existingProjectValueScore =
  Number(opportunity.project_value_score);

let projectValueScore = 5;

if (
  Number.isFinite(existingProjectValueScore) &&
  existingProjectValueScore > 0
) {
  projectValueScore = clamp(
    existingProjectValueScore,
    0,
    10
  );
} else {
  const hasBudgetEvidence =
    (opportunity.budget_text &&
      String(opportunity.budget_text).trim() !== '') ||
    opportunity.estimated_value_min != null ||
    opportunity.estimated_value_max != null;

  if (hasBudgetEvidence) {
    projectValueScore = 7;
  }
}

// --------------------------------------------------
// 4. FRESHNESS — MAX 10
// Preserve previous score if research already
// calculated one.
// --------------------------------------------------

const existingFreshness =
  Number(opportunity.freshness_score);

let freshnessScore = 4; // Unknown date = neutral-low

if (
  Number.isFinite(existingFreshness) &&
  existingFreshness > 0
) {
  freshnessScore = clamp(existingFreshness, 0, 10);
} else if (opportunity.published_at) {
  const published = new Date(opportunity.published_at);

  if (!Number.isNaN(published.getTime())) {
    const ageHours =
      (Date.now() - published.getTime()) /
      (1000 * 60 * 60);

    if (ageHours <= 24) {
      freshnessScore = 10;
    } else if (ageHours <= 72) {
      freshnessScore = 8;
    } else if (ageHours <= 168) {
      freshnessScore = 6;
    } else if (ageHours <= 720) {
      freshnessScore = 3;
    } else {
      freshnessScore = 1;
    }
  }
}

// --------------------------------------------------
// 5. CLIENT QUALITY — MAX 10
// --------------------------------------------------

const clientQualityScore = Math.round(
  clientQuality
);

// --------------------------------------------------
// 6. INDUSTRY FIT — MAX 5
// --------------------------------------------------

const industryFitScore = Math.round(
  industryFit / 2
);

// --------------------------------------------------
// 7. GEOGRAPHIC FIT — MAX 5
// --------------------------------------------------

const geographicFitScore = Math.round(
  geographicFit / 2
);

// --------------------------------------------------
// 8. PORTFOLIO RELEVANCE — MAX 10
// --------------------------------------------------

const portfolioRelevanceScore = Math.round(
  portfolioRelevance
);

// --------------------------------------------------
// TOTAL = 100
//
// Service       25
// Intent        25
// Project Value 10
// Freshness     10
// Client        10
// Industry       5
// Geography      5
// Portfolio     10
// --------------------------------------------------

let totalScore = clamp(
  serviceMatchScore +
    intentScore +
    projectValueScore +
    freshnessScore +
    clientQualityScore +
    industryFitScore +
    geographicFitScore +
    portfolioRelevanceScore,
  0,
  100
);

// --------------------------------------------------
// SOURCE QUALITY MODIFIER
//
// Only apply this to opportunities that actually have
// a source-quality assessment. Legacy rows created
// before Opportunity Quality v2 remain unaffected.
// --------------------------------------------------

const sourceResultType =
  String(opportunity.source_result_type || '')
    .trim()
    .toLowerCase();

const sourceQualityReason =
  String(opportunity.source_quality_reason || '')
    .trim();

const buyerLikelihood =
  String(opportunity.buyer_likelihood || '')
    .trim()
    .toLowerCase();

const hasSourceQualityAssessment =
  Boolean(sourceResultType || sourceQualityReason);

const sourceQualityScore = clamp(
  opportunity.source_quality_score ?? 0,
  0,
  10
);

const hardNonBuyerTypes = new Set([
  'provider_marketing',
  'informational_content',
  'directory_or_listing',
  'full_time_job',
  'closed_or_stale',
]);

let sourceQualityPenalty = 0;

if (hasSourceQualityAssessment) {
  if (hardNonBuyerTypes.has(sourceResultType)) {
    sourceQualityPenalty = 40;
  } else if (sourceQualityScore <= 3) {
    sourceQualityPenalty = 25;
  } else if (sourceQualityScore <= 5) {
    sourceQualityPenalty = 15;
  } else if (sourceQualityScore <= 7) {
    sourceQualityPenalty = 5;
  }

  totalScore = clamp(
    totalScore - sourceQualityPenalty,
    0,
    100
  );
}

// --------------------------------------------------
// SCOPE-TO-BUDGET MODIFIER
// --------------------------------------------------

const scopeBudgetFit =
  String(opportunity.scope_budget_fit || 'unknown')
    .trim()
    .toLowerCase();

let scopeBudgetPenalty = 0;

if (scopeBudgetFit === 'far_below_scope') {
  scopeBudgetPenalty = 40;
} else if (scopeBudgetFit === 'significantly_below_scope') {
  scopeBudgetPenalty = 25;
} else if (scopeBudgetFit === 'below_scope') {
  scopeBudgetPenalty = 10;
}

totalScore = clamp(
  totalScore - scopeBudgetPenalty,
  0,
  100
);
// Only explicit, buyer-supported service matches may receive top relevance.
if (serviceMatchLevel === 'related') totalScore = Math.min(totalScore, 64);
if (serviceMatchLevel === 'unsupported') totalScore = Math.min(totalScore, 39);

// --------------------------------------------------
// CONFIDENCE
// --------------------------------------------------

const researchConfidence = clamp(
  opportunity.research_confidence ?? 0.5,
  0,
  1
);

const scoreConfidence = round2(
  aiConfidence * 0.7 +
  researchConfidence * 0.3
);

// --------------------------------------------------
// FINAL RECOMMENDED ACTION
//
// IMPORTANT:
// We calculate this ourselves.
// We do NOT trust free-form AI wording here.
// --------------------------------------------------

let recommendedAction = 'skip';

if (totalScore >= 85) {
  recommendedAction = 'high_priority_pitch';
} else if (totalScore >= 70) {
  recommendedAction = 'pitch';
} else if (totalScore >= 55) {
  recommendedAction = 'research';
} else if (totalScore >= 40) {
  recommendedAction = 'review';
}

// Source-quality caps prevent weak discovery evidence
// from becoming an automatic pitch recommendation.
if (hasSourceQualityAssessment) {
  if (
    hardNonBuyerTypes.has(sourceResultType) ||
    buyerLikelihood === 'none'
  ) {
    recommendedAction = 'skip';
  } else if (
    sourceQualityScore <= 4 ||
    buyerLikelihood === 'weak'
  ) {
    if (['high_priority_pitch', 'pitch', 'research'].includes(recommendedAction)) {
      recommendedAction = 'review';
    }
  } else if (
    sourceQualityScore <= 5 &&
    ['high_priority_pitch', 'pitch'].includes(recommendedAction)
  ) {
    recommendedAction = 'research';
  }
}

// Scope-to-budget caps prevent a commercially weak
// large-scope project from being promoted by fit alone.
if (scopeBudgetFit === 'far_below_scope') {
  recommendedAction = 'skip';
} else if (
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

// Never generate automatic pitches for broadly related work.
if (serviceMatchLevel === 'related' &&
    ['high_priority_pitch', 'pitch'].includes(recommendedAction)) {
  recommendedAction = 'research';
}
if (serviceMatchLevel === 'unsupported') recommendedAction = 'skip';

// Recovery never generates an automatic pitch recommendation.
// "skip" remains skip; otherwise the user must review marketplace freshness.
if (recoveryOnly && recommendedAction !== 'skip') recommendedAction = 'review';

// Pricing V3: an hourly ceiling cannot be compared with a minimum total
// project value without a contract duration. No automatic pitches.
if (opportunity.raw_payload?.budget_review?.required === true &&
    recommendedAction !== 'skip') {
  recommendedAction = 'review';
}

const whyRelevant = serviceMatchLevel === 'related'
  ? 'Related service, not an exact match. ' + matchReason +
    (matchEvidence ? ' Buyer evidence: "' + matchEvidence + '".' : '')
  : serviceMatchLevel === 'unsupported'
    ? 'Insufficient supporting evidence for the selected service.'
    : serviceMatchLevel === 'exact'
      ? 'Explicit service evidence: "' + matchEvidence + '". ' +
        String(ai.why_relevant || opportunity.why_relevant || '')
      : String(ai.why_relevant || opportunity.why_relevant || '');

// --------------------------------------------------
// PORTFOLIO
//
// DB field is UUID, so use null instead of ""
// when there is no recommendation.
// --------------------------------------------------

// --------------------------------------------------
// VALIDATE RECOMMENDED PORTFOLIO
// --------------------------------------------------

const portfolioItems =
  context.portfolio_items || [];

const validPortfolioIds = new Set(
  portfolioItems
    .map(item => String(item.id || '').trim())
    .filter(Boolean)
);

const aiRecommendedPortfolioId =
  String(ai.recommended_portfolio_id || '').trim();

const recommendedPortfolioId =
  validPortfolioIds.has(aiRecommendedPortfolioId)
    ? aiRecommendedPortfolioId
    : null;

// --------------------------------------------------
// RETURN
// --------------------------------------------------

return {
  json: {
    ...opportunity,

    service_match_score: serviceMatchScore,
    intent_score: intentScore,
    project_value_score: projectValueScore,
    freshness_score: freshnessScore,
    client_quality_score: clientQualityScore,
    industry_fit_score: industryFitScore,
    geographic_fit_score: geographicFitScore,
    portfolio_relevance_score:
      portfolioRelevanceScore,

    total_score: Math.round(totalScore),

    why_relevant: recoveryOnly
      ? 'Recovered from stalled research; confirm the original listing is still active before outreach. ' + whyRelevant
      : whyRelevant,

    recommended_portfolio_id:
      recommendedPortfolioId,

    portfolio_match_reason:
      ai.portfolio_match_reason || '',

    recommended_action:
      recommendedAction,

    score_confidence:
      serviceMatchLevel === 'related' ? Math.min(scoreConfidence, 0.65) : scoreConfidence,

    source_quality_score:
      sourceQualityScore,

    source_quality_penalty:
      sourceQualityPenalty,

    scope_budget_fit:
      scopeBudgetFit,

    scope_budget_penalty:
      scopeBudgetPenalty,

    source_result_type:
      sourceResultType || null,

    buyer_likelihood:
      buyerLikelihood || null,

    score_stage: 'final',

    final_scored_at:
      new Date().toISOString(),

    ai_fit_analysis: ai,
  },
};