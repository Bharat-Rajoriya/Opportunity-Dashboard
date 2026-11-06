-- Account-specific recovery circuit for SerpApi Opportunity Dashboard 2.
-- The previous 'serpapi' record belongs to Account 1 and is not modified.
-- A 503 verification sentinel is NOT an observed HTTP error. It deliberately
-- forces the existing lease-protected path to make one initial probe.
insert into public.external_provider_circuits
  (provider,cooldown_until,last_failure_code,last_failure_source,last_failure_at,updated_at)
values
  ('serpapi_account_2',clock_timestamp()-interval '1 second',503,
   'account_2_verification_pending',null,clock_timestamp())
on conflict (provider) do nothing;

-- Only authenticated owners of active workspaces may read sanitized status;
-- never return lease tokens, credential IDs, failure payloads or execution IDs.
create or replace function public.get_provider_health_summary_v1(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
 v_uid uuid := (select auth.uid());
 v_circuit record;
 v_now timestamptz := now();
 v_state text := 'unknown';
begin
 if v_uid is null or p_workspace_id is null or not exists (
   select 1 from public.workspaces
   where id=p_workspace_id and owner_user_id=v_uid and active is true
 ) then
   raise exception 'Workspace access denied' using errcode='42501';
 end if;
 select provider,last_failure_code,last_failure_source,cooldown_until,
        probe_lease_until,updated_at
 into v_circuit from public.external_provider_circuits
 where provider='serpapi_account_2';
 if not found then
   return jsonb_build_object('provider','serpapi','state','unknown','checked_at',v_now);
 end if;
 if v_circuit.probe_lease_until is not null and v_circuit.probe_lease_until > v_now then
   v_state:='recovery_in_progress';
 elsif v_circuit.last_failure_source='account_2_verification_pending' then
   v_state:='recovery_eligible';
 elsif coalesce(v_circuit.last_failure_code,0)<>0 then
   if v_circuit.cooldown_until is not null and v_circuit.cooldown_until>v_now then
     v_state:='cooldown';
   else
     v_state:='recovery_eligible';
   end if;
 elsif v_circuit.last_failure_source='recovery_probe_succeeded'
   and v_circuit.updated_at>=v_now-interval '24 hours' then
   v_state:='verified_recently';
 else
   v_state:='availability_unverified';
 end if;
 return jsonb_build_object('provider','serpapi','state',v_state,
   'cooldown_until',case when v_state='cooldown' then v_circuit.cooldown_until else null end,
   'checked_at',v_now);
end;
$$;
revoke all on function public.get_provider_health_summary_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_provider_health_summary_v1(uuid) to authenticated;
