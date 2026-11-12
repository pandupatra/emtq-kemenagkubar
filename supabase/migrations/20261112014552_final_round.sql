begin;
set local lock_timeout = '5s';

-- Separate tables keep existing clients and the live preliminary draw unchanged.
create table public.final_participants (
 id uuid primary key references public.people(id) on delete cascade,
 category_id uuid not null references public.categories(id),
 session_open boolean not null default false,
 session_starts_at timestamptz,
 session_ends_at timestamptz,
 check ((session_starts_at is null and session_ends_at is null) or
   (session_starts_at is not null and session_ends_at is not null and session_ends_at > session_starts_at))
);
create index final_participants_category on public.final_participants(category_id);
create table public.final_sessions (
 id uuid primary key default gen_random_uuid(),
 category_id uuid not null unique references public.categories(id),
 open boolean not null default false
);
create table public.final_packages (
 id uuid primary key default gen_random_uuid(),
 category_id uuid not null references public.categories(id),
 surah text not null check(length(trim(surah)) between 1 and 100),
 verses text not null check(length(trim(verses)) between 1 and 100)
);
create index final_packages_category on public.final_packages(category_id);
create table public.final_results (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.final_participants(id) on delete cascade,
 session_id uuid not null references public.final_sessions(id),
 package_id uuid not null references public.final_packages(id),
 name text not null, district text not null, category text not null,
 surah text not null, verses text not null, gender text not null,
 created_at timestamptz not null default now(),
 cancelled boolean not null default false, reason text not null default ''
);
create unique index final_one_active_result on public.final_results(person_id,session_id) where not cancelled;
create unique index final_one_active_package on public.final_results(session_id,package_id) where not cancelled;
create index final_results_package on public.final_results(package_id);
create index final_results_district on public.final_results(district);
insert into public.final_sessions(category_id) select id from public.categories;

alter table public.final_participants enable row level security;
alter table public.final_sessions enable row level security;
alter table public.final_packages enable row level security;
alter table public.final_results enable row level security;
create policy final_participants_read on public.final_participants for select to authenticated
 using ((select public.is_admin()) or exists(select 1 from public.people p where p.id=final_participants.id and p.district=(select public.my_district())));
create policy final_sessions_read on public.final_sessions for select to authenticated using ((select public.is_active()));
create policy final_packages_read on public.final_packages for select to authenticated using ((select public.is_admin()));
create policy final_results_read on public.final_results for select to authenticated using ((select public.is_admin()) or district=(select public.my_district()));
revoke all on public.final_participants,public.final_sessions,public.final_packages,public.final_results from public,anon,authenticated;
grant select on public.final_participants,public.final_sessions,public.final_packages,public.final_results to authenticated;

