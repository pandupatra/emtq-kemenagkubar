begin;

lock table public.sessions, public.packages, public.results in access exclusive mode;
drop trigger if exists automatic_package_code on public.packages;
drop function if exists public.assign_package_code();
drop sequence if exists public.maqro_package_code_seq;
alter table public.packages drop column code;
alter table public.results drop column code;

create or replace function public.maqro_action(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 me public.profiles; p public.people; s public.sessions; m public.packages; r public.results;
 target uuid; ids uuid[]; participant_district text; message text; output jsonb:='{}';
begin
 select * into me from public.profiles where id=auth.uid() for share;
 if me.id is null or not me.active then raise exception 'Akses akun tidak tersedia.'; end if;
 if action in ('person','participant-session','session','package','cancel','account') and me.role<>'admin' then raise exception 'Tindakan hanya untuk panitia.'; end if;
 if action='draw' and me.role<>'district' then raise exception 'Tindakan hanya untuk kecamatan.'; end if;
 target:=nullif(payload->>'id','')::uuid;
 if action='person' then
   participant_district:=trim(payload->>'district');
   if not exists(select 1 from public.profiles where role='district' and district=participant_district) then raise exception 'Pilih kecamatan yang tersedia.'; end if;
   select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'entries');
   if ids is null or cardinality(ids)=0 or exists(select 1 from unnest(ids) x where not exists(select 1 from public.categories c where c.id=x)) then raise exception 'Pilih cabang yang tersedia.'; end if;
   if target is null then
     insert into public.people(participant_number,name,district,birth,gender,entries) values(nullif(trim(payload->>'participant_number'),''),trim(payload->>'name'),participant_district,(payload->>'birth')::date,payload->>'gender',ids) returning * into p;
   else
     select * into p from public.people where id=target for update;
     if p.id is null then raise exception 'Peserta tidak ditemukan.'; end if;
     if p.district<>participant_district and exists(select 1 from public.results where person_id=p.id) then raise exception 'Kecamatan peserta yang sudah memiliki hasil undian tidak dapat dipindahkan.'; end if;
     update public.people set participant_number=case when payload ? 'participant_number' then nullif(trim(payload->>'participant_number'),'') else p.participant_number end,name=trim(payload->>'name'),district=participant_district,birth=(payload->>'birth')::date,gender=payload->>'gender',entries=ids where id=target returning * into p;
   end if;
   message:='Data peserta disimpan: '||p.name;
 elsif action='participant-session' then
   if jsonb_typeof(payload->'ids') is distinct from 'array' or jsonb_typeof(payload->'open') is distinct from 'boolean' then
     raise exception 'Pilih peserta dan status sesi yang valid.';
   end if;
   select array_agg(distinct value::uuid) into ids from jsonb_array_elements_text(payload->'ids');
   if coalesce(cardinality(ids),0)=0 then raise exception 'Pilih minimal satu peserta.'; end if;
   perform 1 from public.people where id=any(ids) order by id for update;
   if (select count(*) from public.people where id=any(ids))<>cardinality(ids) then raise exception 'Sebagian peserta tidak ditemukan. Muat ulang daftar peserta.'; end if;
   update public.people set session_open=(payload->>'open')::boolean where id=any(ids);
   message:='Sesi peserta '||case when (payload->>'open')::boolean then 'dibuka' else 'ditutup' end||': '||cardinality(ids)||' peserta / ID: '||array_to_string(ids,', ');
 elsif action='session' then
   select * into s from public.sessions where id=target for update;
   if s.id is null then raise exception 'Sesi tidak ditemukan.'; end if;
   if (payload->>'open')::boolean and not exists(select 1 from public.packages where category_id=s.category_id) then raise exception 'Tambahkan paket maqro sebelum membuka sesi.'; end if;
   update public.sessions set open=(payload->>'open')::boolean, repeat=(payload->>'repeat')::boolean where id=target;
   message:='Pengaturan sesi diperbarui: '||(select name from public.categories where id=s.category_id);
 elsif action='package' then
   insert into public.packages(category_id,surah,verses) values((payload->>'category_id')::uuid,trim(payload->>'surah'),trim(payload->>'verses')) returning * into m;
   message:='Paket maqro ditambahkan: '||m.surah||' / '||m.verses;
   output:=to_jsonb(m);
 elsif action='account' then
   if target=me.id then raise exception 'Akun panitia sendiri tidak dapat dinonaktifkan.'; end if;
   update public.profiles set active=(payload->>'active')::boolean where id=target and role='district';
   if not found then raise exception 'Akun kecamatan tidak ditemukan.'; end if;
   message:='Status akun diperbarui: '||(select username from public.profiles where id=target);
 elsif action='draw' then
   select * into s from public.sessions where id=(payload->>'session_id')::uuid for update;
   if s.id is null or not s.open then raise exception 'Sesi undian belum dibuka atau sudah ditutup.'; end if;
   select * into p from public.people where id=target for share;
   if p.id is null or p.district<>me.district or not s.category_id=any(p.entries) then raise exception 'Peserta tidak memenuhi ketentuan sesi.'; end if;
   if not p.session_open then raise exception 'Sesi peserta ditutup. Hubungi panitia untuk membuka sesi.'; end if;
   select * into r from public.results where person_id=p.id and session_id=s.id and not cancelled;
   if r.id is not null then return to_jsonb(r); end if;
   select * into m from public.packages k where k.category_id=s.category_id and not exists(
     select 1 from public.results x where x.session_id=s.id and x.package_id=k.id and not x.cancelled
   ) order by extensions.gen_random_bytes(16) limit 1;
   if m.id is null then raise exception 'Paket maqro untuk sesi ini sudah habis atau belum tersedia.'; end if;
   insert into public.results(person_id,session_id,package_id,name,district,category,surah,verses,gender)
   values(p.id,s.id,m.id,p.name,p.district,(select name from public.categories where id=s.category_id),m.surah,m.verses,p.gender) returning * into r;
   output:=to_jsonb(r); message:='Undian tersimpan: '||p.name||' / '||m.surah||' / '||m.verses;
 elsif action='cancel' then
   if length(trim(coalesce(payload->>'reason',''))) not between 1 and 250 then raise exception 'Isi alasan pembatalan, maksimal 250 karakter.'; end if;
   select * into r from public.results where id=target;
   perform 1 from public.sessions where id=r.session_id for update;
   update public.results set cancelled=true,reason=trim(payload->>'reason') where id=target and not cancelled;
   if not found then raise exception 'Hasil sudah dibatalkan atau tidak ditemukan.'; end if;
   message:='Hasil dibatalkan: '||r.id||'. Alasan: '||trim(payload->>'reason');
 else raise exception 'Tindakan tidak dikenali.';
 end if;
 insert into public.logs(actor,message) values(me.id,message);
 return output;
