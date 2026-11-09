import { useCallback, useEffect, useState } from 'react'
import { ClipboardPlus, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react'
import { generateOnboardingCopy } from '../services/opportunityEngine'
import { validateCaptureDraft } from '../lib/manualCaptureValidation'
import { listManualCaptures, saveManualCapture, setManualCaptureStatus, submitManualCaptureForQualification, qualifyManualCapture, recordManualSourceReview, verifyManualFreelancerSource, recoverStalledManualCapture } from '../services/manualCaptures'
import './QuickCapturePanel.css'

export default function QuickCapturePanel({ workspaceId, opportunities = [] }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [requirement, setRequirement] = useState('')
  const [preview, setPreview] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [queueCheckedAt, setQueueCheckedAt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDraft, setAiDraft] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setRecords(await listManualCaptures(workspaceId)) }
    catch (err) { setError(err?.message || 'Could not load manual captures.') }
    finally { setQueueCheckedAt(Date.now()); setLoading(false) }
  }, [workspaceId])

  useEffect(() => { void load() }, [load])

  const improveDescription = async () => {
    if (aiLoading || saving) return
    setError('')
    setNotice('')
    setAiDraft('')
    if (title.trim().length < 4 || requirement.trim().length < 20) {
      setError('Add a project title and at least 20 characters of your own public-project notes before using AI.')
      return
    }
    setAiLoading(true)
    try {
      // No URL is sent and no source is fetched. Rewrite only user-provided text.
      const result = await generateOnboardingCopy({
        workspaceId,
        fieldType: 'manual_capture_description',
        roughText: requirement.trim(),
        context: { project_title: title.trim() },
      })
      const candidate = String(result.generated_text || '').trim()
      if (candidate.length < 20 || candidate.length > 5000)
        throw new Error('The AI draft was outside the accepted description length. Your original notes were preserved.')
      setAiDraft(candidate)
      setNotice('AI suggested a rewrite from your notes. Inspect the draft and choose whether to use it.')
    } catch (err) {
      setError(err?.message || 'AI could not improve the description. Your original notes were preserved.')
    } finally { setAiLoading(false) }
  }

  const reviewDraft = event => {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      const result = validateCaptureDraft({ url, title, requirement })
      setPreview(result)
    } catch (err) { setPreview(null); setError(err?.message || 'Please review your inputs.') }
  }

  const save = async () => {
    if (!preview || saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      // Revalidate on confirm: never assume an earlier preview is proof of a real buyer.
      const created = await saveManualCapture(workspaceId, previewToDraft(preview), opportunities)
      setRecords(existing => [created, ...existing])
      setPreview(null); setUrl(''); setTitle(''); setRequirement(''); setAiDraft(''); setOpen(false)
      setNotice('Saved for manual review. This is not yet a scored opportunity.')
    } catch (err) { setError(err?.message || 'Could not save this link.') }
    finally { setSaving(false) }
  }

  const submitForQualification = async record => {
    if (saving || record.status !== 'needs_review') return
    const approved = window.confirm(
      'Queue this reviewed link for optional AI qualification? Nothing is scored or added to Opportunities until you explicitly run AI qualification. No outreach will be sent.'
    )
    if (!approved) return
    setSaving(true); setError(''); setNotice('')
    try {
      const updated = await submitManualCaptureForQualification(workspaceId, record.id)
      setRecords(rows => rows.map(row => row.id === record.id ? updated : row))
      setNotice('Saved to the qualification queue. Select Run AI qualification when you want to assess this capture.')
    } catch (err) {
      setError(err?.message || 'Unable to submit this capture.')
    } finally {
      setSaving(false)
    }
  }

  const runAiQualification = async record => {
    if (saving || record.status !== 'pending_qualification') return
    const approved = window.confirm(
      'Run AI qualification for this unverified public project? This uses AI processing. Source identity and project freshness are NOT independently verified. Any accepted lead will require manual review, and no outreach is sent.'
    )
    if (!approved) return
    setSaving(true); setError(''); setNotice('')
    try {
      const outcome = await qualifyManualCapture(workspaceId, record.id)
      await load()
      setNotice(outcome.status === 'qualified'
        ? 'AI triage accepted the request for manual review. The lead is marked unverified in Opportunities; no outreach was started.'
        : outcome.status === 'duplicate'
          ? 'This project is already in Opportunities. No duplicate was created.'
          : 'AI triage rejected this request. Review the recorded reason below.')
    } catch (err) {
      await load()
      setError(err?.message || 'AI qualification did not complete. Check the saved status.')
    } finally {
      setSaving(false)
    }
  }

  const reviewSource = async (record, status) => {
    if (saving || record.status !== 'qualified') return
    const note = window.prompt(
      status === 'unclear'
        ? 'Why is the project status unclear? Add at least 10 characters.'
        : 'Optional note about what you observed on the original page (no private contact details):',
      record.source_review_note || ''
    )
    if (note === null) return
    const approved = window.confirm(
      'Record only what you personally observed? This does NOT independently verify the buyer or project and will NOT change the lead score or start outreach.'
    )
    if (!approved) return
    setSaving(true); setError(''); setNotice('')
    try {
      const updated = await recordManualSourceReview(workspaceId, record.id, status, note)
      setRecords(rows => rows.map(row => row.id === record.id ? updated : row))
      setNotice('Your observation was saved. The project remains unverified and requires further research.')
    } catch (err) { setError(err?.message || 'Unable to save source observation.') }
    finally { setSaving(false) }
  }

  const verifyFreelancerListing = async record => {
    if (saving || record.status !== 'qualified' || record.source_platform !== 'freelancer') return
    if (!window.confirm('Check this listing through the official Freelancer API? This confirms only listing existence, not buyer identity, payment, or project availability. No outreach will start.')) return
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await verifyManualFreelancerSource(workspaceId, record.id)
      await load()
      setNotice(result.message || 'Freelancer listing returned by the official provider API.')
    } catch (err) {
      await load()
      setError(err?.message || 'Could not verify this Freelancer listing.')
    } finally { setSaving(false) }
  }

  const resolveStalledCapture = async record => {
    if (saving || record.status !== 'qualifying') return
    if (!window.confirm('Mark this expired AI qualification as failed? This does not retry AI, create an opportunity, or send outreach.')) return
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await recoverStalledManualCapture(workspaceId, record.id)
      await load()
      setNotice(result.message)
    } catch (err) {
      await load()
      setError(err?.message || 'Unable to resolve stalled qualification.')
    } finally { setSaving(false) }
  }

  const changeStatus = async (id, status) => {
    if (saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      const updated = await setManualCaptureStatus(workspaceId, id, status)
      setRecords(rows => rows.map(row => row.id === id ? updated : row))
    } catch (err) { setError(err?.message || 'Unable to update capture status.') }
    finally { setSaving(false) }
  }

  return <section className="quick-capture" aria-label="Quick Capture manual review">
    <div className="quick-capture-head">
      <div>
        <h3><ClipboardPlus size={18} aria-hidden="true" /> Quick Capture</h3>
        <p>Found a client project elsewhere? Save a public URL and your notes to a private review queue.</p>
      </div>
      <button type="button" onClick={() => { setOpen(value => !value); setPreview(null); setAiDraft(''); setError('') }} aria-expanded={open}>
        {open ? 'Close form' : 'Add a project link'}
      </button>
    </div>
    <p className="quick-capture-explain"><ShieldAlert size={15} aria-hidden="true" />
      Manual capture does not scrape URLs, verify the buyer, score a lead, or trigger a provider search.
      Submitted links can be assessed on demand by AI using your business services. Source content is not fetched or independently verified. Accepted leads require manual review; no automated outreach.
    </p>
    {open && <form className="quick-capture-form" onSubmit={reviewDraft}>
      <label>Public project link
        <input type="url" required disabled={aiLoading} maxLength={2000} value={url} onChange={e => { setUrl(e.target.value); setPreview(null); setAiDraft('') }}
          placeholder="https://www.freelancer.com/projects/..." autoComplete="url" />
      </label>
      <label>Project title
        <input type="text" required disabled={aiLoading} minLength={4} maxLength={180} value={title} onChange={e => { setTitle(e.target.value); setPreview(null); setAiDraft('') }}
          placeholder="e.g. WordPress website maintenance" />
      </label>
      <label>Buyer requirement / why it matters
        <textarea required disabled={aiLoading} minLength={20} maxLength={5000} rows={3} value={requirement}
          onChange={e => { setRequirement(e.target.value); setPreview(null); setAiDraft('') }}
          placeholder="Paste a brief public project description. Do not include private contact information." />
      </label>
      <div className="quick-capture-ai-assist">
        <button type="button" disabled={aiLoading || saving || !workspaceId || title.trim().length < 4 || requirement.trim().length < 20}
          onClick={() => void improveDescription()}>
          <Sparkles size={14} aria-hidden="true" /> {aiLoading ? 'Improving…' : 'Improve description with AI'}
        </button>
        <span className="quick-capture-ai-hint">Rewrites only the notes above. Does not open the link or verify its contents.</span>
      </div>
      {aiDraft && <div className="quick-capture-ai-draft" aria-label="AI suggested description">
        <strong>Suggested description — review before using</strong>
        <p>{aiDraft}</p>
        <button type="button" disabled={aiLoading || saving} onClick={() => {
          setRequirement(aiDraft); setAiDraft(''); setPreview(null);
          setNotice('AI wording inserted. Review factual accuracy before saving.')
        }}>Use this draft</button>
        <button type="button" disabled={aiLoading || saving} onClick={() => setAiDraft('')}>Discard draft</button>
      </div>}
      <button type="submit" disabled={aiLoading || saving}>Review capture</button>
    </form>}
    {preview && open && <div className="quick-capture-preview">
      <strong>Confirm before saving</strong>
      <p><b>Project:</b> {preview.title}</p>
      <p><b>Source:</b> {preview.source_platform}</p>
      <p><b>Description:</b> {preview.requirement}</p>
      <a href={preview.source_url} target="_blank" rel="noopener noreferrer">Inspect original link <ExternalLink size={14} aria-hidden="true" /></a>
      <button type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save to review queue'}</button>
    </div>}
    {error && <p className="quick-capture-error" role="alert">{error}</p>}
    {notice && <p className="quick-capture-success" role="status">{notice}</p>}
    <div className="quick-capture-list">
      <div className="quick-capture-list-title"><strong>Review queue</strong>
        <span>{records.filter(r => r.status === 'needs_review').length} awaiting review · {records.filter(r => r.status === 'pending_qualification').length} ready for AI triage</span>
      </div>
      {loading ? <p role="status">Loading captured links…</p> : records.length === 0
        ? <p>No captured links yet.</p>
        : records.map(record => <article key={record.id}>
          <div><strong>{record.title}</strong>
            <span>{record.source_platform} · {({ dismissed: 'Dismissed', pending_qualification: 'Ready for AI triage', qualifying: 'AI triage in progress', qualified: 'Accepted — manual review needed', rejected: 'Rejected by AI triage', duplicate: 'Already in Opportunities', failed: 'AI triage failed' })[record.status] || 'Needs review'}</span>
            <p>{record.requirement}</p>
            {record.qualification_reason && <p className="quick-capture-qualification-reason">Qualification: {record.qualification_reason}</p>}
            {record.status === 'qualified' && record.source_platform === 'freelancer' &&
              <p className="quick-capture-qualification-reason">
                Freelancer API: {record.provider_check_status === 'listing_confirmed'
                  ? 'Listing returned by official provider API'
                  : 'Not independently checked'}.
                {record.provider_checked_at && <> Checked {new Date(record.provider_checked_at).toLocaleString()}.</>}
                {record.provider_check_evidence?.provider_status && <> Provider status: {record.provider_check_evidence.provider_status}.</>}
                {' '}Buyer identity, payment and current availability are not verified.
              </p>}
            {record.status === 'qualified' && <p className="quick-capture-qualification-reason">
              Source review: {({
                not_reviewed: 'Not reviewed', appears_open: 'Appeared open when checked',
                unavailable: 'Unavailable when checked', unclear: 'Unclear — needs research',
              })[record.source_review_status] || 'Not reviewed'}.
              {record.source_reviewed_at && <> Checked {new Date(record.source_reviewed_at).toLocaleString()}.</>}
              {record.source_review_note && <> Note: {record.source_review_note}</>}
              {' '}Human observation only — buyer and authenticity still unverified.
            </p>}
            <a href={record.source_url} target="_blank" rel="noopener noreferrer">Open source <ExternalLink size={13} aria-hidden="true" /></a>
          </div>
          <div className="quick-capture-row-actions">
            {record.status === 'needs_review' && <button type="button" disabled={saving}
              onClick={() => void submitForQualification(record)}>Submit for qualification</button>}
            {['needs_review', 'dismissed'].includes(record.status) && <button type="button" disabled={saving}
              onClick={() => void changeStatus(record.id,record.status === 'dismissed' ? 'needs_review' : 'dismissed')}>
              {record.status === 'dismissed' ? 'Restore' : 'Dismiss'}
            </button>}
            {record.status === 'pending_qualification' && <button type="button" disabled={saving}
              onClick={() => void runAiQualification(record)}>
              {saving ? 'Processing…' : 'Run AI qualification'}
            </button>}
            {record.status === 'qualifying' && <small>AI processing started. Refresh the queue to see the result.</small>}
            {record.status === 'qualifying' && record.qualification_started_at &&
              queueCheckedAt - new Date(record.qualification_started_at).getTime() > 180000 &&
              <button type="button" disabled={saving} onClick={() => void resolveStalledCapture(record)}>
                Resolve stalled run
              </button>}
            {record.status === 'qualified' && <small>Added to Opportunities for source verification and review. No outreach was sent.</small>}
            {record.status === 'qualified' && record.source_platform === 'freelancer' &&
              <button type="button" disabled={saving} onClick={() => void verifyFreelancerListing(record)}>
                {saving ? 'Checking…' : 'Check via Freelancer API'}
              </button>}
            {record.status === 'qualified' && <div className="quick-capture-row-actions" aria-label="Record what you observed on original source">
              <button type="button" disabled={saving} onClick={() => void reviewSource(record, 'appears_open')}>Appeared open</button>
              <button type="button" disabled={saving} onClick={() => void reviewSource(record, 'unavailable')}>Unavailable</button>
              <button type="button" disabled={saving} onClick={() => void reviewSource(record, 'unclear')}>Unclear</button>
            </div>}
            {record.status === 'rejected' && <small>No opportunity was created.</small>}
            {record.status === 'duplicate' && <small>Existing opportunity retained. No duplicate was created.</small>}
            {record.status === 'failed' && <small>AI processing failed. No automatic retry is scheduled.</small>}
          </div>
        </article>)}
    </div>
  </section>
}

function previewToDraft(preview) {
  return { url: preview.source_url, title: preview.title, requirement: preview.requirement }
}
