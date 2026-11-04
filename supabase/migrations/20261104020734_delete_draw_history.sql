begin;

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
    'name', name, 'category', category, 'code', code, 'cancelled', cancelled) order by id)
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

commit;
