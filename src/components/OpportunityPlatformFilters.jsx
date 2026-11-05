import { Layers3, ArrowDownUp } from 'lucide-react'
import { OPPORTUNITY_SORT_OPTIONS } from '../services/opportunityPlatforms'

/** Filter displayed opportunities, not the providers that the collector searches. */
export default function OpportunityPlatformFilters({
  platformOptions, selectedPlatforms, onToggle, onClear, sortBy, onSortChange,
  total,
}) {
  const allSelected = selectedPlatforms.length === 0
  return (
    <div className="opp-platform-toolbar" aria-label="Opportunity platform filters and sorting">
      <div className="opp-platform-row">
        <div className="opp-platform-heading">
          <Layers3 size={16} aria-hidden="true" />
          <span>Platforms</span>
        </div>
        <div className="opp-platform-choices" role="group" aria-label="Filter opportunities by platform">
          <button type="button"
            aria-pressed={allSelected}
            className={`opp-platform-choice${allSelected ? ' is-active' : ''}`}
            onClick={onClear}>
            All platforms <span>{total}</span>
          </button>
          {platformOptions.map(platform => (
            <button type="button" key={platform.value}
              aria-pressed={selectedPlatforms.includes(platform.value)}
              onClick={() => onToggle(platform.value)}
              className={`opp-platform-choice${selectedPlatforms.includes(platform.value) ? ' is-active' : ''}`}
              title={`Show ${platform.label} opportunities`}>
              {platform.label} <span>{platform.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="opp-platform-sort">
        <label htmlFor="opp-platform-sort-select">
          <ArrowDownUp size={15} aria-hidden="true" />
          Sort by
        </label>
        <select id="opp-platform-sort-select" value={sortBy}
          onChange={event => onSortChange(event.target.value)}>
          {OPPORTUNITY_SORT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <p className="opp-platform-hint">
        Select one or more platforms to narrow saved opportunities. This does not change which platforms discovery searches.
      </p>
    </div>
  )
}
