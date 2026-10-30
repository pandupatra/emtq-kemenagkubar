\set ON_ERROR_STOP on
begin;
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name in ('sessions','results') and column_name='round') then
    raise exception 'FAIL: round column still exists';
  end if;
  if exists(select 1 from public.categories c where (select count(*) from public.sessions s where s.category_id=c.id)<>1) then
    raise exception 'FAIL: category does not have exactly one session';
  end if;
  if exists(select 1 from public.results where not cancelled group by person_id,session_id having count(*)>1) then
    raise exception 'FAIL: multiple active participant results';
  end if;
  if exists(select 1 from public.results where not cancelled group by package_id,session_id having count(*)>1) then
    raise exception 'FAIL: active package reused';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='one_active_package_per_session') then
    raise exception 'FAIL: package uniqueness index missing';
  end if;
  raise notice 'PASS: one session per category, no rounds, one active result per participant and package';
end $$;
rollback;
