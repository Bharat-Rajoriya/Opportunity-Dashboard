import { supabase } from '../lib/supabase'
import { validateCaptureDraft, normalizeCaptureUrl } from '../lib/manualCaptureValidation'

const FIELDS = 'id,workspace_id,source_url,title,requirement,source_platform,status,created_at,submitted_for_qualification_at,qualification_started_at,qualification_finished_at,qualification_attempts,qualification_reason,qualified_opportunity_id,source_review_status,source_review_note,source_reviewed_at,provider_check_status,provider_checked_at,provider_check_evidence'

export async function listManualCaptures(workspaceId) {
  if (!workspaceId) throw new Error('Choose a workspace first.')
  const { data, error } = await supabase.from('manual_capture_reviews')
    .select(FIELDS).eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return data || []
}

export async function saveManualCapture(workspaceId, draft, existingOpportunities = []) {
  if (!workspaceId) throw new Error('Choose a workspace first.')
  const value = validateCaptureDraft(draft)
  // Convenience warning, not the database's authoritative duplicate check.
  const exists = existingOpportunities.some(item => {
    try { return normalizeExistingUrl(item.source_url) === value.source_url } catch { return false }
  })
  if (exists) throw new Error('This source URL is already in your opportunity list. Open it there instead.')
  const { data, error } = await supabase.from('manual_capture_reviews')
    .insert({ workspace_id: workspaceId, ...value }).select(FIELDS).single()
  if (error) {
    if (error.code === '23505') throw new Error('This URL is already in your Quick Capture review queue.')
    throw error
  }
  return data
}

function normalizeExistingUrl(url) {
  return normalizeCaptureUrl(url)
}

export async function setManualCaptureStatus(workspaceId, id, status) {
  if (!workspaceId || !id || !['needs_review', 'dismissed'].includes(status)) throw new Error('Invalid capture update.')
  const { data, error } = await supabase.from('manual_capture_reviews')
    .update({ status }).eq('workspace_id', workspaceId).eq('id', id).select(FIELDS).single()
  if (error) throw error
  return data
}

/**
 * User-authorized handoff only. The database checks workspace ownership,
 * enforces one transition and blocks duplicate URLs already in Opportunities.
 * No AI call or opportunity row creation occurs here.
 */
export async function submitManualCaptureForQualification(workspaceId, captureId) {
  if (!workspaceId || !captureId) throw new Error('Choose a workspace and captured link.')
  const { data, error } = await supabase.rpc('submit_manual_capture_for_qualification', {
    p_workspace_id: workspaceId,
    p_capture_id: captureId,
  })
  if (error) {
    if (String(error.message || '').includes('already_captured_opportunity')) {
      throw new Error('This project already exists in Opportunities. No duplicate was queued.')
    }
    if (String(error.message || '').includes('capture_not_reviewable')) {
      throw new Error('This item is no longer awaiting review. Refresh the queue.')
    }
    if (String(error.message || '').includes('capture_not_found') || String(error.message || '').includes('workspace_not_authorized')) {
      throw new Error('This capture cannot be accessed in the current workspace.')
    }
    throw error
  }
  if (!data || data.status !== 'pending_qualification' || data.workspace_id !== workspaceId || data.id !== captureId) {
    throw new Error('Qualification handoff was not confirmed. Refresh before retrying.')
  }
  return data
}

/**
 * Starts one explicitly approved manual capture's AI triage through the
 * authenticated Edge Function. The returned score never implies source verification.
 */
export async function qualifyManualCapture(workspaceId, captureId) {
  if (!workspaceId || !captureId) throw new Error('Select a workspace and capture first.')
  const { data, error } = await supabase.functions.invoke('qualify-manual-capture', {
    body: { workspace_id: workspaceId, capture_id: captureId },
  })
  if (error) {
    let message = ''
    try { message = (await error.context?.json?.())?.message || '' } catch { /* network error */ }
    throw new Error(message || 'AI qualification did not finish. Check the review queue before retrying.')
  }
  if (!data?.success || !['qualified','rejected','duplicate'].includes(data?.status)) {
    throw new Error(data?.message || 'AI qualification outcome was not confirmed.')
  }
  return data
}

/**
 * Stores only what the signed-in workspace owner observed when opening a
 * source URL. This is NOT independent provider verification.
 */
export async function recordManualSourceReview(workspaceId, captureId, status, note = '') {
  if (!workspaceId || !captureId || !['appears_open', 'unavailable', 'unclear'].includes(status)) {
    throw new Error('Choose a valid source review outcome.')
  }
  const trimmed = note.trim()
  if (trimmed.length > 1000 || (status === 'unclear' && trimmed.length < 10)) {
    throw new Error('For unclear sources, add a note of at least 10 characters (maximum 1000).')
  }
  const { data, error } = await supabase.rpc('record_manual_capture_source_review', {
    p_workspace_id: workspaceId, p_capture_id: captureId,
    p_status: status, p_note: trimmed || null,
  })
  if (error) throw error
  if (!data || data.id !== captureId || data.workspace_id !== workspaceId) {
    throw new Error('Source observation was not confirmed.')
  }
  return data
}

/**
 * Explicit read-only official provider lookup for eligible Freelancer captures.
 * Confirms a listing was returned, not the buyer identity or payment.
 */
export async function verifyManualFreelancerSource(workspaceId, captureId) {
  if (!workspaceId || !captureId) throw new Error('Select a capture and workspace.')
  const { data, error } = await supabase.functions.invoke('verify-manual-freelancer-source', {
    body: { workspace_id: workspaceId, capture_id: captureId },
  })
  if (error) {
    let message = ''
    try { message = (await error.context?.json?.())?.message || '' } catch { /* network failure */ }
    throw new Error(message || 'Freelancer verification could not be completed.')
  }
  if (!data?.success || data.status !== 'listing_confirmed' ||
    data.buyer_identity_verified !== false || data.payment_verified !== false) {
    throw new Error(data?.message || 'Provider confirmation was not validated.')
  }
  return data
}
