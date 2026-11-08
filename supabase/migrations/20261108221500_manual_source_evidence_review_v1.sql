-- PR73: human-observed source evidence for qualified manual captures.
-- Human observation is NOT independent verification and never upgrades source_verified.
alter table public.manual_capture_reviews
  add column if not exists source_review_status text not null default 'not_reviewed'
    check (source_review_status in ('not_reviewed','appears_open','unavailable','unclear')),
  add column if not exists source_review_note text,
  add column if not exists source_reviewed_at timestamptz;

create or replace function public.record_manual_capture_source_review(
  p_workspace_id uuid, p_capture_id uuid, p_status text, p_note text default null
) returns public.manual_capture_reviews
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_capture public.manual_capture_reviews%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.workspaces w
    where w.id=p_workspace_id and w.owner_user_id=auth.uid()
  ) then raise exception 'workspace_not_authorized'; end if;
  if p_status not in ('appears_open','unavailable','unclear')
    then raise exception 'source_review_status_invalid'; end if;
  if length(coalesce(p_note,''))>1000 then raise exception 'source_review_note_too_long'; end if;
  if p_status='unclear' and length(btrim(coalesce(p_note,'')))<10
    then raise exception 'source_review_note_required'; end if;
  select * into v_capture from public.manual_capture_reviews
   where id=p_capture_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'capture_not_found'; end if;
  if v_capture.status <> 'qualified' or v_capture.qualified_opportunity_id is null
    then raise exception 'capture_not_qualified'; end if;
  if not exists (
    select 1 from public.opportunities o where
      o.id=v_capture.qualified_opportunity_id and o.workspace_id=p_workspace_id
      and o.source='manual_capture' and o.source_item_id=v_capture.id::text
  ) then raise exception 'related_opportunity_invalid'; end if;

  update public.manual_capture_reviews set source_review_status=p_status,
    source_review_note=nullif(btrim(coalesce(p_note,'')),''),
    source_reviewed_at=now()
  where workspace_id=p_workspace_id and id=p_capture_id returning * into v_capture;
  return v_capture;
end $$;
revoke all on function public.record_manual_capture_source_review(uuid,uuid,text,text) from public,anon;
grant execute on function public.record_manual_capture_source_review(uuid,uuid,text,text) to authenticated;

-- Client cannot directly forge evidence fields: existing update trigger enforces
-- authenticated status-only changes; SECURITY DEFINER RPC checks owner explicitly.
-- This migration leaves opportunity scores, source_verified, and outreach untouched.
