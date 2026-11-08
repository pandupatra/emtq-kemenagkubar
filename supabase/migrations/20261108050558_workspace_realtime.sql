-- Only invalidation metadata is broadcast. SELECT policies still govern data reads.
create policy workspace_notifications on realtime.messages
for select to authenticated
using (
  extension = 'broadcast'
  and (
    (realtime.topic() = 'workspace:admin' and public.is_admin())
    or realtime.topic() = 'workspace:district:' || public.my_district()
  )
);

create function public.notify_workspace_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  affected text[];
  target_district text;
  changed boolean;
begin
  if tg_op = 'INSERT' then
    select exists(select 1 from new_rows) into changed;
  elsif tg_op = 'DELETE' then
    select exists(select 1 from old_rows) into changed;
  else
    select exists(select 1 from new_rows) into changed;
  end if;
  if not changed then return null; end if;

  perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed', 'workspace:admin', true);

  if tg_table_name in ('categories', 'sessions') then
    select array_agg(district) into affected from public.profiles
      where role = 'district' and active;
  elsif tg_table_name in ('people', 'results', 'profiles') then
    if tg_op = 'INSERT' then
      select array_agg(distinct district) into affected from new_rows;
    elsif tg_op = 'DELETE' then
      select array_agg(distinct district) into affected from old_rows;
    else
      select array_agg(distinct district) into affected from (
        select district from old_rows union select district from new_rows
      ) districts;
    end if;
  end if;

  foreach target_district in array coalesce(affected, array[]::text[]) loop
    if target_district is not null then
      perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed',
        'workspace:district:' || target_district, true);
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.notify_workspace_changes() from public, anon, authenticated;

-- Transition tables emit once per affected district per statement, including bulk edits.
do $$
declare table_name text;
begin
  foreach table_name in array array['categories', 'people', 'sessions', 'results', 'profiles', 'packages'] loop
    execute format('create trigger workspace_insert after insert on public.%I referencing new table as new_rows for each statement execute function public.notify_workspace_changes()', table_name);
    execute format('create trigger workspace_update after update on public.%I referencing old table as old_rows new table as new_rows for each statement execute function public.notify_workspace_changes()', table_name);
    execute format('create trigger workspace_delete after delete on public.%I referencing old table as old_rows for each statement execute function public.notify_workspace_changes()', table_name);
  end loop;
end;
$$;
