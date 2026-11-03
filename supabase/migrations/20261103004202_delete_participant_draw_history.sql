begin;

create or replace function public.delete_participant(participant_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  participant public.people;
  deleted_results integer;
begin
  select * into me from public.profiles where id = auth.uid() for share;
  if me.id is null or not me.active or me.role <> 'admin' then
    raise exception 'Hapus peserta hanya tersedia untuk panitia aktif.';
  end if;

  -- Conflicts with the participant share lock held by a concurrent draw.
  select * into participant from public.people where id = participant_id for update;
  if participant.id is null then
    raise exception 'Peserta tidak ditemukan atau sudah dihapus.';
  end if;
  delete from public.results where person_id = participant.id;
  get diagnostics deleted_results = row_count;

  delete from public.people where id = participant.id;
  insert into public.logs(actor, message)
  values (me.id, 'Peserta dihapus: ' || participant.name || ' / ' || participant.district || ' / ID: ' || participant.id || ' / Riwayat undian dihapus: ' || deleted_results);
  return jsonb_build_object('id', participant.id, 'deleted_results', deleted_results);
end;
$$;

revoke all on function public.delete_participant(uuid) from public, anon, authenticated;
grant execute on function public.delete_participant(uuid) to authenticated;

commit;
