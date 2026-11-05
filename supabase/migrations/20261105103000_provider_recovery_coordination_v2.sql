-- Provider Recovery Coordination V2
-- Deploy only after staged SQL tests and backend integration review.
-- This migration is INERT until the n8n collector calls the new service-only RPCs.
-- Existing SerpApi cooldown values and the live n8n workflow are preserved.

alter table public.external_provider_circuits
  add column if not exists probe_lease_token uuid,
  add column if not exists probe_lease_until timestamptz,
  add column if not exists probe_execution_id text,
  add column if not exists probe_claimed_at timestamptz;

-- This table is strictly backend-owned. RLS adds defense in depth in the
-- public API schema, while grants bar all client access.
alter table public.external_provider_circuits enable row level security;
revoke all on public.external_provider_circuits from public, anon, authenticated;

create table if not exists public.provider_source_call_events (
  id bigint generated always as identity primary key,
  provider text not null check (length(provider) between 1 and 64),
  source text not null check (length(source) between 1 and 64),
  workspace_id uuid,
  master_execution_id text,
  request_kind text not null check (request_kind in ('discovery', 'recovery_probe')),
  outcome text not null check (outcome in ('success', 'failed', 'cooldown_skipped', 'probe_busy')),
  http_status integer check (http_status is null or http_status between 100 and 599),
  error_category text check (error_category is null or error_category in (
    'rate_limit', 'quota', 'auth', 'timeout', 'upstream', 'unknown'
  )),
  created_at timestamptz not null default now()
);
create index if not exists provider_source_call_events_provider_created_idx
  on public.provider_source_call_events (provider, created_at desc);
create index if not exists provider_source_call_events_run_idx
  on public.provider_source_call_events (workspace_id, master_execution_id, created_at desc);
alter table public.provider_source_call_events enable row level security;
revoke all on public.provider_source_call_events from public, anon, authenticated;
grant select, insert on public.provider_source_call_events to service_role;
grant usage, select on sequence public.provider_source_call_events_id_seq to service_role;

-- Service-role-only SECURITY INVOKER RPC. The conditional UPDATE takes a
-- Postgres row lock: concurrent claimers cannot both receive a lease.
-- No insert / missing-provider fallback: missing provider config fails closed.
create or replace function public.claim_provider_recovery_probe(
  p_provider text,
  p_execution_id text,
  p_lease_seconds integer default 180
)
returns table (granted boolean, lease_token uuid, retry_after timestamptz, reason text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token uuid := gen_random_uuid();
  v_until timestamptz;
  v_retry_after timestamptz;
  v_failure integer;
begin
  if p_provider is null or length(trim(p_provider)) < 1
     or length(p_provider) > 64
     or p_execution_id is null or length(trim(p_execution_id)) < 1
     or length(p_execution_id) > 128
     or p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception 'Invalid recovery probe claim parameters';
  end if;

  update public.external_provider_circuits
     set probe_lease_token = v_token,
         probe_lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
         probe_execution_id = p_execution_id,
         probe_claimed_at = clock_timestamp(),
         updated_at = clock_timestamp()
   where provider = p_provider
     and coalesce(last_failure_code, 0) <> 0
     and cooldown_until <= clock_timestamp()
     and (probe_lease_until is null or probe_lease_until <= clock_timestamp())
  returning probe_lease_until into v_until;

  if found then
    return query select true, v_token, v_until, 'probe_granted'::text;
    return;
  end if;

  select greatest(cooldown_until, coalesce(probe_lease_until, '-infinity'::timestamptz)),
         last_failure_code
    into v_retry_after, v_failure
    from public.external_provider_circuits
   where provider = p_provider;

  if not found then
    return query select false, null::uuid, null::timestamptz, 'provider_not_configured'::text;
  elsif coalesce(v_failure, 0) = 0 then
    return query select false, null::uuid, null::timestamptz, 'no_recovery_required'::text;
  else
    return query select false, null::uuid, v_retry_after, 'cooldown_or_probe_busy'::text;
  end if;
end;
$$;

-- The active lease holder alone may complete the probe. A late response from
-- an expired lease cannot erase a failure from a newer attempt.
create or replace function public.complete_provider_recovery_probe(
  p_provider text,
  p_lease_token uuid,
  p_success boolean,
  p_failure_code integer default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated text;
  v_code integer;
begin
  if p_provider is null or length(trim(p_provider)) < 1
     or length(p_provider) > 64
     or p_lease_token is null or p_success is null then
    raise exception 'Invalid recovery probe completion parameters';
  end if;

  v_code := case
    when p_success then 0
    when p_failure_code between 400 and 599 then p_failure_code
    else 503
  end;

  update public.external_provider_circuits
     set cooldown_until = case
           when p_success then clock_timestamp() - interval '1 second'
           when v_code = 429 then clock_timestamp() + interval '24 hours'
           else clock_timestamp() + interval '15 minutes'
         end,
         last_failure_at = case when p_success then last_failure_at else clock_timestamp() end,
         last_failure_code = v_code,
         last_failure_source = case when p_success then 'recovery_probe_succeeded' else 'recovery_probe_failed' end,
         probe_lease_token = null,
         probe_lease_until = null,
         probe_execution_id = null,
         probe_claimed_at = null,
         updated_at = clock_timestamp()
   where provider = p_provider
     and probe_lease_token = p_lease_token
     and probe_lease_until > clock_timestamp()
  returning provider into v_updated;

  return v_updated is not null;
end;
$$;

-- Public is an API schema: explicitly revoke default function EXECUTE.
revoke all on function public.claim_provider_recovery_probe(text,text,integer)
  from public, anon, authenticated;
revoke all on function public.complete_provider_recovery_probe(text,uuid,boolean,integer)
  from public, anon, authenticated;
grant execute on function public.claim_provider_recovery_probe(text,text,integer) to service_role;
grant execute on function public.complete_provider_recovery_probe(text,uuid,boolean,integer) to service_role;
comment on function public.claim_provider_recovery_probe(text,text,integer)
  is 'Service-only atomic per-provider recovery probe lease. No API request is made by this function.';
comment on function public.complete_provider_recovery_probe(text,uuid,boolean,integer)
  is 'Service-only lease-token-checked completion; late/stale responses never clear another probe lease.';
