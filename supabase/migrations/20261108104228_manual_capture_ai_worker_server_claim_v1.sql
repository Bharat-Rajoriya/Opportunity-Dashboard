-- Restrict queue-claiming to server-side worker, not arbitrary authenticated RPCs.
revoke all on function public.claim_manual_capture_qualification(uuid,uuid) from public,anon,authenticated;
create or replace function public.claim_manual_capture_qualification(
 p_workspace_id uuid,p_capture_id uuid,p_user_id uuid
) returns public.manual_capture_reviews
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.manual_capture_reviews%rowtype;
begin
 if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
 if not exists(select 1 from public.workspaces w where w.id=p_workspace_id and w.owner_user_id=p_user_id)
   then raise exception 'workspace_not_authorized'; end if;
 select * into c from public.manual_capture_reviews
 where workspace_id=p_workspace_id and id=p_capture_id for update;
 if not found then raise exception 'capture_not_found'; end if;
 if c.status <> 'pending_qualification' or c.qualification_attempts >= 2
   then raise exception 'capture_not_pending'; end if;
 update public.manual_capture_reviews
 set status='qualifying',qualification_started_at=now(),
     qualification_lease=gen_random_uuid(),qualification_attempts=qualification_attempts+1,
     qualification_reason=null
 where workspace_id=p_workspace_id and id=p_capture_id
 returning * into c;
 return c;
end $$;
revoke all on function public.claim_manual_capture_qualification(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_manual_capture_qualification(uuid,uuid,uuid) to service_role;