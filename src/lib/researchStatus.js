// Human-readable research status without exposing provider credentials or lease data.
const REASONS = {
  company_identity_unverified: {
    label: 'Company not identified',
    description: 'The source does not establish a verifiable buyer or company identity. Web company research was not attempted.',
    tone: 'partial',
  },
  provider_cooldown: {
    label: 'Research provider cooling down',
    description: 'External company research was deferred because the search provider was temporarily unavailable. Source information is still shown.',
    tone: 'partial',
  },
  provider_recovery_denied: {
    label: 'Research temporarily deferred',
    description: 'A recovery attempt was not authorized by the shared provider circuit. No external company search was made.',
    tone: 'partial',
  },
  provider_error: {
    label: 'Research provider error',
    description: 'External company research did not complete. Only source-supported facts are available.',
    tone: 'partial',
  },
  source_only: {
    label: 'Source-only research',
    description: 'Information was extracted from the original listing. External company verification was not completed.',
    tone: 'partial',
  },
  web_research_completed: {
    label: 'Web research completed',
    description: 'External research completed. Check source evidence before relying on company or contact details.',
    tone: 'complete',
  },
};

export function getResearchStatusDetails(opportunity) {
  const status = String(opportunity?.research_status || 'pending').toLowerCase();
  const code = String(opportunity?.research_detail_reason || '').toLowerCase();

  // The stored legacy status has precedence; never present a partial record
  // as complete just because its reason is stale or mismatched.
  if (status === 'complete') {
    return code === 'web_research_completed'
      ? REASONS.web_research_completed
      : { label: 'Research complete', description: 'Research is recorded as complete. Verify original sources before outreach.', tone: 'complete' };
  }
  if (status === 'pending') {
    return { label: 'Research pending', description: 'Enrichment has not completed. Do not assume that buyer details were verified.', tone: 'pending' };
  }
  if (status === 'failed') {
    return { label: 'Research failed', description: 'Research could not be completed. Review the original listing.', tone: 'failed' };
  }
  if (status === 'partial') {
    return code && REASONS[code] && code !== 'web_research_completed'
      ? REASONS[code]
      : { label: 'Source-only research', description: 'Company verification is incomplete; the specific reason was not recorded for this opportunity.', tone: 'partial' };
  }
  return { label: 'Research status unknown', description: 'The research outcome could not be established from the available record.', tone: 'unknown' };
}
