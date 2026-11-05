import { Check, ChevronDown, ChevronUp, Lightbulb, PenLine, Sparkles } from 'lucide-react'
import { getDiscoveryQuerySummary } from '../services/discoveryPresentation'

export default function DiscoveryQueryEditor({
  customQueries, aiQueries, aiEnabled, aiGeneratedAt,
  generating, saving, searching, hasProfile,
  advancedOpen, onAdvancedToggle, onAiEnabledChange,
  onRegenerate, onCustomChange, onResetMessage,
}) {
  const summary = getDiscoveryQuerySummary({ customQueries, aiQueries, aiEnabled })
  const locked = saving || searching || generating
  return (
    <section className="discovery-v2-query-section" aria-labelledby="discovery-v2-query-title">
      <div className="discovery-v2-query-heading">
        <span className="discovery-v2-kicker">SEARCH QUERY BUILDER</span>
        <h3 id="discovery-v2-query-title">How should we look for buyers?</h3>
        <p>Combine AI suggestions with the phrases you write. These settings control the next saved search profile.</p>
      </div>
      <div className="discovery-v2-query-grid">
        <div className="discovery-v2-query-card">
          <div className="discovery-v2-query-card-heading">
            <span className="discovery-v2-query-icon"><Sparkles size={19} aria-hidden="true" /></span>
            <div><h4>AI-generated search phrases</h4>
              <p>Suggested buyer-intent searches based on your services and business profile.</p></div>
          </div>
          <div className="discovery-v2-query-count">
            <strong>{summary.aiCount}</strong><span>saved AI suggestions</span>
          </div>
          <label className="discovery-v2-toggle-row">
            <input type="checkbox" checked={aiEnabled}
              onChange={event => { onAiEnabledChange(event.target.checked); onResetMessage() }}
              disabled={locked} />
            <span><strong>Include AI suggestions in searches</strong>
              <small>{aiEnabled ? 'Included once changes are saved' : 'Excluded once changes are saved'}</small></span>
            <Check size={16} aria-hidden="true" />
          </label>
          <div className="discovery-v2-query-examples">
            <span className="discovery-v2-query-label">SAVED SUGGESTIONS</span>
            {summary.aiCount ? (
              <ul>{aiQueries.filter(x => typeof x === 'string' && x.trim()).slice(0, 5).map((text, index) => (
                <li key={`${text}-${index}`}>{text}</li>
              ))}</ul>
            ) : (
              <p>No AI suggestions saved yet. Generate a set using your current services.</p>
            )}
            {summary.aiCount > 5 && <small>+{summary.aiCount - 5} more saved suggestions</small>}
          </div>
          <div className="discovery-v2-query-card-footer">
            <span>{aiGeneratedAt ? `Last generated ${new Date(aiGeneratedAt).toLocaleDateString()}` : 'Not generated yet'}</span>
            <button type="button" onClick={onRegenerate}
              disabled={!hasProfile || locked || !aiEnabled}>
              <Sparkles size={16} aria-hidden="true" /> {generating ? 'Generating…' : 'Regenerate phrases'}
            </button>
          </div>
        </div>
        <div className="discovery-v2-query-card">
          <div className="discovery-v2-query-card-heading">
            <span className="discovery-v2-query-icon is-custom"><PenLine size={19} aria-hidden="true" /></span>
            <div><h4>Custom search phrases</h4>
              <p>Specific requests your ideal clients might post. You control these phrases.</p></div>
          </div>
          <div className="discovery-v2-query-count">
            <strong>{summary.customCount}</strong><span>custom phrases</span>
          </div>
          {!advancedOpen && (
            <div className="discovery-v2-query-examples">
              <span className="discovery-v2-query-label">CURRENT CUSTOM PHRASES</span>
              {summary.customCount ? (
                <ul>{customQueries.filter(x => typeof x === 'string' && x.trim()).slice(0, 5).map((text, index) => (
                  <li key={`${text}-${index}`}>{text}</li>
                ))}</ul>
              ) : (
                <p>No custom phrases yet. Add specific buyer needs to get started.</p>
              )}
              {summary.customCount > 5 && <small>+{summary.customCount - 5} more custom phrases</small>}
            </div>
          )}
          {advancedOpen && (
            <div className="discovery-v2-editor">
              <label htmlFor="advanced-search-queries">One phrase per line</label>
              <textarea id="advanced-search-queries" rows={9}
                value={customQueries.join('\n')}
                onChange={event => { onCustomChange(event.target.value.split('\n')); onResetMessage() }}
                disabled={saving || searching}
                spellCheck={false}
                placeholder={'need WordPress developer\nhiring video editor\nlooking for branding agency'} />
              <p>Empty lines and duplicate phrases are ignored when saving.</p>
            </div>
          )}
          <div className="discovery-v2-query-card-footer">
            <span><Lightbulb size={14} aria-hidden="true" /> Use needs, not just service names.</span>
            <button type="button" onClick={onAdvancedToggle} disabled={saving || searching}
              aria-expanded={advancedOpen} aria-controls="advanced-search-queries">
              {advancedOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              {advancedOpen ? 'Close editor' : 'Edit custom phrases'}
            </button>
          </div>
        </div>
      </div>
      <p className="discovery-v2-query-footnote">
        Changes here are not active until you select <strong>Save Changes</strong>. A configured query does not guarantee a source request or a new lead.
      </p>
    </section>
  )
}
