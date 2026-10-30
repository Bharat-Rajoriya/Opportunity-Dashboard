# Scope-to-Budget Fit V1

Scope-to-Budget Fit extends Commercial Value Guard so a project is not considered commercially healthy merely because its posted budget clears the base minimum for a service.

## Scope classification

The opportunity classifier evaluates implementation scope from the requirement itself.

Do not use the posted budget to classify scope complexity.

Supported levels and deterministic multipliers:

- **small = 1×** — focused bug fix, one landing page, small styling task, one simple integration, or another narrowly bounded change.
- **medium = 1.5×** — multi-page site, theme customization, standard ecommerce build, moderate custom functionality, or one main system with several related features.
- **large = 2.5×** — custom application, dashboard, authentication, several custom modules, multiple integrations, substantial workflow logic, or significant bespoke functionality.
- **very_large = 4×** — SaaS/platform/marketplace/MVP with several major systems such as authentication, roles/profiles, advanced search, APIs/backend, cloud deployment, CI/CD, privacy/compliance, messaging, job posts, multi-tenant behavior, or explicit future-scale architecture.
- **unknown = 1× for storage only** — insufficient evidence. Unknown scope does not trigger scope-budget penalties or rejection.

The model supplies `scope_complexity` and `scope_reason`. Code maps the category to its multiplier; the model never chooses the monetary multiplier.

## Scope-adjusted minimum

`scope_adjusted_min_value = matched_service_min_value × scope_multiplier`

The existing conservative currency normalization converts the explicit maximum posted budget into the matched service currency before comparison.

`scope_budget_fit_ratio = normalized_budget_max / scope_adjusted_min_value`

## Decision policy

When a reliable maximum budget and non-unknown scope are available:

- **less than 40%** → `far_below_scope` → reject before opportunity creation.
- **40%–75%** → `significantly_below_scope` → keep, apply a 25-point penalty and cap the action at `research`.
- **75%–100%** → `below_scope` → keep, apply a 10-point penalty and prevent `high_priority_pitch`.
- **100% or more** → `meets_scope` → no scope-budget penalty.

Unknown budgets or unknown scope remain `unknown` and are not rejected by this layer.

Commercial Value Guard still runs first. Therefore a project can fail the base service floor even before scope adjustment.

## Final Scoring consistency

Final Scoring applies the same policy.

It subtracts the same effective scope-budget penalties from the final score and reapplies action caps. This prevents a strong service/portfolio fit from promoting an under-budgeted large-scope project back to `pitch`.

## Example

A Frontend Development service has a configured base minimum of ₹40,000.

A very-large platform MVP therefore has a scope-adjusted minimum of:

₹40,000 × 4 = ₹160,000

If the maximum posted budget normalizes to ₹67,500:

₹67,500 / ₹160,000 = 42.2%

That candidate is still a genuine buyer opportunity, but its budget is materially below the requested scope. It should be retained for research/negotiation rather than treated as a normal pitch-ready lead.
