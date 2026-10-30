# Commercial Value Guard V1

Commercial Value Guard prevents a technically relevant opportunity from ranking highly when its explicit posted budget is obviously inconsistent with the minimum project value configured for the matched service.

## Policy

The matched service's existing `min_project_value` and `currency` remain the source of truth.

Unknown budgets are never rejected. If a candidate does not expose a reliable maximum budget, or its currency cannot be normalized safely, its commercial fit is recorded as `unknown` and Quality v2 continues normally.

When an explicit maximum budget can be compared with the matched service minimum:

- **Explicit maximum is less than 50% of the service minimum** → `far_below_minimum` → reject before opportunity creation.
- **50% to below 100% of the service minimum** → `below_minimum` → keep for review with a 15-point preliminary-score penalty.
- **100% or more of the service minimum** → `meets_minimum` → no commercial-value penalty.

This intentionally uses the maximum posted budget, not the minimum, so a broad budget range is not rejected merely because its lower bound is small.

## Conservative currency normalization

Commercial comparison uses simple planning ratios for common marketplace currencies:

- INR = 1
- USD = 90 INR
- EUR = 105 INR
- GBP = 120 INR
- AUD = 60 INR
- AED = 25 INR
- CAD = 65 INR

These are conservative currency normalization references for lead triage only. They are not exchange-rate quotes and must never be used for billing, accounting, settlement, invoicing, or financial reporting.

If a project or service uses a currency outside the supported set, commercial fit remains `unknown` rather than making an unsafe assumption.

## Stored opportunity facts

Qualified opportunities persist:

- `commercial_fit`
- `budget_fit_ratio`
- `matched_service_min_value`
- `matched_service_currency`
- `normalized_budget_max`
- `commercial_value_reason`

The opportunity drawer displays the fit status and explanation so score changes remain transparent.

## Why the guard exists

The initial Google + Freelancer production comparison showed that direct marketplace acquisition was highly relevant, but several technically valid projects had explicit budgets far below the user's configured service floors. Relevance and buyer intent alone are therefore insufficient for commercial qualification.
