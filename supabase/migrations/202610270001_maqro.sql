create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table public.profiles (
 id uuid primary key references auth.users(id), username text not null unique,
 district text unique, role text not null check(role in ('admin','district')), active boolean not null default true,
 check ((role='admin' and district is null) or (role='district' and district is not null))
);
create table public.categories(id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.people (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),
 district text not null references public.profiles(district), birth date not null check(birth<=current_date),
 gender text not null check(gender in ('Putra','Putri')), entries uuid[] not null check(cardinality(entries)>0),
 status text not null default 'Draf' check(status in ('Draf','Diajukan','Perlu perbaikan','Terverifikasi')), note text not null default ''
);
create table public.sessions (
 id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories,
 round text not null check(round in ('Penyisihan','Final')), open boolean not null default false, repeat boolean not null default true,
 unique(category_id,round)
);
create table public.packages (
 id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories,
 code text not null check(length(trim(code)) between 1 and 40), surah text not null check(length(trim(surah)) between 1 and 100),
 verses text not null check(length(trim(verses)) between 1 and 100), unique(category_id,code)
);
create table public.results (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.people,
 session_id uuid not null references public.sessions, package_id uuid not null references public.packages,
 name text not null, district text not null, category text not null, round text not null, code text not null,
 surah text not null, verses text not null, gender text not null, created_at timestamptz not null default now(),
 cancelled boolean not null default false, reason text not null default ''
);
create unique index one_active_result on public.results(person_id,session_id) where not cancelled;
create index results_session on public.results(session_id);
create index people_district on public.people(district);
create table public.logs(id uuid primary key default gen_random_uuid(), actor uuid not null references public.profiles, message text not null, created_at timestamptz not null default now());
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role='admin');
$$;
create function public.my_district() returns text language sql stable security definer set search_path='' as $$
 select district from public.profiles where id=auth.uid() and active;
$$;
create function public.is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active);
$$;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.people enable row level security;
alter table public.sessions enable row level security;
alter table public.packages enable row level security;
alter table public.results enable row level security;
alter table public.logs enable row level security;
create policy read_profiles on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy read_categories on public.categories for select to authenticated using(public.is_active());
create policy read_people on public.people for select to authenticated using(public.is_admin() or district=public.my_district());
create policy read_sessions on public.sessions for select to authenticated using(public.is_active());
create policy read_packages on public.packages for select to authenticated using(public.is_admin());
create policy read_results on public.results for select to authenticated using(public.is_admin() or district=public.my_district());
create policy read_logs on public.logs for select to authenticated using(public.is_admin());
revoke all on public.profiles,public.categories,public.people,public.sessions,public.packages,public.results,public.logs from anon,authenticated;
grant select on public.profiles,public.categories,public.people,public.sessions,public.packages,public.results,public.logs to authenticated;

