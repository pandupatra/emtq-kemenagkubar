begin;
set local lock_timeout = '5s';

create function public.delete_final_draw_history(result_ids uuid[])
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
    raise exception 'Hapus histori Final hanya tersedia untuk panitia aktif.';
  end if;
  select array_agg(distinct id) into ids from unnest(result_ids) id where id is not null;
  if coalesce(cardinality(ids), 0) = 0 then
    raise exception 'Pilih hasil undian Final yang akan dihapus.';
  end if;
  -- Match the session-before-result lock order used by final draws/cancellations.
  perform 1 from public.final_sessions
  where id in (select session_id from public.final_results where id = any(ids))
  order by id for update;
  perform 1 from public.final_results where id = any(ids) order by id for update;
  if (select count(*) from public.final_results where id = any(ids)) <> cardinality(ids) then
    raise exception 'Sebagian histori Final sudah dihapus atau tidak ditemukan. Muat ulang daftar finalis.';
  end if;
  select jsonb_agg(to_jsonb(r) order by r.id) into deleted_history
  from public.final_results r where r.id = any(ids);
  delete from public.final_results where id = any(ids);
  get diagnostics deleted_count = row_count;
  insert into public.logs(actor, message) values (me.id,
    'Histori Final dihapus permanen: ' || deleted_count || ' hasil / ' || deleted_history::text);
  return jsonb_build_object('deleted_results', deleted_count, 'ids', to_jsonb(ids));
end;
$$;
revoke all on function public.delete_final_draw_history(uuid[]) from public, anon, authenticated;
grant execute on function public.delete_final_draw_history(uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;
