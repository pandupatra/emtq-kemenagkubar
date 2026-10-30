begin;
lock table public.sessions in share row exclusive mode;
-- Existing draw RPCs already enforce package uniqueness when repeat is false.
alter table public.sessions alter column repeat set default false;
update public.sessions set repeat=false where repeat;
do $$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.sessions'::regclass and conname='sessions_require_unique_packages') then
   alter table public.sessions add constraint sessions_require_unique_packages check(repeat=false);
 end if;
end;
$$;
commit;
