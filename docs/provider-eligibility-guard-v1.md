# Provider Eligibility Guard V1

Provider Eligibility Guard prevents the Opportunity Engine from keeping projects the user cannot actually pursue because of explicit language or provider-location restrictions.

## Provider profile

Business Profile now stores:

- `provider_country` — the country where the freelancer/agency is actually based
- `working_languages` — languages the provider can genuinely use for client communication and delivery

Existing profiles are backfilled from `preferred_language`, so current users do not lose language eligibility behavior.

## Eligibility rules

### Buyer country is not provider eligibility

Buyer country is not provider eligibility.

A buyer may be in France, the USA, UAE, Australia, India, or anywhere else while still hiring globally.

Do not reject a remote opportunity merely because the buyer is in a different country.

Provider base country is context only and is not used as a hard filter.

If an opportunity explicitly requires the provider to be in a particular country/region, or platform metadata marks the project local-only and identifies the required country, the engine stores that requirement and shows it as an eligibility warning. The opportunity remains visible so the user can decide whether to pursue it.

If provider base country is missing, the engine keeps the country eligibility context unknown rather than rejecting the opportunity by guessing.

Target Countries remains the user's market preference. An empty target-country list means the user is open to opportunities from anywhere.

### Language eligibility

Freelancer exposes a platform project language such as `en`, `fr`, `de` or `es`.

A platform project language is treated as a real bidding eligibility constraint.

If the project language is not in the provider's configured working languages, the candidate is rejected with:

`provider_eligibility_mismatch:language`

For other sources, AI may identify an explicit requirement such as "native French required" or "Spanish-speaking contractor only."

Do not infer a language restriction merely because the description is written in another language. Text language alone is evidence only when the platform marks it as the project language or the buyer explicitly states the requirement.

## Stored opportunity fields

Eligible opportunities may persist:

- `project_language`
- `eligibility_match`
- `eligibility_restriction_type`
- `required_country`
- `required_language`
- `eligibility_reason`

The opportunity drawer displays these facts so users can understand location/language compatibility.

## Production validation

The exact Freelancer project that previously produced the "This is a Français project" bidding error was source item `40793896`.

Freelancer API metadata returned:

`language = fr`

The provider profile had:

`working_languages = [English]`

The full production collector re-evaluated that exact source item and rejected it with:

`provider_eligibility_mismatch:language`

This validation used the real platform metadata rather than language detection from the project description.
