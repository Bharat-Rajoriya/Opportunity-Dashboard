delete from public.workspaces w
using (
  select owner_user_id,
         array_agg(id order by onboarding_completed desc, created_at asc) as ids
  from public.workspaces
  group by owner_user_id
  having count(*) > 1
) duplicates
where w.owner_user_id = duplicates.owner_user_id
  and w.id <> duplicates.ids[1];

create unique index if not exists workspaces_owner_user_id_unique
on public.workspaces(owner_user_id);
