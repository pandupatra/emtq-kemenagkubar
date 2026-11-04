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
  const migrate = async (suffix) => {
    const file = fs
      .readdirSync("supabase/migrations")
      .find((name) => name.endsWith(suffix));
    assert.ok(file);
    await client.query(
      fs
        .readFileSync(`supabase/migrations/${file}`, "utf8")
        .replace(/^begin;/, "")
        .replace(/commit;\s*$/, ""),
    );
  };
  for (const [column, suffix] of [
    ["participant_number", "_add_participant_number.sql"],
    ["session_open", "_participant_sessions.sql"],
  ]) {
    if (
      !(
        await client.query(
          "select 1 from information_schema.columns where table_schema='public' and table_name='people' and column_name=$1",
          [column],
        )
      ).rowCount
    )
      await migrate(suffix);
  }
  const snapshot = async (table) =>
    (
      await client.query(
        `select to_jsonb(t)-'code' as item from public.${table} t order by id`,
      )
    ).rows;
  const before = {
    packages: await snapshot("packages"),
    results: await snapshot("results"),
  };
  await migrate("_remove_maqro_codes.sql");
  assert.deepEqual(await snapshot("packages"), before.packages);
  assert.deepEqual(await snapshot("results"), before.results);
  assert.equal(
    (
      await client.query(
        "select 1 from information_schema.columns where table_schema='public' and table_name in ('packages','results') and column_name='code'",
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await client.query(
        "select to_regclass('public.maqro_package_code_seq') as sequence",
      )
    ).rows[0].sequence,
    null,
  );
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
      "insert into public.categories(name) values('[TEST] Without maqro codes') returning id",
    )
  ).rows[0].id;
  const session = (
    await client.query(
      "insert into public.sessions(category_id,open) values($1,true) returning id",
      [category],
    )
  ).rows[0].id;
  const people = (
    await client.query(
      "insert into public.people(name,district,birth,gender,entries) select '[TEST] Code-free '||n,$1,'2000-01-01','Putra',$2 from generate_series(1,2) n returning id",
      [district.district, [category]],
    )
  ).rows.map((p) => p.id);
  await client.query("set local role authenticated");
  const act = async (actor, action, payload) => {
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor,
    ]);
    return (
      await client.query("select public.maqro_action($1,$2) as result", [
        action,
        payload,
      ])
    ).rows[0].result;
  };
  const rejects = async (operation, pattern) => {
    await client.query("savepoint rejection");
    await assert.rejects(operation, pattern);
    await client.query("rollback to savepoint rejection");
  };
  await rejects(
    () =>
      act(district.id, "package", {
        category_id: category,
        surah: "[TEST] Materi",
        verses: "1-7",
      }),
    /panitia/,
  );
  const pack = await act(admin, "package", {
    category_id: category,
    surah: "[TEST] Materi",
    verses: "1-7",
  });
  assert.ok(pack.id);
  assert.equal("code" in pack, false);
  const drawn = await act(district.id, "draw", {
    id: people[0],
    session_id: session,
  });
  assert.equal(drawn.package_id, pack.id);
  assert.equal(drawn.surah, pack.surah);
  assert.equal("code" in drawn, false);
  assert.equal(
    (await act(district.id, "draw", { id: people[0], session_id: session })).id,
    drawn.id,
  );
  await rejects(
    () => act(district.id, "draw", { id: people[1], session_id: session }),
    /sudah habis/,
  );
  await act(admin, "cancel", {
    id: drawn.id,
    reason: "[TEST] Release package",
  });
  const replacement = await act(district.id, "draw", {
    id: people[1],
    session_id: session,
  });
  assert.equal(replacement.package_id, pack.id);
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
    admin,
  ]);
  assert.equal(
    (
      await client.query("select public.delete_draw_history($1) as result", [
        [replacement.id],
      ])
    ).rows[0].result.deleted_results,
    1,
  );
  const log = (
    await client.query(
      "select message from public.logs where message like 'Histori undian dihapus permanen:%' and message like $1",
      [`%${replacement.id}%`],
    )
  ).rows[0].message;
  assert.ok(log.includes(pack.surah));
  assert.equal(log.includes('"code"'), false);
  await act(admin, "participant-session", { ids: [people[1]], open: false });
  await rejects(
    () => act(district.id, "draw", { id: people[1], session_id: session }),
    /Sesi peserta ditutup/,
  );
  await client.query("reset role");
  for (let i = 0; i < 2; i++)
    await client.query(
      "insert into public.packages(category_id,surah,verses,seed_key) values($1,'[TEST] Seed','1-5','[TEST] no-code-seed') on conflict(seed_key) do nothing",
      [category],
    );
  assert.equal(
    (
      await client.query(
        "select count(*)::integer as total from public.packages where seed_key='[TEST] no-code-seed'",
      )
    ).rows[0].total,
    1,
  );
  console.log(
    "PASS: migration preserves records and materials; no code columns or generator; package creation, authorization, draw, idempotency, unique assignment, cancellation/reuse, history deletion/audit, participant session gate, seed idempotency",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
