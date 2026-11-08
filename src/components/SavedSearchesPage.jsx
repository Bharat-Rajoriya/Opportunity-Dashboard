import { useEffect, useState } from 'react'
import { Bookmark, Search, Trash2, ArrowUpRight } from 'lucide-react'
import { loadSavedSearches, deleteSavedSearch, setInAppDigestFrequency, fetchInAppDigest, markInAppDigestReviewed } from '../services/savedOpportunitySearches'
import './SavedSearchesPage.css'


function InAppDigest({ item, workspaceId, onUpdate }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  const setFrequency = async frequency => {
    if (busy || frequency === item.in_app_digest_frequency) return
    setBusy(true)
    setError('')
    setPreview(null)
    try {
      const updated = await setInAppDigestFrequency(workspaceId, item.id, frequency)
      onUpdate(updated)
    } catch (err) {
      setError(err?.message || 'Could not update in-app digest preference.')
    } finally {
      setBusy(false)
    }
  }

  const loadMatches = async () => {
    if (busy || item.in_app_digest_frequency === 'off') return
    setBusy(true)
    setError('')
    try {
      setPreview(await fetchInAppDigest(workspaceId, item))
    } catch (err) {
      setError(err?.message || 'Could not load digest matches.')
    } finally {
      setBusy(false)
    }
  }

  const markReviewed = async () => {
    if (busy || !preview || preview.truncated) return
    setBusy(true)
    setError('')
    try {
      const updated = await markInAppDigestReviewed(workspaceId, item.id)
      onUpdate(updated)
      setPreview(null)
    } catch (err) {
      setError(err?.message || 'Could not mark the digest reviewed.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="saved-digest">
    <label>In-app digest window
      <select value={item.in_app_digest_frequency || 'off'} disabled={busy}
        onChange={event => void setFrequency(event.target.value)}>
        <option value="off">Off (default)</option>
        <option value="daily">Last 24 hours</option>
        <option value="weekly">Last 7 days</option>
      </select>
    </label>
    {item.in_app_digest_frequency !== 'off' && <>
      <button type="button" disabled={busy} onClick={() => void loadMatches()}>
        {busy ? 'Checking…' : 'Check new matches'}
      </button>
      {preview && <div className="saved-digest-preview" role="status">
        <strong>{preview.matches.length}{preview.truncated ? '+' : ''} matching opportunit{preview.matches.length === 1 ? 'y' : 'ies'}</strong>
        <p>Discovered after {new Date(preview.since).toLocaleString()} in this workspace.</p>
        {preview.truncated && <p role="alert">More than 1,000 recent records were found. This preview is incomplete and cannot be marked reviewed.</p>}
        <ul>{preview.matches.slice(0, 10).map(match => <li key={match.id}>
          {match.source_url ? <a href={match.source_url} rel="noopener noreferrer" target="_blank">{match.title || 'Untitled opportunity'}</a> : (match.title || 'Untitled opportunity')}
          <small>{match.source || 'Unknown source'}</small>
        </li>)}</ul>
        {preview.matches.length > 10 && <p>Showing 10 of {preview.matches.length} matches.</p>}
        <button type="button" onClick={() => void markReviewed()} disabled={busy || preview.truncated}>Mark digest reviewed</button>
      </div>}
    </>}
    <p className="saved-digest-hint">In-app, on-demand only. No scheduled emails, background jobs, or new provider searches. Enabling starts from now.</p>
    {error && <p className="saved-searches-error" role="alert">{error}</p>}
  </div>
}

export default function SavedSearchesPage({ workspaceId, onApply, onOpenSearch }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadSavedSearches(workspaceId).then(data => {
      if (!cancelled) { setItems(data); setLoading(false) }
    }).catch(err => {
      if (!cancelled) { setError(err.message || 'Unable to load saved searches.'); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [workspaceId])

  const remove = async item => {
    if (deletingId || !window.confirm(`Delete saved search "${item.name}"? This will not delete opportunities.`)) return
    setDeletingId(item.id)
    setError('')
    try {
      await deleteSavedSearch(workspaceId, item.id)
      setItems(current => current.filter(row => row.id !== item.id))
    } catch (err) {
      setError(err.message || 'Unable to delete saved search.')
    } finally {
      setDeletingId(null)
    }
  }

  return <section className="saved-searches-page" aria-labelledby="saved-searches-title">
    <div className="saved-searches-head">
      <div><span className="saved-searches-eyebrow">YOUR SEARCH SHORTCUTS</span>
        <h2 id="saved-searches-title">Saved searches</h2>
        <p>Reuse filters on opportunities already collected in this workspace. No scheduled alerts or paid searches are enabled.</p>
      </div>
      <button type="button" className="saved-searches-primary" onClick={onOpenSearch}><Search size={16} aria-hidden="true" /> Explore opportunities</button>
    </div>
    {error && <p className="saved-searches-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading saved searches…</p>
      : items.length === 0 ? <div className="saved-searches-empty"><Bookmark size={24} aria-hidden="true" />
        <strong>No saved searches yet</strong><p>Set your filters in Search, give them a name, and save them for reuse.</p>
        <button type="button" onClick={onOpenSearch}>Open Search</button></div>
        : <div className="saved-searches-list">
          {items.map(item => <article key={item.id} className="saved-searches-item">
            <div className="saved-searches-item-main"><h3>{item.name}</h3>
              <p>{[item.query && `Keywords: ${item.query}`,item.source !== 'all' && `Source: ${item.source}`,
                item.country !== 'all' && `Country: ${item.country}`,item.min_score !== 'all' && `Score: ${item.min_score}+`,
                item.recency !== 'all' && `Posted in last ${item.recency} hours`,
                item.budget_evidence && item.budget_evidence !== 'all' && `Budget: ${item.budget_evidence}`,
                item.project_kind && item.project_kind !== 'all' && `Project type: ${item.project_kind}`,
                item.work_mode && item.work_mode !== 'all' && `Work: ${item.work_mode}`].filter(Boolean).join(' · ') || 'All stored opportunities'}</p>
              <InAppDigest item={item} workspaceId={workspaceId} onUpdate={updated => setItems(current => current.map(row => row.id === updated.id ? updated : row))} />
            </div>
            <div className="saved-searches-actions">
              <button type="button" onClick={() => onApply(item)}>Apply filters <ArrowUpRight size={14} aria-hidden="true" /></button>
              <button type="button" aria-label={`Delete ${item.name}`} disabled={Boolean(deletingId)} onClick={() => void remove(item)}><Trash2 size={16} aria-hidden="true"/></button>
            </div>
          </article>)}
        </div>}
    <p className="saved-searches-note">Saved filters do not change your acquisition search profile. In-app digest checks only use stored records; automated email delivery is not available.</p>
  </section>
}
