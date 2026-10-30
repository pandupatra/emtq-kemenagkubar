begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
select pg_temp.assert_true(not exists(select 1 from public.sessions where repeat),'all existing sessions use unique packages');
select id as admin_id from public.profiles where username='admin' \gset
select id as melak_id from public.profiles where username='melak' \gset
select id as damai_id from public.profiles where username='damai' \gset
insert into public.categories(name) values('[TEST] Fixed packages') returning id as category_id \gset
insert into public.sessions(category_id) values(:'category_id') returning id as preliminary_id \gset
do $$begin
 begin insert into public.sessions(category_id) select category_id from public.sessions limit 1;
 exception when unique_violation then raise notice 'PASS: one session per category enforced'; return; end;
 raise exception 'FAIL: duplicate category session accepted';
end $$;
select pg_temp.assert_true((select not repeat from public.sessions where id=:'preliminary_id'),'new sessions default to unique packages');
do $$begin
 begin update public.sessions set repeat=true; exception when check_violation then raise notice 'PASS: database rejects repeat mode';return;end;
 raise exception 'FAIL: repeat mode was accepted';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'admin_id',true);
create function pg_temp.reject_repeat_rpc(payload jsonb) returns void language plpgsql as $$
begin
 begin perform public.maqro_action('session',payload); exception when check_violation then raise notice 'PASS: legacy RPC cannot enable repeat mode';return;end;
 raise exception 'FAIL: RPC enabled repeat mode';
end $$;
select pg_temp.reject_repeat_rpc(jsonb_build_object('id',:'preliminary_id','open',false,'repeat',true));
select public.maqro_action('package',jsonb_build_object('category_id',:'category_id','surah','[TEST] Fixed material','verses','1-5'));
select public.maqro_action('person',jsonb_build_object('name','[TEST] Fixed Melak','district','MELAK','birth','2000-01-01','gender','Putra','entries',jsonb_build_array(:'category_id')));
select public.maqro_action('person',jsonb_build_object('name','[TEST] Fixed Damai','district','DAMAI','birth','2000-01-01','gender','Putri','entries',jsonb_build_array(:'category_id')));
select id as melak_person from public.people where name='[TEST] Fixed Melak' \gset
select id as damai_person from public.people where name='[TEST] Fixed Damai' \gset
select public.maqro_action('session',jsonb_build_object('id',:'preliminary_id','open',true,'repeat',false));
select set_config('request.jwt.claim.sub',:'melak_id',true);
select public.maqro_action('draw',jsonb_build_object('id',:'melak_person','session_id',:'preliminary_id'));
select public.maqro_action('draw',jsonb_build_object('id',:'melak_person','session_id',:'preliminary_id'));
select pg_temp.assert_true((select count(*)=1 from public.results where person_id=:'melak_person'),'same participant receives one active result per session');
select set_config('request.jwt.claim.sub',:'damai_id',true);
create function pg_temp.expect_exhausted(payload jsonb) returns void language plpgsql as $$
begin
 begin perform public.maqro_action('draw',payload); exception when others then
 if sqlerrm like '%sudah habis%' then raise notice 'PASS: used package unavailable to another district in the same session';return;end if;raise;end;
 raise exception 'FAIL: package was reused in the same session';
end $$;
select pg_temp.expect_exhausted(jsonb_build_object('id',:'damai_person','session_id',:'preliminary_id'));
select pg_temp.assert_true((select count(*)=0 from public.results where person_id=:'damai_person'),'exhausted package cannot be obtained through another session');
rollback;
