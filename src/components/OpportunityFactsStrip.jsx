import { getOpportunityPresentation } from '../services/opportunityPresentation'

/** A compact, consistent decision summary shared by lead cards and details. */
export default function OpportunityFactsStrip({ opportunity, detailed = false }) {
  const view = getOpportunityPresentation(opportunity)
  const score = view.score.value === null ? '—' : `${view.score.value} / 100`
  const items = [
    { key: 'budget', label: view.budget.label, value: view.budget.value,
      note: view.budget.detail, state: view.budget.kind },
    { key: 'fit', label: 'Service fit',
      value: view.serviceMatch?.label || 'Not assessed',
      note: view.serviceMatch?.reason || 'No evidence-based service-match classification saved.',
      state: view.serviceMatch?.level || 'unknown' },
    { key: 'research', label: 'Research',
      value: view.research.label, note: view.research.detail, state: view.research.tone },
    { key: 'score', label: view.score.label,
      value: score, note: view.score.detail, state: view.score.stage },
  ]

  return (
    <dl className={`opp-v2-facts${detailed ? ' opp-v2-facts-detail' : ''}`} aria-label="Opportunity decision facts">
      {items.map((item) => (
        <div key={item.key} className={`opp-v2-fact opp-v2-fact-${item.key}`} data-state={item.state}>
          <dt>{item.label}</dt>
          <dd title={item.value}>{item.value}</dd>
          {detailed && <p>{item.note}</p>}
        </div>
      ))}
    </dl>
  )
}
