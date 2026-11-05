import { useEffect, useMemo, useState } from 'react'
import { fetchEngineRunMonitoring, summarizeRunSignals, summarizeAcquisitionMonitoring } from '../services/acquisitionMonitoring'
import { sourceRecoverySummary, getSourceRecoveryGuidance } from '../services/sourceReliability'
import './AcquisitionMonitoring.css'

const number = value => Number(value || 0).toLocaleString()
const time = value => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

export default function AcquisitionMonitoring({ workspaceId, days, funnelRows = [], funnelTruncated = false }) {
  const [response, setResponse] = useState({ runs: [], truncated: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!workspaceId) return undefined
    const load = async () => {
      setLoading(true)
      setError('')
      setResponse({ runs: [], truncated: false })
      try {
        const result = await fetchEngineRunMonitoring(workspaceId, { days })
        if (!cancelled) setResponse(result)
      } catch {
        if (!cancelled) setError('Run monitoring is unavailable. Retry or inspect workspace access and network status.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [workspaceId, days, refreshKey])

  const runs = useMemo(() =>
    response.runs.map(run => summarizeRunSignals(run, funnelRows)),
  [response.runs, funnelRows])
  const totals = useMemo(() => summarizeAcquisitionMonitoring(runs), [runs])
  const recovery = useMemo(() => sourceRecoverySummary(runs), [runs])

  return (
    <section className="monitor-panel" aria-labelledby="monitor-title">
      <div className="monitor-heading">
        <div>
          <p className="acq-eyebrow">EXECUTION HEALTH · READ ONLY</p>
          <h3 id="monitor-title">Acquisition monitoring V2</h3>
          <p className="acq-note">Includes runs with no candidate events. These are execution-level observations; this is not a real-time provider availability check.</p>
        </div>
        <button type="button" className="acq-refresh" disabled={loading} onClick={() => setRefreshKey(current => current + 1)}>Refresh run health</button>
      </div>
      {loading && <p role="status" className="acq-message">Loading execution health…</p>}
      {error && <div role="alert" className="acq-error">{error} <button type="button" onClick={() => setRefreshKey(current => current + 1)}>Retry</button></div>}
      {!loading && !error && (
        <>
          {(response.truncated || funnelTruncated) && (
            <p role="status" className="acq-warning">
              Monitoring or candidate history reached its reporting limit. Some comparisons may be incomplete.
            </p>
          )}
          <div className="monitor-stats">
            {[
              ['Runs recorded', totals.total],
              ['Failed', totals.failed],
              ['Rate-limited', totals.rateLimited],
              ['Quota errors', totals.quotaFailures],
              ['No evaluations', totals.noEvaluations],
              ['Critical health', totals.criticalHealth],
            ].map(([label, value]) => (
              <div className="acq-kpi" key={label}><span>{label}</span><strong>{number(value)}</strong></div>
            ))}
          </div>
          {recovery.failedRuns > 0 && (
            <section className="acq-panel" aria-labelledby="recovery-title">
              <h3 id="recovery-title">Source reliability &amp; recovery guidance</h3>
              <p className="acq-note">Actions are advisory only. No provider is retried from this page. A failed workflow step does not establish which API caused the failure.</p>
              <ul className="acq-reasons">
                {recovery.actionable.slice(0, 5).map(item => (
                  <li key={`${item.executionId}-${item.startedAt}`} className="recovery-guidance-item">
                    <div><strong>Run #{item.executionId}: {item.title}</strong>
                      <p className="acq-note">{item.action}</p>
                      <p className="acq-note">{item.retry}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {recovery.failedRuns > 5 && <p className="acq-note">Showing guidance for the five most recent failed runs.</p>}
              <p className="acq-note">Google SERP API uses an existing backend cooldown and bounded recovery probe. This report cannot confirm the current provider cooldown or guarantee a probe is globally exclusive.</p>
            </section>
          )}
          {runs.length === 0 ? <div className="acq-empty">
            <h3>No engine run records found</h3>
            <p>This workspace has no execution log in the selected period. This does not prove a scheduled search occurred.</p>
          </div> : (
            <div className="acq-panel">
              <h3>Recent executions and warning signals</h3>
              <p className="acq-note">The source selector above does not apply here: run failures can occur before a source or candidate is identified. Error messages are categorized rather than displayed verbatim.</p>
              <div className="acq-scroll">
                <table className="monitor-table">
                  <thead><tr><th scope="col">Execution</th><th scope="col">Started</th><th scope="col">Status</th><th scope="col">Candidate stages</th><th scope="col">Finding</th></tr></thead>
                  <tbody>
                    {runs.slice(0, 60).map(run => (
                      <tr key={run.id}>
                        <th scope="row">#{run.executionId}</th>
                        <td>{time(run.startedAt)}</td>
                        <td>{run.status || 'unknown'}{run.health === 'critical' && <small>Critical health</small>}</td>
                        <td>{number(run.totals.evaluated)} evaluated<small>{number(run.totals.created)} new · {number(run.totals.duplicates)} duplicates</small></td>
                        <td>
                          <span className={`monitor-status is-${run.severity}`}>{run.label}</span>
                          {run.failedStep && <small>Failed step: {run.failedStep}</small>}
                          {getSourceRecoveryGuidance(run) && <small>{getSourceRecoveryGuidance(run).attribution}</small>}
                          {run.warningLabels.length > 0 && <small>{run.warningLabels.join(' · ')}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {runs.length > 60 && <p className="acq-note">Showing the latest 60 of {runs.length} execution records.</p>}
            </div>
          )}
          <p className="acq-note">A recorded HTTP 429 or “too many requests” error indicates rate limiting, not necessarily exhausted monthly credits. Quota exhaustion is reported only when the recorded error explicitly says so. Missing candidate events may also indicate filtering, disabled sources, or unrecorded request failures. Stale running states are informational warnings, not verified live workflow status.</p>
        </>
      )}
    </section>
  )
}
