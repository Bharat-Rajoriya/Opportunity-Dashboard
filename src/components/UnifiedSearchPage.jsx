import { useMemo, useState } from 'react'
import { ExternalLink, Search, SlidersHorizontal, X, Radar, BookmarkPlus } from 'lucide-react'
import { createSavedSearch } from '../services/savedOpportunitySearches'
import './UnifiedSearchPage.css'

const AGE_OPTIONS = [
  { value: 'all', label: 'Any time' },
  { value: '24', label: 'Last 24 hours' },
  { value: '168', label: 'Last 7 days' },
  { value: '720', label: 'Last 30 days' },
]

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function displayBudget(opportunity) {
  if (opportunity.budget_text) return opportunity.budget_text
  const currency = opportunity.estimated_currency || ''
  const min = numberOrNull(opportunity.estimated_value_min)
  const max = numberOrNull(opportunity.estimated_value_max)
  if (min !== null || max !== null) {
    return [currency, min !== null && max !== null ? `${min.toLocaleString()}–${max.toLocaleString()}` : String((min ?? max).toLocaleString())].filter(Boolean).join(' ')
  }
  return 'Budget not confirmed'
}

const getTimestamp = (opportunity) => {
  // Prefer the source publication time; avoid presenting discovery time as posting time.
  const date = opportunity.published_at
  if (!date) return null
  const value = Date.parse(date)
  return Number.isFinite(value) ? value : null
}

