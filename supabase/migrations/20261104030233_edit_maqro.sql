begin;

create or replace function public.edit_maqro(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  old_package public.packages;
  updated_package public.packages;
  target uuid := (payload->>'id')::uuid;
  category uuid := (payload->>'category_id')::uuid;
begin
  select * into me from public.profiles where id = auth.uid() for share;
  if me.id is null or not me.active or me.role <> 'admin' then
    raise exception 'Edit maqro hanya tersedia untuk panitia aktif.';
  end if;
  if length(trim(coalesce(payload->>'surah', ''))) = 0
    or length(trim(coalesce(payload->>'verses', ''))) = 0 then
    raise exception 'Isi surah / materi dan ayat / rentang materi.';
  end if;
  if category is null or not exists(select 1 from public.categories where id = category) then
    raise exception 'Pilih cabang yang tersedia.';
  end if;

  -- Draws lock their session before reading a package and writing its snapshot.
  perform 1 from public.sessions order by id for update;
  select * into old_package from public.packages where id = target for update;
  if not found then raise exception 'Maqro tidak ditemukan. Muat ulang daftar.'; end if;
  if category <> old_package.category_id and exists(
    select 1 from public.results where package_id = target
  ) then
    raise exception 'Cabang maqro yang sudah pernah diundi tidak dapat diubah.';
  end if;
  update public.packages set category_id = category,
    surah = trim(payload->>'surah'), verses = trim(payload->>'verses')
  where id = target returning * into updated_package;
  insert into public.logs(actor, message) values(me.id,
    'Maqro diperbarui: ' || target || ' / ' || to_jsonb(old_package)::text
      || ' -> ' || to_jsonb(updated_package)::text);
  return to_jsonb(updated_package);
end;
$$;

revoke all on function public.edit_maqro(jsonb) from public, anon, authenticated;
grant execute on function public.edit_maqro(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