create function public.maqro_action(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 me public.profiles; p public.people; s public.sessions; m public.packages; r public.results;
 target uuid; ids uuid[]; message text; output jsonb:='{}';
begin
 select * into me from public.profiles where id=auth.uid() for share;
 if me.id is null or not me.active then raise exception 'Akses akun tidak tersedia.'; end if;
 if action in ('session','package','cancel','account','verify','revise') and me.role<>'admin' then raise exception 'Tindakan hanya untuk panitia.'; end if;
 if action in ('person','submit','draw') and me.role<>'district' then raise exception 'Tindakan hanya untuk kecamatan.'; end if;
 target:=nullif(payload->>'id','')::uuid;
 if action='person' then
   select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'entries');
   if ids is null or cardinality(ids)=0 or exists(select 1 from unnest(ids) x where not exists(select 1 from public.categories c where c.id=x)) then raise exception 'Pilih cabang yang tersedia.'; end if;
   if target is null then
     insert into public.people(name,district,birth,gender,entries) values(trim(payload->>'name'),me.district,(payload->>'birth')::date,payload->>'gender',ids) returning * into p;
   else
     select * into p from public.people where id=target for update;
     if p.id is null or p.district<>me.district or p.status not in ('Draf','Perlu perbaikan') then raise exception 'Data peserta sudah dikunci atau tidak tersedia.'; end if;
     update public.people set name=trim(payload->>'name'),birth=(payload->>'birth')::date,gender=payload->>'gender',entries=ids where id=target returning * into p;
   end if;
   message:='Data peserta disimpan: '||p.name;
 elsif action in ('submit','verify','revise') then
   select * into p from public.people where id=target for update;
   if p.id is null then raise exception 'Peserta tidak ditemukan.'; end if;
   if action='submit' then
     if p.district<>me.district or p.status not in ('Draf','Perlu perbaikan') then raise exception 'Peserta tidak dapat diajukan.'; end if;
     update public.people set status='Diajukan',note='' where id=target;
     message:='Pengajuan verifikasi: '||p.name;
   else
     if p.status<>'Diajukan' then raise exception 'Peserta tidak sedang menunggu pemeriksaan.'; end if;
     if action='revise' and length(trim(coalesce(payload->>'note',''))) not between 1 and 250 then raise exception 'Isi catatan perbaikan, maksimal 250 karakter.'; end if;
     update public.people set status=case when action='verify' then 'Terverifikasi' else 'Perlu perbaikan' end,
       note=case when action='verify' then '' else trim(payload->>'note') end where id=target;
     message:=case when action='verify' then 'Peserta diverifikasi: ' else 'Pendaftaran dikembalikan: ' end||p.name;
   end if;
 elsif action='session' then
   select * into s from public.sessions where id=target for update;
   if s.id is null then raise exception 'Sesi tidak ditemukan.'; end if;
   if (payload->>'open')::boolean and not exists(select 1 from public.packages where category_id=s.category_id) then raise exception 'Tambahkan paket maqro sebelum membuka sesi.'; end if;
   update public.sessions set open=(payload->>'open')::boolean, repeat=(payload->>'repeat')::boolean where id=target;
   message:='Pengaturan sesi diperbarui: '||(select name from public.categories where id=s.category_id)||' / '||s.round;
 elsif action='package' then
   insert into public.packages(category_id,code,surah,verses) values((payload->>'category_id')::uuid,trim(payload->>'code'),trim(payload->>'surah'),trim(payload->>'verses')) returning id into target;
   message:='Paket maqro ditambahkan: '||trim(payload->>'code');
 elsif action='account' then
   if target=me.id then raise exception 'Akun panitia sendiri tidak dapat dinonaktifkan.'; end if;
   update public.profiles set active=(payload->>'active')::boolean where id=target and role='district';
   if not found then raise exception 'Akun kecamatan tidak ditemukan.'; end if;
   message:='Status akun diperbarui: '||(select username from public.profiles where id=target);
 elsif action='draw' then
   select * into s from public.sessions where id=(payload->>'session_id')::uuid for update;
   if s.id is null or not s.open then raise exception 'Sesi undian belum dibuka atau sudah ditutup.'; end if;
   select * into p from public.people where id=target for share;
   if p.id is null or p.district<>me.district or p.status<>'Terverifikasi' or not s.category_id=any(p.entries) then raise exception 'Peserta tidak memenuhi ketentuan sesi.'; end if;
   select * into r from public.results where person_id=p.id and session_id=s.id and not cancelled;
   if r.id is not null then return to_jsonb(r); end if;
   select * into m from public.packages k where k.category_id=s.category_id and
     (s.repeat or not exists(select 1 from public.results x where x.session_id=s.id and x.package_id=k.id and not x.cancelled))
     order by extensions.gen_random_bytes(16) limit 1;
   if m.id is null then raise exception 'Paket maqro untuk sesi ini sudah habis atau belum tersedia.'; end if;
   insert into public.results(person_id,session_id,package_id,name,district,category,round,code,surah,verses,gender)
   values(p.id,s.id,m.id,p.name,p.district,(select name from public.categories where id=s.category_id),s.round,m.code,m.surah,m.verses,p.gender) returning * into r;
   output:=to_jsonb(r); message:='Undian tersimpan: '||p.name||' / '||m.code;
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
revoke execute on function public.is_admin(),public.my_district(),public.is_active() from public,anon;
grant execute on function public.is_admin(),public.my_district(),public.is_active() to authenticated;
insert into public.categories(name) values
 ('Tartil Al-Qur''an'),('Tilawah Anak'),('Tilawah Remaja'),('Tilawah Dewasa'),
 ('Qira''at Murattal Remaja'),('Qira''at Murattal Dewasa'),('Qira''at Mujawwad Remaja'),('Qira''at Mujawwad Dewasa'),
 ('1 Juz dan Tilawah'),('5 Juz dan Tilawah'),('Syarhil Qur''an');
insert into public.sessions(category_id,round) select id,round from public.categories cross join (values ('Penyisihan'),('Final')) r(round);
