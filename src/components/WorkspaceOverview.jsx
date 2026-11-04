import { ArrowRight, ArrowUpRight, CircleDot, Sparkles } from 'lucide-react'
import { getWorkspaceFocus } from '../config/workspaceUi'

function readableStatus(run) {
  const status = String(run?.run_status || run?.status || '').toLowerCase()
  if (['completed', 'success', 'succeeded'].includes(status)) return 'Last recorded run completed'
  if (['running', 'queued', 'pending'].includes(status)) return 'Last recorded run in progress'
  if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) return 'Last recorded run needs attention'
  return 'Ready for a discovery run'
}

export default function WorkspaceOverview({
  stats, reviewCount, enabledSources, sourcesLoading, engineRun, searchRunning, onNavigate,
}) {
  const focus = getWorkspaceFocus(stats, reviewCount)
  const sources = sourcesLoading ? [] : enabledSources
  return (
    <section id="workspace-overview" className="workspace-overview workspace-anchor"
      aria-labelledby="workspace-overview-title">
      <div className="workspace-overview-primary">
        <div className="workspace-overview-kicker"><Sparkles size={14} aria-hidden="true" /> SALES WORKSPACE</div>
        <h2 id="workspace-overview-title">Less searching.<span> More opportunity.</span></h2>
        <p className="workspace-overview-description">
          Discover buyer requests, understand the service fit, and take your next sales action with confidence.
        </p>
        <div className="workspace-overview-actions">
          <button type="button" className="workspace-hero-primary" onClick={() => onNavigate('discovery')}>
            Explore discovery <ArrowUpRight size={17} aria-hidden="true" />
          </button>
          <button type="button" className="workspace-hero-secondary" onClick={() => onNavigate('opportunities')}>
            Browse opportunities <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="workspace-overview-side">
        <div className="workspace-status-label"><CircleDot size={16} aria-hidden="true" /> WORKSPACE PULSE</div>
        <div className="workspace-status-line">
          <span className={`workspace-status-light${searchRunning ? ' is-busy' : ''}`} aria-hidden="true" />
          <span>{searchRunning ? 'Discovery is running' : readableStatus(engineRun)}</span>
        </div>
        <div className="workspace-focus">
          <span className="workspace-focus-eyebrow">RECOMMENDED NEXT STEP</span>
          <strong>{focus.title}</strong>
          <p>{focus.description}</p>
          <button type="button" onClick={() => onNavigate(focus.target)}>
            {focus.action} <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="workspace-sources">
          <span>Configured discovery sources</span>
          <div className="workspace-source-tags">
            {sourcesLoading ? (
              <span className="workspace-source-tag">Loading preferences…</span>
            ) : sources.length ? (
              sources.map((source) => (
                <span className="workspace-source-tag" key={source}>
                  {source === 'google' ? 'Google Web' : source === 'freelancer' ? 'Freelancer' : source}
                </span>
              ))
            ) : <span className="workspace-source-tag">No sources selected</span>}
          </div>
          <small>Configured does not mean currently available.</small>
        </div>
      </div>
    </section>
  )
}
