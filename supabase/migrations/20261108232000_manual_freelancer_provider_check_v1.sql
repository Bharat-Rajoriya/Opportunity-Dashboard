-- PR74: store provider-backed listing existence separately from buyer verification.
alter table public.manual_capture_reviews
 add column if not exists provider_check_status text not null default 'not_checked'
   check(provider_check_status in ('not_checked','listing_confirmed','verification_failed')),
 add column if not exists provider_checked_at timestamptz,
 add column if not exists provider_check_evidence jsonb;

create or replace function public.record_manual_freelancer_provider_check(
  p_workspace_id uuid, p_capture_id uuid, p_status text, p_evidence jsonb
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.manual_capture_reviews%rowtype;
begin
 if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
 if p_status not in ('listing_confirmed','verification_failed') then
   raise exception 'invalid_provider_check_status'; end if;
 select * into c from public.manual_capture_reviews
  where id=p_capture_id and workspace_id=p_workspace_id for update;
 if not found or c.status <> 'qualified' or c.source_platform <> 'freelancer'
   or c.qualified_opportunity_id is null then raise exception 'capture_not_eligible'; end if;
 if not exists(select 1 from public.opportunities o where
   o.id=c.qualified_opportunity_id and o.workspace_id=p_workspace_id
   and o.source='manual_capture' and o.source_item_id=c.id::text)
   then raise exception 'related_opportunity_invalid'; end if;
 if jsonb_typeof(p_evidence) <> 'object'
   or p_evidence->>'provider' <> 'freelancer'
   or coalesce(length(p_evidence::text),0)>4000
   then raise exception 'invalid_provider_evidence'; end if;
 if p_status='listing_confirmed' and (
    p_evidence->>'provider_listing_found'<>'true'
    or coalesce(p_evidence->>'project_id','') !~ '^[0-9]{4,12}$'
    or coalesce(p_evidence->>'provider_title','')=''
 ) then raise exception 'invalid_confirmed_evidence'; end if;
 update public.manual_capture_reviews set
   provider_check_status=p_status,
   provider_checked_at=now(),
   provider_check_evidence=p_evidence
 where id=p_capture_id and workspace_id=p_workspace_id;
 -- No updates to opportunities, source_verified, score, or outreach.
 return jsonb_build_object('status',p_status,'capture_id',p_capture_id,
    'buyer_identity_verified',false,'payment_verified',false);
end $$;
revoke all on function public.record_manual_freelancer_provider_check(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_manual_freelancer_provider_check(uuid,uuid,text,jsonb) to service_role;
