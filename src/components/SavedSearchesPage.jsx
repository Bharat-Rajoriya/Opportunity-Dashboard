import { useEffect, useState } from 'react'
import { Bookmark, Search, Trash2, ArrowUpRight } from 'lucide-react'
import { loadSavedSearches, deleteSavedSearch } from '../services/savedOpportunitySearches'
import './SavedSearchesPage.css'

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
            <div><h3>{item.name}</h3>
              <p>{[item.query && `Keywords: ${item.query}`,item.source !== 'all' && `Source: ${item.source}`,
                item.country !== 'all' && `Country: ${item.country}`,item.min_score !== 'all' && `Score: ${item.min_score}+`,
                item.recency !== 'all' && `Posted in last ${item.recency} hours`].filter(Boolean).join(' · ') || 'All stored opportunities'}</p>
            </div>
            <div className="saved-searches-actions">
              <button type="button" onClick={() => onApply(item)}>Apply filters <ArrowUpRight size={14} aria-hidden="true" /></button>
              <button type="button" aria-label={`Delete ${item.name}`} disabled={Boolean(deletingId)} onClick={() => void remove(item)}><Trash2 size={16} aria-hidden="true"/></button>
            </div>
          </article>)}
        </div>}
    <p className="saved-searches-note">Saved filters do not change your acquisition search profile. No email alerts, digests, or background monitoring are configured.</p>
  </section>
}