export default function UnifiedSearchPage({
  opportunities = [],
  loading = false,
  error = '',
  onViewDetails,
  onOpenDiscovery,
  onManageSources,
  enabledSources = [],
  onRefresh,
  workspaceId,
  initialPreset = null,
  onOpenSavedSearches,
}) {
  const [query, setQuery] = useState(initialPreset?.query || '')
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState('')
  const [saveError, setSaveError] = useState('')
  const [source, setSource] = useState(initialPreset?.source || 'all')
  const [recency, setRecency] = useState(initialPreset?.recency || 'all')
  const [minScore, setMinScore] = useState(initialPreset?.min_score || 'all')
  const [country, setCountry] = useState(initialPreset?.country || 'all')
  const [sort, setSort] = useState('score')
  const [searchNow, setSearchNow] = useState(() => Date.now())

  const sources = useMemo(() => [...new Set(opportunities
    .map(item => String(item.source || '').trim().toLowerCase())
    .filter(Boolean))].sort(), [opportunities])

  const countries = useMemo(() => [...new Set(opportunities
    .map(item => String(item.country || '').trim())
    .filter(Boolean))].sort(), [opportunities])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const threshold = minScore === 'all' ? null : Number(minScore)
    const cutoff = recency === 'all' ? null : searchNow - Number(recency) * 60 * 60 * 1000
    const rows = opportunities.filter((item) => {
      const text = [item.title, item.requirement, item.raw_text, item.source, item.company_name, item.country]
        .filter(Boolean).join(' ').toLowerCase()
      if (needle && !text.includes(needle)) return false
      if (source !== 'all' && String(item.source || '').toLowerCase() !== source) return false
      if (country !== 'all' && String(item.country || '') !== country) return false
      if (threshold !== null && Number(item.total_score ?? item.preliminary_score ?? 0) < threshold) return false
      if (cutoff !== null) {
        const posted = getTimestamp(item)
        if (posted === null || posted < cutoff) return false
      }
      return true
    })
    return rows.sort((a, b) => {
      if (sort === 'recent') return (getTimestamp(b) || 0) - (getTimestamp(a) || 0)
      return Number(b.total_score ?? b.preliminary_score ?? 0) - Number(a.total_score ?? a.preliminary_score ?? 0)
    })
  }, [opportunities, query, source, recency, minScore, country, sort, searchNow])

  const qualifiedCount = filtered.filter(item => Number(item.total_score ?? item.preliminary_score ?? 0) >= 70).length
  const hasFilters = Boolean(query.trim() || source !== 'all' || recency !== 'all' || minScore !== 'all' || country !== 'all')
  const clear = () => { setQuery(''); setSource('all'); setRecency('all'); setMinScore('all'); setCountry('all') }

  const saveCurrentFilters = async () => {
    if (saving || !saveName.trim()) return
    setSaving(true)
    setSaveError('')
    setSaveFeedback('')
    try {
      await createSavedSearch(workspaceId, { name: saveName, query, source, recency, min_score: minScore, country })
      setSaveName('')
      setSaveFeedback('Saved successfully. Open Saved searches to reuse these filters.')
    } catch (error) {
      setSaveError(error?.code === '23505' ? 'This workspace already has a saved search with that name.' : error?.message || 'Unable to save search.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="unified-search" aria-labelledby="unified-search-title">
      <div className="unified-search-intro">
        <div>
          <span className="unified-search-eyebrow">DISCOVERED OPPORTUNITIES</span>
          <h2 id="unified-search-title">Search your client opportunities</h2>
          <p>Find and review previously discovered buyer requests. Filtering here never starts a paid provider search.</p>
        </div>
        <div className="unified-search-header-actions">
          <button type="button" className="unified-search-source-link" onClick={onManageSources}>Manage sources</button>
          <button type="button" className="unified-search-discover" onClick={onOpenDiscovery}>
            <Radar size={17} aria-hidden="true" /> New discovery
          </button>
        </div>
      </div>

      <p className="unified-search-context">Browsing previously collected opportunities. Selected acquisition sources: {enabledSources.length ? enabledSources.join(", ") : "none"}. Selected does not mean currently available. New discovery uses your saved search profile, not this keyword filter.</p>

      <div className="unified-search-controls">
        <label className="unified-search-input-wrap">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">Search existing opportunities</span>
          <input value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search services, requirements, companies…" />
        </label>
        <div className="unified-search-filters">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <label>Source
            <select value={source} onChange={e => setSource(e.target.value)}>
              <option value="all">All sources</option>
              {sources.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Posted
            <select value={recency} onChange={e => { setRecency(e.target.value); setSearchNow(Date.now()) }}>
              {AGE_OPTIONS.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>Score
            <select value={minScore} onChange={e => setMinScore(e.target.value)}>
              <option value="all">Any score</option>
              <option value="80">80+</option>
              <option value="70">70+</option>
              <option value="60">60+</option>
            </select>
          </label>
          <label>Country
            <select value={country} onChange={e => setCountry(e.target.value)}>
              <option value="all">All countries</option>
              {countries.map(item => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
          {hasFilters && <button type="button" className="unified-search-clear" onClick={clear}><X size={14} aria-hidden="true" /> Clear filters</button>}
        </div>
        <div className="unified-search-save">
          <label>Save these filters
            <input type="text" maxLength={80} value={saveName} onChange={event => setSaveName(event.target.value)} placeholder="e.g. WordPress projects in the US" />
          </label>
          <button type="button" disabled={saving || !saveName.trim() || !workspaceId} onClick={() => void saveCurrentFilters()}><BookmarkPlus size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save search'}</button>
          <button type="button" className="unified-search-saved-link" onClick={onOpenSavedSearches}>View saved searches</button>
        </div>
        {saveFeedback && <p role="status" className="unified-search-save-success">{saveFeedback}</p>}
        {saveError && <p role="alert" className="unified-search-save-error">{saveError}</p>}
      </div>

      <div className="unified-search-layout">
        <div className="unified-search-results">
          <div className="unified-search-results-head">
            <strong>{filtered.length} result{filtered.length === 1 ? '' : 's'}</strong>
            <label>Sort <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="score">Best fit</option>
              <option value="recent">Recently posted</option>
            </select></label>
          </div>
          {error && <div role="alert" className="unified-search-feedback">{error}</div>}
          {loading ? <p className="unified-search-feedback" role="status">Loading opportunities…</p> :
            filtered.length === 0 ? <div className="unified-search-empty">
              <strong>{opportunities.length === 0 ? 'No opportunities discovered yet' : 'No opportunities match these filters'}</strong>
              <p>{opportunities.length === 0 ? 'Use New discovery to run the existing acquisition engine.' : 'Try broader keywords or clear your filters.'}</p>
              {hasFilters && <button type="button" onClick={clear}>Clear filters</button>}
            </div> :
            <div className="unified-search-result-list">
              {filtered.map(item => {
                const score = numberOrNull(item.total_score ?? item.preliminary_score)
                return <article className="unified-search-result" key={item.id}>
                  <div className="unified-search-result-top">
                    <div>
                      <h3>{item.title || 'Untitled opportunity'}</h3>
                      <p className="unified-search-meta">{[item.company_name, item.country, item.source].filter(Boolean).join(' · ') || 'Source not identified'}</p>
                    </div>
                    {score !== null && <span className="unified-search-score">Score {Math.round(score)}/100</span>}
                  </div>
                  <p className="unified-search-description">{item.requirement || item.raw_text || 'No requirement details available.'}</p>
                  <div className="unified-search-result-foot">
                    <span className="unified-search-budget">{displayBudget(item)}</span>
                    <div className="unified-search-actions">
                      <button type="button" onClick={() => onViewDetails(item)}>View details</button>
                      {item.source_url && <a href={item.source_url} target="_blank" rel="noopener noreferrer">Open source <ExternalLink size={13} aria-hidden="true" /></a>}
                    </div>
                  </div>
                </article>
              })}
            </div>
          }
        </div>
        <aside className="unified-search-summary" aria-label="Search summary">
          <h3>Search summary</h3>
          <div><strong>{opportunities.length}</strong><span>Stored opportunities</span></div>
          <div><strong>{filtered.length}</strong><span>Matching filters</span></div>
          <div><strong>{qualifiedCount}</strong><span>Results scoring 70+</span></div>
          <p>These totals reflect your workspace records, not live external provider results.</p>
          <button type="button" onClick={() => { setSearchNow(Date.now()); onRefresh() }} disabled={loading}>Refresh stored results</button>
        </aside>
      </div>
    </section>
  )
}
