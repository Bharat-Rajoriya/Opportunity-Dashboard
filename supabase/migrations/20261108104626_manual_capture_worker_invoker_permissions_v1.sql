-- Worker endpoints are callable exclusively by service_role. SECURITY INVOKER
-- preserves current_user='service_role' and avoids unnecessary definer privileges.
alter function public.claim_manual_capture_qualification(uuid,uuid,uuid) security invoker;
alter function public.finish_manual_capture_qualification(uuid,uuid,uuid,jsonb) security invoker;
alter function public.fail_manual_capture_qualification(uuid,uuid,uuid,text) security invoker;