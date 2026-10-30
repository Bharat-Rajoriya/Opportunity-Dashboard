alter table public.opportunities
  add column if not exists commercial_fit text,
  add column if not exists budget_fit_ratio numeric,
  add column if not exists matched_service_min_value numeric,
  add column if not exists matched_service_currency text,
  add column if not exists normalized_budget_max numeric,
  add column if not exists commercial_value_reason text;
