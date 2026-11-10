import { useState } from 'react'
import { Activity, ArrowUpRight, BriefcaseBusiness, Search, ShieldAlert, Plug, RefreshCw } from 'lucide-react'
import { buildProviderMonitorRows } from '../lib/providerHealthPresentation'
import QuickCapturePanel from './QuickCapturePanel'
import './SourcesHubPage.css'

const SOURCE_DESCRIPTIONS = {
  google: 'Find independent client requests across the public web using the Google collector.',
  freelancer: 'Find buyer projects through the direct Freelancer marketplace collector.',
  upwork: 'Direct Upwork collection is not currently available. Selecting a source does not activate an API integration.',
}

const SOURCE_ICONS = { google: Search, freelancer: BriefcaseBusiness, upwork: Plug }

function getSourceLabel(row, loading, error) {
  if (error) return 'Status unavailable'
  if (loading) return 'Checking status'
  if (!row.enabled) return 'Not selected'
  if (row.source === 'upwork') return 'Direct API unavailable'
  return row.label
}

function SourceCard({ row, loading, error, onManage }) {
  const Icon = SOURCE_ICONS[row.source] || Plug
  const status = getSourceLabel(row, loading, error)
  const unavailable = row.state === 'cooldown' || row.state === 'recovery_eligible' || row.state === 'recovery_in_progress' || row.source === 'upwork'
  const verified = row.enabled && (row.state === 'verified_recently' || row.state === 'collected_in_latest_run')
  return (
    <article className="sources-hub-card">
      <div className="sources-hub-card-top">
        <div className="sources-hub-icon"><Icon size={21} aria-hidden="true" /></div>
        <span className={`sources-hub-status${unavailable ? ' is-unavailable' : verified ? ' is-verified' : ' is-neutral'}`}>{status}</span>
      </div>
      <h3>{row.name}</h3>
      <p>{SOURCE_DESCRIPTIONS[row.source] || 'Configured acquisition source.'}</p>
      <div className="sources-hub-details">
        <div><span>Workspace preference</span><strong>{row.enabled ? 'Selected' : 'Not selected'}</strong></div>
        <div><span>Latest run evaluated</span><strong>{row.latestEvaluated}</strong></div>
        <div><span>Latest run created</span><strong>{row.latestCreated}</strong></div>
        <div><span>30-day candidates evaluated</span><strong>{row.evaluated30d}</strong></div>
      </div>
      <p className="sources-hub-explanation">{row.explanation}</p>
      <button type="button" className="sources-hub-manage" onClick={onManage}>Manage in Settings <ArrowUpRight size={15} aria-hidden="true" /></button>
    </article>
  )
}

export default function SourcesHubPage({
  enabledSources = [],
  providerHealth = null,
  sourceAnalytics = {},
  sourceCounts = {},
  loading = false,
  error = '',
  engineRun = null,
  onRefresh,
  onManage,
  onDiagnostics,
  onBrowseResults,
  onNewDiscovery,
  workspaceId,
  opportunities = [],
}) {
  const [manualCaptureRequest, setManualCaptureRequest] = useState(0)
  const rows = buildProviderMonitorRows({
    enabledSources, providerHealth, sourceAnalytics, latestRunCounts: sourceCounts,
  }).filter(row => ['google', 'freelancer', 'upwork'].includes(row.source))
  const latestRunAt = engineRun?.run_finished_at || engineRun?.run_started_at
  return (
    <section className="sources-hub" aria-labelledby="sources-hub-title">
      <div className="sources-hub-heading">
        <div>
          <span className="sources-hub-eyebrow">ACQUISITION SOURCES</span>
          <h2 id="sources-hub-title">Choose where to discover clients</h2>
          <p>Manage source preferences and inspect recorded activity without confusing a selected source with a working provider.</p>
        </div>
        <button type="button" className="sources-hub-refresh" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh status'}
        </button>
      </div>

      {error && <p role="alert" className="sources-hub-error"><ShieldAlert size={17} aria-hidden="true" /> Status metrics could not be refreshed: {error}</p>}
      <div className="sources-hub-grid">
        {rows.map(row => <SourceCard key={row.source} row={row} loading={loading} error={error} onManage={onManage} />)}
        <article className="sources-hub-card sources-hub-manual-source" aria-labelledby="sources-fiverr-heading">
          <div className="sources-hub-card-top">
            <div className="sources-hub-icon"><Plug size={21} aria-hidden="true" /></div>
            <span className="sources-hub-status is-neutral">Manual only</span>
          </div>
          <h3 id="sources-fiverr-heading">Fiverr</h3>
          <p>Save a Fiverr project link you already have. Fiverr buyer briefs are matched through Fiverr, not exposed as a general public feed for our collector.</p>
          <p className="sources-hub-explanation">No Fiverr API connection, automated scraping, buyer verification, or automatic discovery. Manually captured links require review before any optional AI triage.</p>
          <button type="button" className="sources-hub-manage" onClick={() => setManualCaptureRequest(value => value + 1)}>
            Add Fiverr link with Quick Capture <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        </article>
      </div>
      <QuickCapturePanel workspaceId={workspaceId} opportunities={opportunities} openRequest={manualCaptureRequest} />
      <div className="sources-hub-quick-actions" aria-label="Next discovery steps">
        <div><strong>Ready to continue?</strong><p>Browse saved client requests or open the existing discovery engine. Neither action starts a provider request by itself.</p></div>
        <div className="sources-hub-action-buttons">
          <button type="button" onClick={onBrowseResults}>Browse stored results <ArrowUpRight size={15} aria-hidden="true" /></button>
          <button type="button" onClick={onNewDiscovery}>Open new discovery <ArrowUpRight size={15} aria-hidden="true" /></button>
        </div>
      </div>
      <footer className="sources-hub-footer">
        <div><Activity size={17} aria-hidden="true" /> {latestRunAt ? `Latest recorded run: ${new Date(latestRunAt).toLocaleString()}` : 'No recent run timestamp available'}.</div>
        <p>Provider health is based on the available monitoring data. Activity counts are not proof of current API availability, and no live quota is displayed here.</p>
        <button type="button" onClick={onDiagnostics}>Open detailed diagnostics <ArrowUpRight size={15} aria-hidden="true" /></button>
      </footer>
    </section>
  )
}
