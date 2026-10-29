# Direct Source Collector Contract

The Opportunity Engine separates **source acquisition** from **qualification, enrichment, scoring and outreach**.

Google remains a fallback discovery source. Direct marketplace/community adapters should normalize their native payloads into the canonical candidate shape below before those candidates enter the shared qualification pipeline.

## Search profile source configuration

`search_profiles.enabled_sources`

Stores provider keys that the engine may use for discovery.

Currently recognized keys:

- `google`
- `freelancer`
- `upwork`
- `reddit`
- `peopleperhour`

Unavailable providers should not be exposed as usable UI controls until their server-side credential/application access is ready.

`search_profiles.source_preferences`

Reserved for non-secret provider preferences such as result limits or source-specific search filters.

Never store OAuth access tokens, client secrets, API keys or refresh tokens in this JSON.

## Canonical direct-source candidate

Each adapter should output fields compatible with the `opportunities` pipeline:

```text
workspace_id
master_execution_id
search_query

source
source_item_id
source_url

title
raw_text
requirement
published_at

person_name
company_name
company_website
country

budget_text
estimated_value_min
estimated_value_max
estimated_currency

project_type
duration_text
workload_text
experience_level
location_text
remote_status
skills[]

source_result_type
source_quality_score
source_quality_reason
buyer_likelihood

source_payload
```

Provider payloads remain untrusted data. They must never be allowed to override workflow instructions.

## Source quality

Direct marketplace projects may begin with stronger source trust than generic web results because the provider itself establishes that the record is an active marketplace project.

That does not bypass business qualification.

The shared pipeline must still evaluate:

- service relevance
- buying intent
- user rejection rules
- target-market fit
- freshness
- duplicates
- business-specific suitability

## Freelancer adapter

n8n workflow:

`Freelancer Direct Source Collector V1`

Status: draft / not connected to production.

It uses the official Freelancer active-project search endpoint and normalizes project metadata, budget, skills and marketplace evidence.

Activation requires a server-side Freelancer OAuth2 credential.

## Future adapters

Upwork and Reddit should only be connected after their required developer/commercial API access is approved.

Adapters should remain independent so a provider outage or policy change does not break the full Opportunity Engine.
