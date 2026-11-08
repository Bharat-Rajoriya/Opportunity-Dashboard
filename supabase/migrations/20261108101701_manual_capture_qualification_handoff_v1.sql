-- Applied to Supabase as migration 20261108101701.
-- This is an explicit review -> pending handoff, NOT an AI classification job.
alter table public.manual_capture_reviews
  drop constraint manual_capture_reviews_status_check;
alter table public.manual_capture_reviews
  add constraint manual_capture_reviews_status_check
  check (status in ('needs_review','dismissed','pending_qualification'));
alter table public.manual_capture_reviews
  add column submitted_for_qualification_at timestamptz;

create or replace function public.submit_manual_capture_for_qualification(
  p_workspace_id uuid, p_capture_id uuid
)
returns public.manual_capture_reviews
language plpgsql security invoker
set search_path = public
as $$
declare capture public.manual_capture_reviews%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.workspaces
    where id = p_workspace_id and owner_user_id = auth.uid()
  ) then
    raise exception 'workspace_not_authorized';
  end if;

  select * into capture
  from public.manual_capture_reviews
  where id = p_capture_id and workspace_id = p_workspace_id
  for update;

  if not found then raise exception 'capture_not_found'; end if;
  if capture.status <> 'needs_review' then raise exception 'capture_not_reviewable'; end if;
  if exists (
    select 1 from public.opportunities o
    where o.workspace_id = p_workspace_id
      and o.source_url is not null
      and lower(regexp_replace(split_part(o.source_url, '?', 1), '/+$', '')) =
          lower(regexp_replace(split_part(capture.source_url, '?', 1), '/+$', ''))
  ) then
    raise exception 'already_captured_opportunity';
  end if;

  update public.manual_capture_reviews
  set status = 'pending_qualification', submitted_for_qualification_at = now()
  where id = capture.id and workspace_id = p_workspace_id
  returning * into capture;
  return capture;
end $$;
revoke all on function public.submit_manual_capture_for_qualification(uuid,uuid) from public,anon;
grant execute on function public.submit_manual_capture_for_qualification(uuid,uuid) to authenticated;
create index if not exists manual_capture_pending_qualification_idx
on public.manual_capture_reviews (workspace_id, submitted_for_qualification_at)
where status='pending_qualification';