create function public.maqro_final_action(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 me public.profiles; represented public.profiles; impersonated uuid;
 p public.people; f public.final_participants; s public.final_sessions;
 m public.final_packages; r public.final_results;
 target uuid := nullif(payload->>'id','')::uuid;
 ids uuid[]; category uuid; affected integer; message text; draw_time timestamptz;
 output jsonb := '{}';
begin
 select * into me from public.profiles where id=auth.uid() for share;
 if me.id is null or not me.active then raise exception 'Akses akun tidak tersedia.'; end if;
 if action <> 'draw' and me.role <> 'admin' then raise exception 'Tindakan hanya untuk panitia.'; end if;
 represented := me;
 if payload ? 'impersonated_profile_id' then
   if action <> 'draw' or me.role <> 'admin' then raise exception 'Impersonasi hanya untuk undian oleh admin aktif.'; end if;
   impersonated := (payload->>'impersonated_profile_id')::uuid;
   select * into represented from public.profiles where id=impersonated for share;
   if represented.id is null or not represented.active or represented.role <> 'district' then raise exception 'Akun kecamatan tujuan tidak aktif atau tidak ditemukan.'; end if;
 elsif action='draw' and me.role <> 'district' then raise exception 'Tindakan hanya untuk kecamatan.';
 end if;

 if action in ('finalists','participant-session') then
   if jsonb_typeof(payload->'ids') is distinct from 'array' then raise exception 'Pilih minimal satu peserta.'; end if;
   select array_agg(distinct value::uuid) into ids from jsonb_array_elements_text(payload->'ids');
   if coalesce(cardinality(ids),0)=0 then raise exception 'Pilih minimal satu peserta.'; end if;
   perform 1 from public.people where id=any(ids) order by id for update;
   if (select count(*) from public.people where id=any(ids)) <> cardinality(ids) then raise exception 'Sebagian peserta tidak ditemukan. Muat ulang daftar peserta.'; end if;
   if action='finalists' then
     category := (payload->>'category_id')::uuid;
     if category is null or exists(select 1 from public.people where id=any(ids) and not category=any(entries)) then raise exception 'Pilih peserta sesuai cabangnya.'; end if;
     if exists(select 1 from public.final_participants where id=any(ids) and category_id<>category) then raise exception 'Peserta sudah ditetapkan pada cabang final lain.'; end if;
     insert into public.final_participants(id,category_id) select unnest(ids),category on conflict(id) do nothing;
     get diagnostics affected = row_count;
     insert into public.final_sessions(category_id) values(category) on conflict(category_id) do nothing;
     message := 'Finalis ditetapkan: '||affected||' peserta / ID: '||array_to_string(ids,', ');
   else
     if jsonb_typeof(payload->'open') is distinct from 'boolean' then raise exception 'Pilih status sesi yang valid.'; end if;
     if (select count(*) from public.final_participants where id=any(ids)) <> cardinality(ids) then raise exception 'Peserta belum ditetapkan sebagai finalis.'; end if;
     if (payload->>'session_starts_at' is null) <> (payload->>'session_ends_at' is null) then raise exception 'Isi waktu mulai dan selesai secara lengkap.'; end if;
     if payload->>'session_starts_at' is not null and (payload->>'session_ends_at')::timestamptz <= (payload->>'session_starts_at')::timestamptz then raise exception 'Waktu selesai harus sesudah waktu mulai.'; end if;
     update public.final_participants set session_open=(payload->>'open')::boolean,
       session_starts_at=(payload->>'session_starts_at')::timestamptz,
       session_ends_at=(payload->>'session_ends_at')::timestamptz where id=any(ids);
     message := 'Jadwal finalis diperbarui / ID: '||array_to_string(ids,', ');
   end if;
 elsif action='remove-finalist' then
   perform 1 from public.people where id=target for update;
   if exists(select 1 from public.final_results where person_id=target) then raise exception 'Finalis yang memiliki riwayat undian tidak dapat dikeluarkan.'; end if;
   delete from public.final_participants where id=target;
   if not found then raise exception 'Finalis tidak ditemukan.'; end if;
   message := 'Finalis dikeluarkan: '||target;
 elsif action='session' then
   category := (payload->>'category_id')::uuid;
   if category is null or jsonb_typeof(payload->'open') is distinct from 'boolean' then raise exception 'Pilih cabang dan status sesi.'; end if;
   insert into public.final_sessions(category_id) values(category) on conflict(category_id) do nothing;
   select * into s from public.final_sessions where category_id=category for update;
   if (payload->>'open')::boolean and (
     not exists(select 1 from public.final_participants where category_id=category) or
     not exists(select 1 from public.final_packages k where k.category_id=category and not exists(select 1 from public.final_results x where x.package_id=k.id and not x.cancelled))
   ) then raise exception 'Tetapkan finalis dan sediakan paket tersedia sebelum membuka undian final.'; end if;
   update public.final_sessions set open=(payload->>'open')::boolean where id=s.id;
   message := 'Sesi final '||case when (payload->>'open')::boolean then 'dibuka' else 'ditutup' end||': '||category;
 elsif action='package' then
   category := (payload->>'category_id')::uuid;
   if category is null then raise exception 'Pilih cabang yang tersedia.'; end if;
   -- Use the same session lock order as draws before editing a package snapshot.
   perform 1 from public.final_sessions order by id for update;
   if target is null then
     insert into public.final_packages(category_id,surah,verses) values(category,trim(payload->>'surah'),trim(payload->>'verses')) returning * into m;
   else
     select * into m from public.final_packages where id=target for update;
     if m.id is null then raise exception 'Paket final tidak ditemukan.'; end if;
     if category<>m.category_id and exists(select 1 from public.final_results where package_id=target) then raise exception 'Cabang maqro yang sudah pernah diundi tidak dapat diubah.'; end if;
     update public.final_packages set category_id=category,surah=trim(payload->>'surah'),verses=trim(payload->>'verses') where id=target returning * into m;
   end if;
   output := to_jsonb(m);
   message := 'Paket final disimpan: '||m.id||' / '||m.surah||' / '||m.verses;
 elsif action='draw' then
   select * into s from public.final_sessions where id=(payload->>'session_id')::uuid for update;
   if s.id is null then raise exception 'Sesi final tidak ditemukan.'; end if;
   select * into p from public.people where id=target for share;
   select * into f from public.final_participants where id=target for share;
   if p.id is null or f.id is null or p.district<>represented.district or f.category_id<>s.category_id or not s.category_id=any(p.entries) then raise exception 'Peserta tidak memenuhi ketentuan final.'; end if;
   -- Retrying a committed draw must return its receipt even after the window closes.
   select * into r from public.final_results where person_id=p.id and session_id=s.id and not cancelled;
   if r.id is not null then return to_jsonb(r); end if;
   draw_time := clock_timestamp();
   if not s.open then raise exception 'Sesi final belum dibuka atau sudah ditutup.'; end if;
   if not (case when f.session_starts_at is not null then draw_time>=f.session_starts_at and draw_time<f.session_ends_at else f.session_open end) then raise exception 'Sesi finalis ditutup. Hubungi panitia untuk membuka sesi.'; end if;
   select * into m from public.final_packages k where k.category_id=s.category_id and not exists(
     select 1 from public.final_results x where x.session_id=s.id and x.package_id=k.id and not x.cancelled
   ) order by extensions.gen_random_bytes(16) limit 1;
   if m.id is null then raise exception 'Paket maqro final sudah habis atau belum tersedia.'; end if;
   insert into public.final_results(person_id,session_id,package_id,name,district,category,surah,verses,gender)
   values(p.id,s.id,m.id,p.name,p.district,(select name from public.categories where id=s.category_id),m.surah,m.verses,p.gender) returning * into r;
   output := to_jsonb(r);
   message := 'Undian final tersimpan: '||p.name||' / Hasil: '||r.id||' / '||m.surah||' / '||m.verses;
 elsif action='cancel' then
   if length(trim(coalesce(payload->>'reason',''))) not between 1 and 250 then raise exception 'Isi alasan pembatalan, maksimal 250 karakter.'; end if;
   select * into r from public.final_results where id=target;
   perform 1 from public.final_sessions where id=r.session_id for update;
   update public.final_results set cancelled=true,reason=trim(payload->>'reason') where id=target and not cancelled;
   if not found then raise exception 'Hasil sudah dibatalkan atau tidak ditemukan.'; end if;
   message := 'Hasil final dibatalkan: '||target||' / '||trim(payload->>'reason');
 else raise exception 'Tindakan tidak dikenali.';
 end if;
 if impersonated is not null then message := 'Admin '||me.username||' atas nama Kecamatan '||represented.district||': '||message; end if;
 insert into public.logs(actor,message,impersonated_profile_id) values(me.id,message,impersonated);
 return output;
end;
$$;
revoke all on function public.maqro_final_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.maqro_final_action(text,jsonb) to authenticated;

create function public.notify_final_changes() returns trigger
language plpgsql security definer set search_path='' as $$
declare target_district text;
begin
 perform realtime.send(jsonb_build_object('table',tg_table_name),'changed','workspace:admin',true);
 if tg_table_name <> 'final_packages' then
   for target_district in select district from public.profiles where role='district' and active loop
     perform realtime.send(jsonb_build_object('table',tg_table_name),'changed','workspace:district:'||target_district,true);
   end loop;
 end if;
 return null;
end;
$$;
revoke all on function public.notify_final_changes() from public,anon,authenticated;
do $$ declare name text; begin
 foreach name in array array['final_participants','final_sessions','final_packages','final_results'] loop
   execute format('create trigger final_changed after insert or update or delete on public.%I for each statement execute function public.notify_final_changes()',name);
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
