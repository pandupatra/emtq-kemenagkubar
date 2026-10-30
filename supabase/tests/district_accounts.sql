\set ON_ERROR_STOP on
begin;
do $$
declare a uuid; d public.profiles; renamed public.profiles; n integer; p uuid; s public.sessions; k public.packages; new_id uuid := gen_random_uuid();
begin
  select id into a from public.profiles where role='admin' and active limit 1;
  select * into d from public.profiles where role='district' order by id limit 1;
  if a is null or d.id is null then raise exception 'Provision admin and district fixtures first'; end if;
  select * into s from public.sessions limit 1;
  select * into k from public.packages where category_id=s.category_id limit 1;
  insert into public.people(name,district,birth,gender,entries) values('[TEST] Account rename',d.district,'2000-01-01','Putra',array[s.category_id]) returning id into p;
  insert into public.results(person_id,session_id,package_id,name,district,category,code,surah,verses,gender)
  values(p,s.id,k.id,'[TEST] Account rename',d.district,'[TEST]',k.code,k.surah,k.verses,'Putra');
  insert into auth.users(id) values(new_id);
  perform public.save_district_account(new_id,'test-new-account','[TEST] Kecamatan baru',a,true);
  if not exists(select 1 from public.profiles where id=new_id and role='district' and active) then raise exception 'New account invalid'; end if;
  select count(*) into n from public.people where district=d.district;
  select * into renamed from public.save_district_account(d.id,'test-renamed-account','[TEST] Kecamatan diperbarui',a,false,d.username);
  if renamed.username <> 'test-renamed-account' then raise exception 'Username unchanged'; end if;
  if (select count(*) from public.people where district=renamed.district) <> n then raise exception 'Participants lost'; end if;
  if exists(select 1 from public.people where district=d.district) or exists(select 1 from public.results where district=d.district) then raise exception 'Stale district references'; end if;
  if not exists(select 1 from public.results where person_id=p and district=renamed.district) then raise exception 'Result missing'; end if;
  begin
    perform public.save_district_account(new_id,'test-new-account',lower(renamed.district),a,false,'test-new-account');
    raise exception 'Duplicate district accepted';
  exception when unique_violation then null;
  end;
  if not exists(select 1 from public.logs where actor=a and message='Akun kecamatan diperbarui: test-renamed-account') then raise exception 'Missing audit'; end if;
  begin
    perform public.save_district_account(d.id,'test-renamed-account','[TEST] Other',a,false,d.username);
    raise exception 'Stale edit accepted';
  exception when raise_exception then
    if sqlerrm <> 'Akun telah berubah. Muat ulang data akun.' then raise; end if;
  end;
  begin
    perform public.save_district_account(a,'test-admin-edit','[TEST] Admin',a,false,'admin');
    raise exception 'Admin edited';
  exception when raise_exception then
    if sqlerrm <> 'Akun kecamatan tidak ditemukan.' then raise; end if;
  end;
  begin
    perform public.save_district_account(d.id,'test-other','[TEST] Other',d.id,false,renamed.username);
    raise exception 'District authorized';
  exception when raise_exception then
    if sqlerrm <> 'Tindakan hanya untuk panitia.' then raise; end if;
  end;
  if has_function_privilege('authenticated','public.save_district_account(uuid,text,text,uuid,boolean,text)','execute') then raise exception 'Client RPC accessible'; end if;
end $$;
rollback;
