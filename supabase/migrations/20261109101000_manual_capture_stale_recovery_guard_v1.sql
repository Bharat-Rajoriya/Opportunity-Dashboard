-- PR #76: protect audit history and explicitly expire stuck manual AI leases.
-- No scheduled processor, automatic retry or new LLM call.
drop policy if exists "Owner delete manual captures" on public.manual_capture_reviews;
create policy "Owner delete review-only manual captures"
on public.manual_capture_reviews for delete to authenticated
using (
  status in ('needs_review','dismissed')
  and exists (
    select 1 from public.workspaces w
    where w.id=manual_capture_reviews.workspace_id
    and w.owner_user_id=(select auth.uid())
  )
);

-- Called by an authenticated Edge Function only after user-RLS ownership checks.
-- SQL performs its own authoritative owner and expiry checks. It never resets
-- attempts or returns the capture to a billable pending state.
create or replace function public.expire_stalled_manual_capture_qualification(
  p_workspace_id uuid, p_capture_id uuid, p_user_id uuid
) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  c public.manual_capture_reviews%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if not exists (
    select 1 from public.workspaces w
    where w.id=p_workspace_id and w.owner_user_id=p_user_id and w.active=true
  ) then
    raise exception 'workspace_not_authorized';
  end if;

  select * into c from public.manual_capture_reviews
  where workspace_id=p_workspace_id and id=p_capture_id for update;

  if not found then raise exception 'capture_not_found'; end if;
  if c.status <> 'qualifying' then
    raise exception 'capture_not_qualifying';
  end if;
  if c.qualification_started_at is null or
    c.qualification_started_at > now() - interval '180 seconds' then
    raise exception 'qualification_lease_not_expired';
  end if;

  update public.manual_capture_reviews
  set status='failed',
      qualification_finished_at=now(),
      qualification_reason='AI qualification was interrupted or timed out. No opportunity was created by this recovery action.',
      qualification_lease=null
  where workspace_id=p_workspace_id and id=p_capture_id
    and status='qualifying';

  return jsonb_build_object(
    'status','failed','capture_id',p_capture_id,
    'retry_scheduled',false,'outreach_started',false
  );
end $$;
revoke all on function public.expire_stalled_manual_capture_qualification(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.expire_stalled_manual_capture_qualification(uuid,uuid,uuid) to service_role;
