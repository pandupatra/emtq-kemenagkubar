begin;

create unique index profiles_district_normalized_key on public.profiles(lower(trim(district)));
create unique index profiles_username_normalized_key on public.profiles(lower(username));

alter table public.people drop constraint people_district_fkey;
alter table public.people add constraint people_district_fkey
  foreign key (district) references public.profiles(district) on update cascade;

create function public.sync_district_results() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.district is distinct from new.district then
    update public.results set district = new.district where district = old.district;
  end if;
  return new;
end;
$$;
create trigger profiles_sync_district_results after update of district on public.profiles
for each row when (old.role = 'district') execute function public.sync_district_results();
revoke all on function public.sync_district_results() from public;

create function public.save_district_account(
  account_id uuid, account_username text, account_district text,
  actor_id uuid, creating boolean, previous_username text default null
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare saved public.profiles;
begin
  if not exists (select 1 from public.profiles where id = actor_id and role = 'admin' and active) then
    raise exception 'Tindakan hanya untuk panitia.';
  end if;
  if account_username !~ '^[a-z0-9-]{1,64}$' or length(trim(account_district)) not between 1 and 100 then
    raise exception 'Data akun tidak valid.';
  end if;
  if creating then
    insert into public.profiles(id, username, district, role)
    values(account_id, account_username, trim(account_district), 'district') returning * into saved;
  else
    select * into saved from public.profiles where id = account_id and role = 'district' for update;
    if not found then raise exception 'Akun kecamatan tidak ditemukan.'; end if;
    if saved.username is distinct from previous_username then
      raise exception 'Akun telah berubah. Muat ulang data akun.';
    end if;
    update public.profiles set username = account_username, district = trim(account_district)
    where id = account_id returning * into saved;
  end if;
  insert into public.logs(actor, message) values(actor_id,
    case when creating then 'Akun kecamatan ditambahkan: ' else 'Akun kecamatan diperbarui: ' end || saved.username);
  return saved;
end;
$$;
revoke all on function public.save_district_account(uuid,text,text,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.save_district_account(uuid,text,text,uuid,boolean,text) to service_role;
commit;
