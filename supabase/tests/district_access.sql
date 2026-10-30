begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.rejected(action text, payload jsonb, pattern text) returns void language plpgsql as $$
begin
 begin perform public.maqro_action(action,payload);
 exception when others then
   if sqlerrm ~ pattern then raise notice 'PASS: rejected % (%)',action,pattern; return; end if;
   raise;
 end;
 raise exception 'FAIL: action % should have been rejected',action;
end $$;
select id as admin_id from public.profiles where username='admin' \gset
select id as melak_id from public.profiles where username='melak' \gset
select id as damai_id from public.profiles where username='damai' \gset
insert into public.categories(name) values ('[TEST] ACCESS') returning id as category_id \gset
insert into public.sessions(category_id) values (:'category_id') returning id as session_id \gset
set local role authenticated;
select set_config('request.jwt.claim.sub',:'admin_id',true);
select public.maqro_action('person',jsonb_build_object('name','[TEST] ACCESS Peserta','district','MELAK','birth','2000-01-01','gender','Putra','entries',jsonb_build_array(:'category_id')));
select id as person_id from public.people where name='[TEST] ACCESS Peserta' \gset
select pg_temp.assert_true((select status='Draf' from public.people where id=:'person_id'),'legacy default status is unchanged');
select pg_temp.rejected('person',jsonb_build_object('name','[TEST] Invalid','district','UNKNOWN','birth','2000-01-01','gender','Putra','entries',jsonb_build_array(:'category_id')),'Pilih kecamatan');
select set_config('request.jwt.claim.sub',:'melak_id',true);
select pg_temp.assert_true((select count(*)=1 from public.people where id=:'person_id'),'own district can list participant');
select pg_temp.rejected('person',jsonb_build_object('id',:'person_id'),'hanya untuk panitia');
select pg_temp.rejected('submit',jsonb_build_object('id',:'person_id'),'tidak dikenali');
select pg_temp.rejected('draw',jsonb_build_object('id',:'person_id','session_id',:'session_id'),'belum dibuka');
select pg_temp.assert_true((select count(*)=0 from public.packages),'district cannot read package bank');
select set_config('request.jwt.claim.sub',:'damai_id',true);
select pg_temp.assert_true((select count(*)=0 from public.people where id=:'person_id'),'RLS hides other district participants');
select set_config('request.jwt.claim.sub',:'admin_id',true);
select pg_temp.rejected('verify',jsonb_build_object('id',:'person_id'),'tidak dikenali');
select pg_temp.rejected('revise',jsonb_build_object('id',:'person_id'),'tidak dikenali');
select pg_temp.rejected('session',jsonb_build_object('id',:'session_id','open',true,'repeat',false),'Tambahkan paket');
select public.maqro_action('package',jsonb_build_object('category_id',:'category_id','code','[TEST] ACCESS P-01','surah','[TEST] Materi','verses','[TEST] Rentang'));
select public.maqro_action('session',jsonb_build_object('id',:'session_id','open',true,'repeat',false));
select set_config('request.jwt.claim.sub',:'damai_id',true);
select pg_temp.rejected('draw',jsonb_build_object('id',:'person_id','session_id',:'session_id'),'tidak memenuhi');
select set_config('request.jwt.claim.sub',:'melak_id',true);
select public.maqro_action('draw',jsonb_build_object('id',:'person_id','session_id',:'session_id'));
select id as result_id from public.results where person_id=:'person_id' and not cancelled \gset
select pg_temp.assert_true((select count(*)=1 from public.results where id=:'result_id'),'participant can draw without verification');
select public.maqro_action('draw',jsonb_build_object('id',:'person_id','session_id',:'session_id'));
select pg_temp.assert_true((select count(*)=1 from public.results where person_id=:'person_id'),'retry is idempotent');
select pg_temp.rejected('cancel',jsonb_build_object('id',:'result_id','reason','[TEST] Reason'),'hanya untuk panitia');
select set_config('request.jwt.claim.sub',:'damai_id',true);
select pg_temp.assert_true((select count(*)=0 from public.results where id=:'result_id'),'RLS hides other district results');
select set_config('request.jwt.claim.sub',:'admin_id',true);
select public.maqro_action('person',jsonb_build_object('name','[TEST] ACCESS Peserta Kedua','district','MELAK','birth','2000-01-01','gender','Putri','entries',jsonb_build_array(:'category_id')));
select id as person2_id from public.people where name='[TEST] ACCESS Peserta Kedua' \gset
select pg_temp.rejected('person',jsonb_build_object('id',:'person_id','name','[TEST] ACCESS Pindah','district','DAMAI','birth','2000-01-01','gender','Putra','entries',jsonb_build_array(:'category_id')),'tidak dapat dipindahkan');
select public.maqro_action('person',jsonb_build_object('id',:'person_id','name','[TEST] ACCESS Edit','district','MELAK','birth','2000-01-01','gender','Putra','entries',jsonb_build_array(:'category_id')));
select pg_temp.assert_true((select name='[TEST] ACCESS Peserta' from public.results where id=:'result_id'),'editing preserves receipt identity snapshot');
select set_config('request.jwt.claim.sub',:'melak_id',true);
select pg_temp.rejected('draw',jsonb_build_object('id',:'person2_id','session_id',:'session_id'),'sudah habis');
select set_config('request.jwt.claim.sub',:'admin_id',true);
select public.maqro_action('cancel',jsonb_build_object('id',:'result_id','reason','[TEST] ACCESS Koreksi'));
select pg_temp.assert_true((select cancelled and reason='[TEST] ACCESS Koreksi' from public.results where id=:'result_id'),'cancellation keeps history and reason');
select set_config('request.jwt.claim.sub',:'melak_id',true);
select public.maqro_action('draw',jsonb_build_object('id',:'person_id','session_id',:'session_id'));
select pg_temp.assert_true((select count(*)=2 from public.results where person_id=:'person_id'),'replacement preserves original receipt');
select set_config('request.jwt.claim.sub',:'admin_id',true);
select public.maqro_action('account',jsonb_build_object('id',:'melak_id','active',false));
select set_config('request.jwt.claim.sub',:'melak_id',true);
select pg_temp.assert_true((select count(*)=0 from public.people),'disabled account cannot read participants');
select pg_temp.rejected('draw',jsonb_build_object('id',:'person_id','session_id',:'session_id'),'Akses akun');
rollback;
