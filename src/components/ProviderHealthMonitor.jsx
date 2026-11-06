import { buildProviderMonitorRows } from '../lib/providerHealthPresentation'

function SourceCard({ row }) {
  const style =
    row.state === 'cooldown' ? 'border-amber-500/30 bg-amber-500/5' :
    row.state === 'collected_in_latest_run' ? 'border-emerald-500/30 bg-emerald-500/5' :
    'border-slate-700 bg-slate-900/70'

  return (
    <article className={`rounded-xl border p-4 ${style}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{row.name}</h3>
        <span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs text-slate-300">
          {row.enabled ? 'Selected' : 'Not selected'}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-100">{row.label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{row.explanation}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-700/70 pt-3 text-xs text-slate-400">
        <div>
          <span className="block">Latest run evaluated</span>
          <strong className="mt-1 block text-lg text-white">{row.latestEvaluated}</strong>
        </div>
        <div>
          <span className="block">Latest run new</span>
          <strong className="mt-1 block text-lg text-white">{row.latestCreated}</strong>
        </div>
        <div>
          <span className="block">Last 30 days evaluated</span>
          <strong className="mt-1 block text-base text-slate-200">{row.evaluated30d}</strong>
        </div>
        <div>
          <span className="block">Last 30 days new</span>
          <strong className="mt-1 block text-base text-slate-200">{row.created30d}</strong>
        </div>
      </div>
    </article>
  )
}

export default function ProviderHealthMonitor({
  enabledSources = [],
  sourceAnalytics = {},
  providerHealth,
  sourceCounts = {},
  loading = false,
  error = '',
  engineRun = null,
  onRefresh,
}) {
  const rows = buildProviderMonitorRows({
    enabledSources,
    providerHealth,
    sourceAnalytics,
    latestRunCounts: sourceCounts,
  })
  const latestRunAt = engineRun?.run_finished_at || engineRun?.run_started_at || null

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6" aria-labelledby="provider-health-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Acquisition monitoring</p>
          <h2 id="provider-health-heading" className="mt-1 text-xl font-semibold text-white">Provider health & source activity</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Live provider availability is different from a configured source and from candidates collected in previous runs.
          </p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading}
          className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-violet-400 hover:text-white disabled:opacity-50">
          {loading ? 'Refreshing…' : 'Refresh status'}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-amber-300">Provider status could not be refreshed. {error}</p>}
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(row => <SourceCard key={row.source} row={row} />)}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        {latestRunAt ? `Latest run: ${new Date(latestRunAt).toLocaleString()}.` : 'No completed run timestamp is available.'}
        {' '}Counts reflect stored candidate events, not guaranteed API uptime. Provider status does not disclose remaining quota.
      </p>
    </section>
  )
}
