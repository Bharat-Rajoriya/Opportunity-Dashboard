const item = $json;

// --------------------------------------------------
// WORKSPACE
// --------------------------------------------------

const workspaceId =
  item.workspace_id ||
  item.discovery_context?.workspace_id ||
  '';

if (!workspaceId) {
  throw new Error('Prepare Database Record: workspace_id is missing.');
}

// --------------------------------------------------
// NORMALIZE SOURCE URL FOR DEDUPLICATION
// --------------------------------------------------

const sourceUrl = String(item.source_url || '').trim();

let fingerprint = sourceUrl
  .toLowerCase()
  .replace(/^https?:\/\/(www\.)?/, '')
  .replace(/[?#].*$/, '')
  .replace(/\/$/, '');

// Fallback in the rare case a search result has no URL.
if (!fingerprint) {
  fingerprint = [
    item.source || 'unknown',
    item.title || '',
  ]
    .join(':')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

// --------------------------------------------------
// SERVICE MATCH
// --------------------------------------------------

const matchedServiceId =
  item.matched_service_id ||
  item.recommended_service_id ||
  item.service_id ||
  null;

const matchedServiceName =
  item.matched_service_name ||
  item.recommended_service_name ||
  item.service_name ||
  '';

// --------------------------------------------------
// SCORE
// --------------------------------------------------

const preliminaryScore =
  Number(item.preliminary_score ?? 0);

const persistedIntentLevel = Math.max(
  1,
  Math.min(4, Number(item.intent_level ?? item.ai_intent_level ?? 1) || 1)
);

// --------------------------------------------------
// RETURN NORMALIZED RECORD
// --------------------------------------------------

return {
  json: {
    ...item,

    // Multi-workspace
    workspace_id: workspaceId,

    master_execution_id:
      item.master_execution_id ||
      item.discovery_context?.master_execution_id ||
      null,

    // Deduplication
    fingerprint,

    // Keep original AI service fields
    matched_service_id: matchedServiceId,
    matched_service_name: matchedServiceName,

    // Compatibility for downstream V1 nodes/database mapping
    service_id: matchedServiceId,
    service_name: matchedServiceName,
    recommended_service_id: matchedServiceId,
    recommended_service_name: matchedServiceName,

    // Scoring
    intent_level: persistedIntentLevel,
    preliminary_score: preliminaryScore,
    score_stage: item.score_stage || 'preliminary',

    recommended_action:
      item.recommended_action || 'review',

    // New discovery enters the CRM as new.
    status: 'new',

    // Compact snapshot useful for debugging/auditing later.
    raw_payload: {
      search_query: item.search_query || '',
      search_profile_id: item.search_profile_id || null,

      source: item.source || '',
      source_url: sourceUrl,
      title: item.title || '',
      snippet: item.snippet || '',

      ai: {
        is_opportunity:
          item.ai_is_opportunity ?? false,

        intent_level:
          item.ai_intent_level ?? 0,

        confidence:
          item.ai_confidence ?? 0,

        buyer_type:
          item.ai_buyer_type || 'unknown',

        opportunity_type:
          item.ai_opportunity_type || 'unknown',

        target_country_match:
          item.ai_target_country_match ||
          item.target_country_match ||
          'unknown',

        source_result_type:
          item.source_result_type || 'unknown',

        source_quality_score:
          Number(item.source_quality_score ?? 0),

        buyer_likelihood:
          item.buyer_likelihood || 'none',

        source_quality_reason:
          item.source_quality_reason || '',

        matched_service_id: matchedServiceId,

        matched_service_name:
          matchedServiceName,

        reason:
          item.ai_reason || '',
      },

      preliminary_score: preliminaryScore,
      // Persist a cautious commercial-fit warning into the CRM record.
      budget_review: {
        required: item.budget_review_required === true,
        unit: item.budget_unit || 'project',
        fit: item.commercial_fit || 'unknown',
        reason: item.commercial_value_reason || '',
        hourly_max: item.budget_unit === 'hour' ? Number(item.estimated_value_max || 0) : null,
        currency: item.estimated_currency || null,
        total_project_budget_verified: item.budget_unit !== 'hour',
      },
      service_match: {
        level: item.service_match_level || 'unsupported',
        evidence: item.service_match_evidence || '',
        reason: item.service_match_reason || '',
        matched_service_id: matchedServiceId,
        matched_service_name: matchedServiceName
      },
      preliminary_score_breakdown:
        item.preliminary_score_breakdown || {},
    },
  },
};