import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleHelp } from 'lucide-react'
import { getOutreachLeadContext } from '../services/outreachPresentation'

export default function OutreachLeadContext({ lead, approved = false }) {
  const context = getOutreachLeadContext(lead)
  return (
    <div className="outreach-v2-context">
      <div className="outreach-v2-lead-top">
        <div className="outreach-v2-lead-title">
          <span className="outreach-v2-source">{lead.source || 'Unknown source'}</span>
          <h3>{lead.title || 'Untitled opportunity'}</h3>
          <p className="outreach-v2-lead-subtitle">
            {approved
              ? 'Reviewed message — ready for your manual send'
              : 'AI-generated draft — human review required'}
          </p>
        </div>
        {context.sourceUrl && (
          <a className="outreach-v2-original" href={context.sourceUrl}
            target="_blank" rel="noopener noreferrer">
            View source <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        )}
      </div>
      <div className="outreach-v2-metadata" aria-label="Lead evaluation">
        <div><span>Opportunity score</span><strong>{context.score === null ? 'Not scored' : `${context.score}/100`}</strong></div>
        <div>
          <span>Service fit</span>
          <strong className={`outreach-v2-fit-${context.match?.level || 'unknown'}`}>
            {context.match?.label || 'Not assessed'}
          </strong>
        </div>
        <div><span>Budget</span><strong title={context.budget.detail}>{context.budget.value}</strong></div>
        <div><span>Research</span><strong>{context.researchLabel}</strong></div>
        <div><span>Channel</span><strong>{context.channel}</strong></div>
      </div>
      {context.needsReview && (
        <div className="outreach-v2-caution" role="note">
          <AlertTriangle size={17} aria-hidden="true" />
          <p>Manual override required: the lead is low-scoring, related, or not recommended.
            Confirm the buyer's actual needs before approving or sending.</p>
        </div>
      )}
      {!context.needsReview && context.researchNeedsReview && (
        <div className="outreach-v2-research-caution" role="note">
          <CircleHelp size={16} aria-hidden="true" />
          <p>Research is not fully complete. A draft does not confirm the buyer's identity.</p>
        </div>
      )}
      {context.match?.evidence && (
        <p className="outreach-v2-evidence">
          <CheckCircle2 size={15} aria-hidden="true" />
          <span><strong>Buyer evidence:</strong> {context.match.evidence}</span>
        </p>
      )}
    </div>
  )
}
