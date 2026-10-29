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
source_environment
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

Status: sandbox verified / production locked.

The sandbox adapter is connected to a server-side OAuth2 credential in n8n and has passed both API smoke testing and an end-to-end Quality v2 run.

The adapter currently uses Freelancer sandbox endpoints only. Normalized sandbox records must set `source_environment = sandbox` and must generate `freelancer-sandbox.com` project URLs. Production project URLs must never be generated for sandbox records.

The dashboard exposes Freelancer as a sandbox-verified source but keeps live activation disabled unless `VITE_FREELANCER_PRODUCTION_ENABLED=true`. That frontend gate is only a UX safeguard; production activation also requires the n8n adapter itself to be switched to a production Freelancer credential and production API endpoint.

Provider credentials remain server-side in n8n and are never stored in `search_profiles.source_preferences` or shipped to the frontend.

## Future adapters

Upwork and Reddit should only be connected after their required developer/commercial API access is approved.

Adapters should remain independent so a provider outage or policy change does not break the full Opportunity Engine.

## Environment safety

Sandbox and production provider environments must be treated as separate integrations.

- sandbox credentials may only call sandbox API hosts
- sandbox candidates must keep sandbox source URLs
- production UI activation stays locked until the server-side production adapter is ready
- changing a frontend environment flag alone is not sufficient to make a provider production-ready
- test runs must not leave sandbox opportunities in live workspaces
