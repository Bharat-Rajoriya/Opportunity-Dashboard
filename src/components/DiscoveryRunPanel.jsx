import { AlertCircle, CheckCircle2, Clock3, Info, SearchCheck } from 'lucide-react'
import {
  getDiscoveryBreakdown, getDiscoveryQuerySummary, getDiscoveryRunState,
} from '../services/discoveryPresentation'

const STAGES = [
  { key: 'evaluated', label: 'Evaluated', note: 'Candidate evaluation events' },
  { key: 'rejected', label: 'Rejected', note: 'Candidates rejected by quality checks' },
  { key: 'qualified', label: 'Qualified', note: 'Candidates passing qualification checks' },
  { key: 'duplicate', label: 'Already saved', note: 'Existing opportunities seen again' },
  { key: 'created', label: 'Newly saved', note: 'New opportunities stored this run' },
]

export default function DiscoveryRunPanel({
  run, running, diagnostics, diagnosticsError,
  customQueries, aiQueries, aiEnabled, queryBatchSize,
  enabledSources, onOpenSettings, explanation,
}) {
  const state = getDiscoveryRunState(run, running)
  const summary = getDiscoveryQuerySummary({
    customQueries, aiQueries, aiEnabled, queryBatchSize, enabledSources,
  })
  const breakdown = getDiscoveryBreakdown(diagnostics)
  const StateIcon = state.kind === 'success' ? CheckCircle2
    : state.kind === 'error' ? AlertCircle
      : state.kind === 'running' || state.kind === 'pending' ? Clock3 : SearchCheck

  return (
    <section className="discovery-v2-panel" aria-labelledby="discovery-v2-panel-title">
      <div className="discovery-v2-panel-header">
        <div>
          <span className="discovery-v2-kicker">DISCOVERY CONTROL CENTER</span>
          <h3 id="discovery-v2-panel-title">Your search at a glance</h3>
          <p>These are your currently loaded settings. Save changes in Settings before running a new search.</p>
        </div>
        <button className="discovery-v2-settings-link" type="button" onClick={onOpenSettings}>
          Edit search settings
        </button>
      </div>

      <div className="discovery-v2-config-grid" aria-label="Search configuration summary">
        <div><span>Sources selected</span><strong>{summary.selectedSources.length}</strong>
          <small>{summary.selectedSources.join(', ') || 'None selected'}</small></div>
        <div><span>Custom phrases</span><strong>{summary.customCount}</strong>
          <small>Written by your team</small></div>
        <div><span>AI suggestions</span><strong>{summary.aiIncluded ? summary.aiCount : 0}</strong>
          <small>{summary.aiIncluded ? 'Included in query pool' : 'Excluded from query pool'}</small></div>
        <div><span>Phrase batch limit</span><strong>{summary.batchLimit || '—'}</strong>
          <small>Maximum configured preference</small></div>
      </div>
      <p className="discovery-v2-config-note"><Info size={15} aria-hidden="true" />
        {summary.estimate} Selected sources are not necessarily online or within quota.
      </p>

      <div className={`discovery-v2-run-state is-${state.kind}`} role="status" aria-live="polite">
        <StateIcon size={19} aria-hidden="true" />
        <div><strong>{state.title}</strong><p>{state.detail}</p></div>
      </div>

      {!running && run && breakdown && (
        <div className="discovery-v2-results">
          <h4>Latest recorded run</h4>
          <div className="discovery-v2-stage-grid">
            {STAGES.map(item => (
              <div className="discovery-v2-stage" key={item.key}>
                <span>{item.label}</span>
                <strong>{breakdown.counts[item.key]}</strong>
                <small>{item.note}</small>
              </div>
            ))}
          </div>
          {explanation && <p className="discovery-v2-explanation">{explanation}</p>}
          <div className="discovery-v2-bottom-grid">
            <div>
              <h5>Why candidates were rejected</h5>
              {breakdown.reasons.length ? (
                <ul className="discovery-v2-reason-list">
                  {breakdown.reasons.map(reason => (
                    <li key={reason.key}><span>{reason.label}</span><strong>{reason.count}</strong></li>
                  ))}
                </ul>
              ) : <p className="discovery-v2-muted">No rejection reasons were recorded.</p>}
            </div>
            <div>
              <h5>Source activity</h5>
              {breakdown.sources.length ? (
                <ul className="discovery-v2-source-list">
                  {breakdown.sources.map(source => (
                    <li key={source.source}>
                      <strong>{source.source}</strong>
                      <span>{source.evaluated} evaluated · {source.created} new · {source.duplicate} duplicates</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="discovery-v2-muted">No source activity was recorded for this run.</p>}
            </div>
          </div>
          <p className="discovery-v2-metric-note">{breakdown.note}</p>
          {breakdown.truncated && (
            <p className="discovery-v2-truncation">Only the first 2,000 events are included.</p>
          )}
        </div>
      )}
      {!running && run && !breakdown && (
        <p className="discovery-v2-muted" role={diagnosticsError ? 'status' : undefined}>
          {diagnosticsError || 'Detailed candidate events were not recorded for this run.'}
        </p>
      )}
    </section>
  )
}
