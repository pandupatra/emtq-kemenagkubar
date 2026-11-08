begin;
set local lock_timeout = '5s';
alter table public.people
 add column session_starts_at timestamptz,
 add column session_ends_at timestamptz,
 add constraint participant_session_range check (
   (session_starts_at is null and session_ends_at is null) or
   (session_starts_at is not null and session_ends_at is not null and session_ends_at > session_starts_at)
 );
create or replace function public.maqro_action(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 me public.profiles; represented public.profiles; impersonated_id uuid; p public.people; s public.sessions; m public.packages; r public.results;
 target uuid; ids uuid[]; participant_district text; message text; output jsonb:='{}';
begin
 select * into me from public.profiles where id=auth.uid() for share;
 if me.id is null or not me.active then raise exception 'Akses akun tidak tersedia.'; end if;
 if action in ('person','participant-session','session','package','cancel','account') and me.role<>'admin' then raise exception 'Tindakan hanya untuk panitia.'; end if;
 if payload ? 'impersonated_profile_id' then
   if action <> 'draw' or me.role <> 'admin' then raise exception 'Impersonasi hanya untuk undian oleh admin aktif.'; end if;
   impersonated_id := (payload->>'impersonated_profile_id')::uuid;
   select * into represented from public.profiles where id=impersonated_id for share;
   if represented.id is null or represented.role <> 'district' or not represented.active then raise exception 'Akun kecamatan tujuan tidak aktif atau tidak ditemukan.'; end if;
 elsif action='draw' and me.role<>'district' then
   raise exception 'Tindakan hanya untuk kecamatan.';
 else
   represented := me;
 end if;
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
   if (payload->>'session_starts_at' is null) <> (payload->>'session_ends_at' is null) then
     raise exception 'Isi waktu mulai dan selesai secara lengkap.';
   end if;
   if payload->>'session_starts_at' is not null and (payload->>'session_ends_at')::timestamptz <= (payload->>'session_starts_at')::timestamptz then
     raise exception 'Waktu selesai harus sesudah waktu mulai.';
   end if;
   update public.people set session_open=(payload->>'open')::boolean,
     session_starts_at=(payload->>'session_starts_at')::timestamptz,
     session_ends_at=(payload->>'session_ends_at')::timestamptz where id=any(ids);
   message:=coalesce('Jadwal WITA: ' || ((payload->>'session_starts_at')::timestamptz at time zone 'Asia/Makassar')::text || ' sampai ' || ((payload->>'session_ends_at')::timestamptz at time zone 'Asia/Makassar')::text || ' / ', '') || 'Sesi peserta '||case when payload->>'session_starts_at' is not null then 'dijadwalkan' when (payload->>'open')::boolean then 'dibuka' else 'ditutup' end||': '||cardinality(ids)||' peserta / ID: '||array_to_string(ids,', ');
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
   if p.id is null or p.district<>represented.district or not s.category_id=any(p.entries) then raise exception 'Peserta tidak memenuhi ketentuan sesi.'; end if;
   if not (case when p.session_starts_at is not null then statement_timestamp() >= p.session_starts_at and statement_timestamp() < p.session_ends_at else p.session_open end) then raise exception 'Sesi peserta ditutup. Hubungi panitia untuk membuka sesi.'; end if;
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
 if impersonated_id is not null then
   message := 'Admin ' || me.username || ' atas nama Kecamatan ' || represented.district || ': ' || message || ' / Hasil: ' || r.id;
 end if;
 insert into public.logs(actor,message,impersonated_profile_id) values(me.id,message,impersonated_id);
 return output;
end;
$$;
revoke execute on function public.maqro_action(text,jsonb) from public,anon;
grant execute on function public.maqro_action(text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
