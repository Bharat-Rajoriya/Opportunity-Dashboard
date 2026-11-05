/** Recovery coordinator helpers for backend n8n glue. No API calls or retries. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateLease(payload, nowMs = Date.now()) {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || row.granted !== true || !UUID.test(String(row.lease_token ?? ''))) {
    return { allowed: false, reason: row?.reason || 'missing_or_invalid_claim', token: null };
  }
  const until = Date.parse(row.retry_after || '');
  if (!Number.isFinite(until) || until <= nowMs) {
    return { allowed: false, reason: 'expired_lease', token: null };
  }
  return { allowed: true, reason: 'granted', token: row.lease_token, leaseUntilMs: until };
}

export function decideProbe(claim, queries, nowMs = Date.now(), timeoutMs = 15000) {
  const lease = validateLease(claim, nowMs);
  const first = Array.isArray(queries) ? queries[0] : undefined;
  if (!lease.allowed) return { authorized: false, reason: lease.reason };
  if (!first || typeof first.search_query !== 'string' || !first.search_query.trim()) {
    return { authorized: false, reason: 'missing_query' };
  }
  if (timeoutMs <= 0 || nowMs + timeoutMs >= lease.leaseUntilMs) {
    return { authorized: false, reason: 'insufficient_lease_time' };
  }
  return { authorized: true, reason: 'one_query_only', token: lease.token, query: first, timeoutMs };
}

export function classifyResponse(response, transportError = null) {
  const raw = response?.statusCode ?? response?.status ?? response?.error?.httpCode ?? transportError?.statusCode;
  const numeric = Number(raw);
  const httpStatus = Number.isInteger(numeric) && numeric >= 100 && numeric <= 599 ? numeric : null;
  const message = String(response?.error?.message ?? transportError?.message ?? response?.message ?? '').toLowerCase();
  // A missing, empty, or malformed provider response is NOT evidence of recovery.
  // Success requires an explicit 2xx status or a recognized SerpApi result envelope.
  const providerStatus = response?.search_metadata?.status;
  const providerRejected = typeof providerStatus === 'string' &&
    providerStatus.toLowerCase() !== 'success';
  const hasEnvelope = Boolean(
    response && typeof response === 'object' && !Array.isArray(response) &&
    (String(providerStatus || '').toLowerCase() === 'success' ||
      Array.isArray(response.organic_results))
  );
  const explicitSuccess = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
  const failed = Boolean(transportError || response?.error || providerRejected ||
    (httpStatus !== null && httpStatus >= 400) || (!explicitSuccess && !hasEnvelope));
  if (!failed) return { success: true, httpStatus, category: null, failureCode: null };
  const quota = /quota exhausted|monthly limit reached|credits? exhausted|no searches left/.test(message);
  const rate = httpStatus === 429 || /too many requests|rate.?limit|throttl/.test(message);
  return {
    success: false,
    httpStatus,
    category: quota ? 'quota' : rate ? 'rate_limit' : [401,403].includes(httpStatus) ? 'auth'
      : /timeout|timed out|econnreset|network/.test(message) ? 'timeout'
      : httpStatus !== null && httpStatus >= 500 ? 'upstream' : 'unknown',
    failureCode: quota || rate ? 429 : httpStatus ?? 503,
  };
}

export function completionRequest(provider, token, outcome) {
  if (typeof provider !== 'string' || !provider.trim() || !UUID.test(String(token || ''))) {
    throw new Error('Valid provider and lease token required');
  }
  if (typeof outcome?.success !== 'boolean') throw new Error('Classified result required');
  return {
    p_provider: provider,
    p_lease_token: token,
    p_success: outcome.success,
    ...(!outcome.success ? { p_failure_code: outcome.failureCode ?? 503 } : {}),
  };
}

export function sanitizedEvent(provider, source, workspaceId, executionId, outcome) {
  if (typeof outcome?.success !== 'boolean') throw new Error('Classified result required');
  return {
    provider, source, workspace_id: workspaceId || null, master_execution_id: executionId || null,
    request_kind: 'recovery_probe', outcome: outcome.success ? 'success' : 'failed',
    http_status: outcome.httpStatus, error_category: outcome.category,
  };
}
