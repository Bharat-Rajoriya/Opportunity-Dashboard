import { AlertTriangle, ArrowUpRight, CircleHelp, FileText, ShieldCheck } from 'lucide-react'
import { getOpportunityPresentation } from '../services/opportunityPresentation'
import { getResearchStatusDetails } from '../lib/researchStatus'
import './OpportunityDecisionSidebar.css'

function CheckRow({ label, value, note, warning = false }) {
  return (
    <div className="opp-v3-check">
      {warning ? <AlertTriangle size={16} aria-hidden="true" /> : <CircleHelp size={16} aria-hidden="true" />}
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </div>
  )
}

export default function OpportunityDecisionSidebar({ opportunity, onGeneratePitch, pitchGenerating = false, pitchDisabled = false, pitchError = "" }) {
  const view = getOpportunityPresentation(opportunity)
  const research = getResearchStatusDetails(opportunity)
  const hasDraft = Boolean(String(opportunity?.outreach_message || '').trim())
  const canGenerate = !hasDraft && (!opportunity?.outreach_status || opportunity.outreach_status === 'not_generated')
  const hasBudgetEvidence = view.budget.kind === 'listed'
  const riskyBudget = ['far_below_minimum', 'below_minimum'].includes(
    String(opportunity?.commercial_fit || '').toLowerCase()
  )
  return (
    <aside className="opp-v3-side" aria-label="Opportunity due diligence and proposal readiness">
      <section className="opp-v3-side-section">
        <div className="opp-v3-side-title"><ShieldCheck size={18} aria-hidden="true" /><h3>Buyer and safety checks</h3></div>
        <p className="opp-v3-side-intro">Missing evidence stays unknown. The platform does not guarantee payment or buyer authenticity.</p>
        <CheckRow label="Buyer identity" value="Not independently verified"
          note={opportunity?.company_name ? 'A company name is present, but identity verification is not confirmed.' : 'No verified buyer identity is recorded.'} />
        <CheckRow label="Payment verification" value="Unknown"
          note="No trusted payment verification result is stored." />
        <CheckRow label="Budget evidence" value={hasBudgetEvidence ? 'Amount listed' : 'Not confirmed'}
          note={hasBudgetEvidence ? 'A budget or rate appears in the listing; confirm the total project value.' : 'Any model-estimated value is not a buyer commitment.'}
          warning={riskyBudget} />
        <CheckRow label="Off-platform payment/request" value="Not assessed"
          note="Check the original listing for requests to pay or communicate outside the platform." />
      </section>
      <section className="opp-v3-side-section">
        <div className="opp-v3-side-title"><FileText size={18} aria-hidden="true" /><h3>Proposal readiness</h3></div>
        <span className={hasDraft ? 'opp-v3-draft is-ready' : 'opp-v3-draft'}>{hasDraft ? 'Draft available for review' : 'No draft generated'}</span>
        <p>{hasDraft ? 'Review and edit the existing AI draft before approving outreach. Nothing is sent automatically.' : 'Generate a draft only after reviewing the buyer requirement and service match.'}</p>
        {hasDraft && <a className="opp-v3-side-link" href="#opp-v3-outreach-draft">Review existing draft <ArrowUpRight size={14} aria-hidden="true" /></a>}
        {canGenerate && <button type="button" className="opp-v3-side-button" onClick={onGeneratePitch} disabled={pitchGenerating || pitchDisabled}>{pitchGenerating ? "Generating draft…" : "Generate pitch draft"}</button>}
        {pitchError && <p role="alert" className="opp-v3-pitch-error">{pitchError}</p>}
        {!canGenerate && !hasDraft && <p>Outreach draft is already queued or undergoing review. Check the Outreach section.</p>}
      </section>
      <section className="opp-v3-side-section">
        <div className="opp-v3-side-title"><CircleHelp size={18} aria-hidden="true" /><h3>Research confidence</h3></div>
        <strong className="opp-v3-research-label">{research.label}</strong>
        <p>{research.description}</p>
        {view.sourceUrl && <a className="opp-v3-side-link" href={view.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect original source <ArrowUpRight size={14} aria-hidden="true" /></a>}
      </section>
    </aside>
  )
}
