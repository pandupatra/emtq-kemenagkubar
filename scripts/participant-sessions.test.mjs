import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";

const client = new pg.Client({
  host: "127.0.0.1",
  port: 54329,
  user: "maqro_test",
  database: "maqro_single_session_test",
});
await client.connect();
try {
  await client.query("begin");
  const column = await client.query(
    "select 1 from information_schema.columns where table_schema='public' and table_name='people' and column_name='participant_number'",
  );
  for (const file of [
    ...(!column.rowCount ? ["20261104012947_add_participant_number.sql"] : []),
    "20261104014620_participant_sessions.sql",
  ]) {
    await client.query(
      fs
        .readFileSync(`supabase/migrations/${file}`, "utf8")
        .replace(/^begin;/, "")
        .replace(/commit;\s*$/, ""),
    );
  }
  const admin = (
    await client.query(
      "select id from public.profiles where role='admin' and active limit 1",
    )
  ).rows[0].id;
  const district = (
    await client.query(
      "select id,district from public.profiles where role='district' and active limit 1",
    )
  ).rows[0];
  const category = (
    await client.query(
      "insert into public.categories(name) values('[TEST] Participant session') returning id",
    )
  ).rows[0].id;
  const session = (
    await client.query(
      "insert into public.sessions(category_id,open) values($1,true) returning id",
      [category],
    )
  ).rows[0].id;
  await client.query(
    "insert into public.packages(category_id,surah,verses) values($1,'Al-Fatihah','1-7')",
    [category],
  );
  const people = (
    await client.query(
      "insert into public.people(name,district,birth,gender,entries) select '[TEST] Session '||n,$1,'2000-01-01','Putra',$2 from generate_series(1,2) n returning id,session_open",
      [district.district, [category]],
    )
  ).rows;
  assert.ok(people.every((p) => p.session_open));
  const ids = people.map((p) => p.id);
  const act = async (actor, action, payload) => {
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor,
    ]);
    return client.query("select public.maqro_action($1,$2) as result", [
      action,
      payload,
    ]);
  };
  const rejects = async (operation, pattern) => {
    await client.query("savepoint rejection");
    await assert.rejects(operation, pattern);
    await client.query("rollback to savepoint rejection");
  };
  await client.query("set local role authenticated");
  await rejects(
    () => act(district.id, "participant-session", { ids, open: false }),
    /panitia/,
  );
  await rejects(
    () => act("", "participant-session", { ids, open: false }),
    /Akses akun/,
  );
  await rejects(
    () => act(admin, "participant-session", { ids: [], open: false }),
    /minimal satu/,
  );
  await rejects(
    () => act(admin, "participant-session", { ids, open: "false" }),
    /valid/,
  );
  await rejects(
    () =>
      act(admin, "participant-session", {
        ids: [...ids, "00000000-0000-0000-0000-000000000000"],
        open: false,
      }),
    /tidak ditemukan/,
  );
  await act(admin, "participant-session", { ids, open: false });
  await rejects(
    () => act(district.id, "draw", { id: ids[0], session_id: session }),
    /Sesi peserta ditutup/,
  );
  await act(admin, "participant-session", { ids: [ids[0]], open: true });
  const rows = (
    await client.query(
      "select id,session_open from public.people where id=any($1)",
      [ids],
    )
  ).rows;
  assert.equal(rows.find((p) => p.id === ids[0]).session_open, true);
  assert.equal(rows.find((p) => p.id === ids[1]).session_open, false);
  await act(admin, "session", { id: session, open: false, repeat: false });
  await rejects(
    () => act(district.id, "draw", { id: ids[0], session_id: session }),
    /Sesi undian belum/,
  );
  await act(admin, "session", { id: session, open: true, repeat: false });
  assert.ok(
    (await act(district.id, "draw", { id: ids[0], session_id: session }))
      .rows[0].result.id,
  );
  console.log(
    "PASS: defaults, admin authorization, batch validation, per-person isolation, participant and category draw gates",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
