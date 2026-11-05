import { useEffect, useMemo, useState } from 'react'
import { aggregateRejectionReasons, explainAcquisitionRun, fetchAcquisitionDiagnostics, summarizeAcquisitionRuns } from '../services/acquisitionDiagnostics'
import './AcquisitionDiagnostics.css'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}
function formatSource(value) {
  const text = String(value || 'unknown')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function AcquisitionDiagnostics({ workspaceId }) {
  const [days, setDays] = useState(30)
  const [selectedSource, setSelectedSource] = useState('all')
  const [data, setData] = useState({ runs: [], reasons: [], truncated: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!workspaceId) return undefined
    // Fetch only when this authenticated page is mounted; ignore stale requests on workspace change.
    const load = async () => {
      setLoading(true)
      setError('')
      setData({ runs: [], reasons: [], truncated: false })
      try {
        const result = await fetchAcquisitionDiagnostics(workspaceId, { days })
        if (!cancelled) setData(result)
      } catch (fetchError) {
        if (!cancelled) setError(fetchError?.message || 'Unable to load diagnostics.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [workspaceId, days, refreshKey])

  const sources = useMemo(() => [...new Set(data.runs.map(run => String(run.source || 'unknown').toLowerCase()))].sort(), [data.runs])
  const visibleRuns = useMemo(() => data.runs.filter(run =>
    selectedSource === 'all' || String(run.source || 'unknown').toLowerCase() === selectedSource
  ), [data.runs, selectedSource])
  const runIds = useMemo(() => new Set(visibleRuns.map(run => String(run.master_execution_id))), [visibleRuns])
  const reasons = useMemo(() => aggregateRejectionReasons(data.reasons.filter(row =>
    runIds.has(String(row.master_execution_id)) &&
    (selectedSource === 'all' || String(row.source || 'unknown').toLowerCase() === selectedSource)
  )), [data.reasons, runIds, selectedSource])
  const summary = useMemo(() => summarizeAcquisitionRuns(visibleRuns), [visibleRuns])
  const metrics = [
    ['Evaluated', summary.totals.evaluated],
    ['Rejected', summary.totals.rejected],
    ['Qualified', summary.totals.qualified],
    ['Newly saved', summary.totals.created],
    ['Already saved', summary.totals.duplicate],
  ]

  return (
    <section id="workspace-diagnostics" className="acq-page" aria-labelledby="acq-title">
      <div className="acq-head">
        <div>
          <p className="acq-eyebrow">OPERATOR REPORTING · READ ONLY</p>
          <h2 id="acq-title">Acquisition diagnostics</h2>
          <p>See which sources produce candidates, where they are rejected, and how many new opportunities are recorded.</p>
        </div>
        <button type="button" className="acq-refresh" onClick={() => setRefreshKey(key => key + 1)} disabled={loading}>Refresh diagnostics</button>
      </div>
      <div className="acq-controls">
        <label>Reporting period
          <select value={days} onChange={event => setDays(Number(event.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
        <label>Source
          <select value={selectedSource} onChange={event => setSelectedSource(event.target.value)}>
            <option value="all">All sources</option>
            {sources.map(source => <option key={source} value={source}>{formatSource(source)}</option>)}
          </select>
        </label>
      </div>

      {loading && <p role="status" className="acq-message">Loading acquisition events…</p>}
      {error && <div role="alert" className="acq-error">Could not load diagnostics: {error} <button type="button" onClick={() => setRefreshKey(key => key + 1)}>Retry</button></div>}
      {!loading && !error && (
        <>
          {data.truncated && <p role="status" className="acq-warning">The report reached its 500-row per-view limit. Displayed totals are partial; narrow the date range for a more accurate view.</p>}
          <div className="acq-kpis" aria-label="Recorded acquisition stage events">
            {metrics.map(([label, value]) => <div className="acq-kpi" key={label}><span>{label}</span><strong>{value.toLocaleString()}</strong></div>)}
          </div>
          <p className="acq-note">These are recorded stage <strong>events</strong>, not unique candidates. One candidate can appear in multiple stages. Runs that fail before emitting events will not appear here.</p>

          {visibleRuns.length === 0 ? (
            <div className="acq-empty">
              <h3>No acquisition events in this view</h3>
              <p>{data.runs.length ? 'Try another source filter.' : 'No source events were recorded during this period. Check Discovery settings and n8n executions before assuming a search returned zero candidates.'}</p>
            </div>
          ) : (
            <>
              <div className="acq-grid">
                <section className="acq-panel" aria-labelledby="acq-sources-title">
                  <h3 id="acq-sources-title">Source performance</h3>
                  <div className="acq-scroll">
                    <table><thead><tr><th scope="col">Source</th><th scope="col">Evaluated</th><th scope="col">Qualified</th><th scope="col">New</th><th scope="col">Duplicates</th></tr></thead>
                      <tbody>{Object.entries(summary.bySource).map(([source, counts]) => (
                        <tr key={source}><th scope="row">{formatSource(source)}</th><td>{counts.evaluated}</td><td>{counts.qualified}</td><td>{counts.created}</td><td>{counts.duplicate}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </section>
                <section className="acq-panel" aria-labelledby="acq-reasons-title">
                  <h3 id="acq-reasons-title">Top rejection reasons</h3>
                  {reasons.length === 0 ? <p className="acq-note">No rejection reasons were recorded for these runs.</p> : (
                    <ul className="acq-reasons">{reasons.slice(0, 10).map(item => (
                      <li key={item.reason}><span>{item.reason.replaceAll('_', ' ')}</span><strong>{item.count}</strong></li>
                    ))}</ul>
                  )}
                </section>
              </div>
              <section className="acq-panel" aria-labelledby="acq-history-title">
                <h3 id="acq-history-title">Recent run history</h3>
                <div className="acq-scroll">
                  <table><thead><tr><th scope="col">Run / source</th><th scope="col">Last activity</th><th scope="col">Evaluated</th><th scope="col">Qualified</th><th scope="col">New</th><th scope="col">Outcome</th></tr></thead>
                    <tbody>{visibleRuns.slice(0, 50).map((run, index) => (
                      <tr key={`${run.master_execution_id}-${run.source}-${run.search_profile_id || ''}-${index}`}>
                        <th scope="row">#{run.master_execution_id}<small>{formatSource(run.source)}</small></th>
                        <td>{formatDate(run.last_event_at)}</td><td>{run.evaluated_events}</td><td>{run.qualified_events}</td><td>{run.created_events}</td>
                        <td>{explainAcquisitionRun(run)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {visibleRuns.length > 50 && <p className="acq-note">Showing 50 of {visibleRuns.length} run/source rows.</p>}
              </section>
            </>
          )}
        </>
      )}
    </section>
  )
}
