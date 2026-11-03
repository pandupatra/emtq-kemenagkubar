begin;

create or replace function public.delete_participant(participant_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  participant public.people;
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
  if exists (select 1 from public.results where person_id = participant.id) then
    raise exception 'Peserta yang memiliki riwayat undian, termasuk hasil yang dibatalkan, tidak dapat dihapus.';
  end if;

  delete from public.people where id = participant.id;
  insert into public.logs(actor, message)
  values (me.id, 'Peserta dihapus: ' || participant.name || ' / ' || participant.district || ' / ID: ' || participant.id);
  return jsonb_build_object('id', participant.id);
end;
$$;

revoke all on function public.delete_participant(uuid) from public, anon, authenticated;
grant execute on function public.delete_participant(uuid) to authenticated;

commit;
