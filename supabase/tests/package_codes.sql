begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
select id as admin_id from public.profiles where username='admin' \gset
select id as district_id from public.profiles where username='melak' \gset
insert into public.categories(name) values('[TEST] Package codes') returning id as category_id \gset
set local role authenticated;
select set_config('request.jwt.claim.sub',:'admin_id',true);
select public.maqro_action('package',jsonb_build_object('category_id',:'category_id','surah','[TEST] Automatic','verses','1-5'));
select id as package_id, code as package_code from public.packages where category_id=:'category_id' \gset
select pg_temp.assert_true(:'package_code' ~ '^MQ-[0-9]{6,}$','RPC creates package without manual code');
select pg_temp.assert_true((select count(*)=1 from public.logs where message='Paket maqro ditambahkan: '||:'package_code'),'audit uses generated code');
select public.maqro_action('package',jsonb_build_object('category_id',:'category_id','code','MANUAL-IGNORED','surah','[TEST] Manual ignored','verses','6-10'));
select pg_temp.assert_true((select bool_and(code ~ '^MQ-[0-9]{6,}$') from public.packages where category_id=:'category_id'),'manual payload cannot override code');
select set_config('request.jwt.claim.sub',:'district_id',true);
do $$begin
 begin perform public.maqro_action('package','{}'); exception when others then
 if sqlerrm='Tindakan hanya untuk panitia.' then raise notice 'PASS: district cannot create package';return;end if;raise;end;
 raise exception 'FAIL: district could create package';
end $$;
reset role;
insert into public.packages(category_id,surah,verses,seed_key) values(:'category_id','[TEST] Seed','1-5','[TEST] seed-key') on conflict(seed_key) do nothing;
insert into public.packages(category_id,surah,verses,seed_key) values(:'category_id','[TEST] Seed','1-5','[TEST] seed-key') on conflict(seed_key) do nothing;
select pg_temp.assert_true((select count(*)=1 from public.packages where seed_key='[TEST] seed-key'),'seed key prevents duplicate records');
select pg_temp.assert_true((select bool_and(code ~ '^MQ-[0-9]{6,}$') from public.packages where category_id=:'category_id'),'direct seed insert also generates code');
do $$begin
 begin update public.packages set code='CHANGED' where seed_key='[TEST] seed-key'; exception when others then
 if sqlerrm='Kode paket tidak dapat diubah.' then raise notice 'PASS: existing code is immutable';return;end if;raise;end;
 raise exception 'FAIL: code could be changed';
end $$;
rollback;