end;
$$;
revoke execute on function public.maqro_action(text,jsonb) from public,anon;
grant execute on function public.maqro_action(text,jsonb) to authenticated;
create or replace function public.delete_draw_history(result_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  ids uuid[];
  deleted_count integer;
  deleted_history jsonb;
begin
  select * into me from public.profiles where id = auth.uid() for share;
  if me.id is null or not me.active or me.role <> 'admin' then
    raise exception 'Hapus histori undian hanya tersedia untuk panitia aktif.';
  end if;
  select array_agg(distinct id) into ids from unnest(result_ids) id where id is not null;
  if coalesce(cardinality(ids), 0) = 0 then
    raise exception 'Pilih hasil undian yang akan dihapus.';
  end if;

  -- Draws and cancellations take the same session lock before changing results.
  perform 1 from public.sessions
  where id in (select session_id from public.results where id = any(ids))
  order by id for update;
  perform 1 from public.results where id = any(ids) order by id for update;
  if (select count(*) from public.results where id = any(ids)) <> cardinality(ids) then
    raise exception 'Sebagian histori sudah dihapus. Muat ulang daftar peserta.';
  end if;

  select jsonb_agg(jsonb_build_object('id', id, 'person_id', person_id,
    'name', name, 'category', category, 'surah', surah, 'verses', verses, 'cancelled', cancelled) order by id)
  into deleted_history from public.results where id = any(ids);
  delete from public.results where id = any(ids);
  get diagnostics deleted_count = row_count;
  insert into public.logs(actor, message) values (me.id,
    'Histori undian dihapus permanen: ' || deleted_count || ' hasil / ' || deleted_history::text);
  return jsonb_build_object('deleted_results', deleted_count, 'ids', to_jsonb(ids));
end;
$$;

revoke all on function public.delete_draw_history(uuid[]) from public, anon, authenticated;
grant execute on function public.delete_draw_history(uuid[]) to authenticated;


notify pgrst, 'reload schema';
commit;
