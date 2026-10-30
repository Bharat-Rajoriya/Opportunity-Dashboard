# Adaptive Source Strategy V1

Adaptive Source Strategy uses the last 30-day Source Intelligence history to decide how much acquisition traffic each enabled source should receive.

The strategy changes search volume, not qualification standards. Quality v2 and Commercial Value Guard continue to decide whether individual candidates become opportunities.

## Safety principles

Sources are never automatically disabled.

A weak source always keeps at least **25% floor traffic** so the engine can detect recovery rather than permanently learning from stale history.

The strategy requires at least **10 evaluated candidates** before throttling a source. Until then, the source remains at full traffic.

A source cannot receive a volume boost until it has at least **25 evaluated candidates**.

## Traffic policy

For sources with fewer than 10 evaluated candidates:

- traffic multiplier = 1.0
- status = learning / insufficient sample

For sources with 10 or more evaluated candidates:

- qualification rate >= 30% → full traffic
- qualification rate 10%–29% → 50% traffic
- qualification rate < 10% → 25% floor traffic

For a direct source to receive a result-limit boost:

- at least 25 evaluated candidates
- qualification rate >= 50%
- duplicate rate < 50%

When all three are true, its configured result cap may be multiplied by **1.5×**, still bounded by the provider's hard safety limit.

## Google routing

Google's traffic multiplier controls how many selected search queries are actually sent to Google.

The query cursor still advances across the full configured batch. This prevents weak Google performance from blocking query rotation while preserving a smaller monitoring sample.

The reduced queries are spread across the selected batch rather than simply taking the first N queries.

## Direct-source routing

Freelancer continues to collapse dashboard search phrases into distinct marketplace anchor queries such as WordPress, Shopify, n8n, React or PageSpeed.

V1 does not reduce Freelancer below its user-configured result limit when it is healthy. A 1.5× boost becomes eligible only after the stronger 25-sample threshold.

## Production validation

The initial 30-day history before the validation run was:

- Google: 15 evaluated, 0 qualified → 0% qualification
- Freelancer: 10 evaluated, 9 qualified → 90% qualification

The generated V1 source plan was:

- Google → traffic multiplier 0.25 → very weak source / floor traffic
- Freelancer → traffic multiplier 1.0 → healthy source / full traffic
- Freelancer result-limit multiplier remained 1.0 because only 10 candidates had been evaluated

With a configured batch of 10 queries, the controlled routing validation produced:

- 10 total selected queries
- 3 Google searches
- 4 distinct Freelancer marketplace searches
- Freelancer limit remained 5 per marketplace query

The validation run is removed from historical metrics afterward so a test does not artificially trigger the 25-sample boost threshold.
