-- Service-only provider failure guard for n8n coordinated SerpApi recovery.
-- Previously deployed through Supabase apply_migration as provider_failure_guard_v1.
-- Existing circuit rows and cooldown values are preserved.
create or replace function public.record_provider_failure_if_unleased(
  p_provider text,
  p_failure_code integer,
  p_failure_source text default 'google'
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated text;
begin
  if p_provider is null or length(trim(p_provider)) < 1 or length(p_provider) > 64
     or p_failure_code is null or p_failure_code < 400 or p_failure_code > 599
     or p_failure_source is null or length(trim(p_failure_source)) < 1
     or length(p_failure_source) > 64 then
    raise exception 'Invalid provider failure parameters';
  end if;

  update public.external_provider_circuits
     set cooldown_until = clock_timestamp()
           + case when p_failure_code = 429 then interval '24 hours' else interval '15 minutes' end,
         last_failure_at = clock_timestamp(),
         last_failure_code = p_failure_code,
         last_failure_source = p_failure_source,
         updated_at = clock_timestamp()
   where provider = p_provider
     and (probe_lease_token is null
       or (probe_lease_until is not null and probe_lease_until <= clock_timestamp()))
  returning provider into v_updated;
  return v_updated is not null;
end;
$$;

revoke all on function public.record_provider_failure_if_unleased(text,integer,text)
  from public, anon, authenticated;
grant execute on function public.record_provider_failure_if_unleased(text,integer,text)
  to service_role;
comment on function public.record_provider_failure_if_unleased(text,integer,text)
  is 'Service-only cooldown update for normal provider requests; never overrides an unexpired recovery lease.';
