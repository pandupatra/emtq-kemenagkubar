begin;

set local lock_timeout = '5s';

-- Some hosted databases retain code after the draw RPC stops writing it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results'
      and column_name = 'code'
  ) then
    alter table public.results alter column code drop not null;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
