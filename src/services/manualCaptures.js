import { supabase } from '../lib/supabase'
import { validateCaptureDraft, normalizeCaptureUrl } from '../lib/manualCaptureValidation'

const FIELDS = 'id,workspace_id,source_url,title,requirement,source_platform,status,created_at,submitted_for_qualification_at'

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
