import { AlertTriangle, ExternalLink, FileText, ShieldCheck, CircleHelp } from 'lucide-react'
import { getOpportunityPresentation } from '../services/opportunityPresentation'
import { getResearchStatusDetails } from '../lib/researchStatus'
import { getOpportunityPitchState } from '../lib/opportunityDetailSafety'
import './OpportunityDecisionSidebar.css'

function EvidenceRow({ title, value, explanation, caution = false }) {
  const Icon = caution ? AlertTriangle : CircleHelp
  return <div className="opp-v31-check"><Icon size={15} aria-hidden="true" />
    <div><span>{title}</span><strong>{value}</strong><p>{explanation}</p></div>
  </div>
}

export default function OpportunityDecisionSidebar({
  opportunity, onGeneratePitch, pitchGenerating = false, pitchDisabled = false, pitchError = '',
}) {
  if (!opportunity) return null
  const presentation = getOpportunityPresentation(opportunity)
  const research = getResearchStatusDetails(opportunity)
  const { hasDraft, canGenerate } = getOpportunityPitchState(opportunity)
  const budgetListed = presentation.budget.kind === 'listed'
  const budgetCaution = ['below_minimum', 'far_below_minimum'].includes(String(opportunity.commercial_fit || '').toLowerCase())
  return <aside className="opp-v31-sidebar" aria-label="Buyer checks and proposal readiness">
    <section className="opp-v31-side-card">
      <h3><ShieldCheck size={17} aria-hidden="true" /> Buyer checks</h3>
      <p className="opp-v31-disclaimer">Unverified information is never treated as confirmed.</p>
      <EvidenceRow title="Buyer identity" value="Unverified"
        explanation={opportunity.company_name ? 'A company name is recorded; independent identity verification is not established.' : 'No verifiable company identity is available.'} />
      <EvidenceRow title="Payment verification" value="Unknown"
        explanation="No trusted buyer-payment verification is stored." />
      <EvidenceRow title="Budget / rate" value={budgetListed ? 'Amount listed' : 'Not confirmed'}
        explanation={budgetListed ? 'A listing contains a rate or amount; total project value is not guaranteed.' : 'Model estimates are not buyer-confirmed budgets.'}
        caution={budgetCaution} />
      <EvidenceRow title="Off-platform payment requests" value="Not assessed"
        explanation="Inspect the original source for potentially unsafe payment requests." />
    </section>
    <section className="opp-v31-side-card">
      <h3><FileText size={17} aria-hidden="true" /> Proposal readiness</h3>
      <p>{hasDraft ? 'Draft available for review. No message is sent automatically.' : 'Review buyer evidence before generating an outreach draft.'}</p>
      {hasDraft && <a className="opp-v31-link" href="#opp-v31-outreach-draft">Review existing draft</a>}
      {canGenerate && <button type="button" className="opp-v31-pitch-button"
        disabled={pitchGenerating || pitchDisabled || typeof onGeneratePitch !== 'function'}
        onClick={onGeneratePitch}>{pitchGenerating ? 'Generating draft…' : 'Generate pitch draft'}</button>}
      {!canGenerate && !hasDraft && <p>Check the Outreach section for the current draft or review state.</p>}
      {pitchError && <p className="opp-v31-error" role="alert">{pitchError}</p>}
    </section>
    <section className="opp-v31-side-card">
      <h3><CircleHelp size={17} aria-hidden="true" /> Research status</h3>
      <strong>{research.label}</strong>
      <p>{research.description}</p>
      {presentation.sourceUrl && <a className="opp-v31-link" href={presentation.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect original listing <ExternalLink size={13} aria-hidden="true" /></a>}
    </section>
  </aside>
}
