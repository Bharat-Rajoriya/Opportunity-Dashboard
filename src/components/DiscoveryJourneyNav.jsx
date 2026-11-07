import { ArrowRight, Database, Plug, Radar } from 'lucide-react'
import './DiscoveryJourneyNav.css'

const STEPS = [
  { id: 'search', label: 'Browse results', detail: 'Saved opportunities; no provider requests', Icon: Database },
  { id: 'sources', label: 'Manage sources', detail: 'Provider preferences and activity', Icon: Plug },
  { id: 'discovery', label: 'New discovery', detail: 'Run the existing acquisition engine', Icon: Radar },
]

export default function DiscoveryJourneyNav({ active, onNavigate }) {
  return (
    <nav className="discovery-journey" aria-label="Opportunity discovery workflow">
      <div className="discovery-journey-heading">
        <strong>Discovery workflow</strong>
        <span>Browse existing results or choose when to request new ones</span>
      </div>
      <div className="discovery-journey-steps">
        {STEPS.map(({ id, label, detail, Icon }, index) => (
          <button type="button" key={id} className={`discovery-journey-step${active === id ? ' is-current' : ''}`}
            aria-current={active === id ? 'step' : undefined} onClick={() => onNavigate(id)}
            disabled={active === id}>
            <span className="discovery-journey-step-icon"><Icon size={17} aria-hidden="true" /></span>
            <span className="discovery-journey-step-text"><strong>{label}</strong><small>{detail}</small></span>
            {index < STEPS.length - 1 && <ArrowRight className="discovery-journey-next" size={15} aria-hidden="true" />}
          </button>
        ))}
      </div>
      {active === 'discovery' && (
        <p className="discovery-journey-caution">Viewing this page does not start a search. Only pressing Find Opportunities runs the configured external collectors and may use provider quota.</p>
      )}
    </nav>
  )
}
