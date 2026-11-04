\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
select id as admin_id from public.profiles where role='admin' and active limit 1 \gset
select id as district_id from public.profiles where role='district' and active limit 1 \gset
insert into public.categories(name) values('[TEST] Maqro without codes') returning id as category_id \gset
select pg_temp.assert_true(not exists(select 1 from information_schema.columns where table_schema='public' and table_name in ('packages','results') and column_name='code'),'package and result schemas have no code');
set local role authenticated;
select set_config('request.jwt.claim.sub',:'admin_id',true);
select public.maqro_action('package',jsonb_build_object('category_id',:'category_id','surah','[TEST] Materi','verses','1-5'));
select pg_temp.assert_true((select count(*)=1 from public.packages where category_id=:'category_id'),'RPC creates package without code');
select set_config('request.jwt.claim.sub',:'district_id',true);
do $$begin
 begin perform public.maqro_action('package','{}'); exception when others then
 if sqlerrm='Tindakan hanya untuk panitia.' then raise notice 'PASS: district cannot create package';return;end if;raise;end;
 raise exception 'FAIL: district could create package';
end $$;
reset role;
insert into public.packages(category_id,surah,verses,seed_key) values(:'category_id','[TEST] Seed','1-5','[TEST] without-codes') on conflict(seed_key) do nothing;
insert into public.packages(category_id,surah,verses,seed_key) values(:'category_id','[TEST] Seed','1-5','[TEST] without-codes') on conflict(seed_key) do nothing;
select pg_temp.assert_true((select count(*)=1 from public.packages where seed_key='[TEST] without-codes'),'seed key prevents duplicate records');
rollback;
