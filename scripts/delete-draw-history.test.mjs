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
  const file = fs
    .readdirSync("supabase/migrations")
    .find((name) => name.endsWith("_delete_draw_history.sql"));
  assert.ok(file, "Draw history migration must exist");
  await client.query(
    fs
      .readFileSync(`supabase/migrations/${file}`, "utf8")
      .replace(/^begin;/, "")
      .replace(/commit;\s*$/, ""),
  );
  const admin = (
    await client.query(
      "select id from public.profiles where role='admin' and active limit 1",
    )
  ).rows[0].id;
  const district = (
    await client.query(
      "select id from public.profiles where role='district' and active limit 1",
    )
  ).rows[0].id;
  const history = (
    await client.query(
      "select * from public.results order by cancelled, id limit 2",
    )
  ).rows;
  assert.equal(history.length, 2, "Fixture must include two results");
  const call = async (ids, actor = admin) => {
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor,
    ]);
    return client.query("select public.delete_draw_history($1) as result", [
      ids,
    ]);
  };
  const rejects = async (operation, pattern) => {
    await client.query("savepoint rejection");
    await assert.rejects(operation, pattern);
    await client.query("rollback to savepoint rejection");
  };
  await client.query("set local role authenticated");
  await rejects(() => call([history[0].id], district), /panitia aktif/);
  await rejects(() => call([history[0].id], ""), /panitia aktif/);
  await client.query("reset role");
  await client.query("update public.profiles set active=false where id=$1", [
    admin,
  ]);
  await client.query("set local role authenticated");
  await rejects(() => call([history[0].id]), /panitia aktif/);
  await client.query("reset role");
  await client.query("update public.profiles set active=true where id=$1", [
    admin,
  ]);
  await client.query("set local role authenticated");
  await rejects(() => call([]), /Pilih hasil/);
  await rejects(
    () => call([history[0].id, "00000000-0000-0000-0000-000000000000"]),
    /sudah dihapus/,
  );
  await client.query("reset role");
  assert.equal(
    (
      await client.query(
        "select count(*)::int n from public.results where id=$1",
        [history[0].id],
      )
    ).rows[0].n,
    1,
  );
  await client.query("reset role");
  const people = (await client.query("select * from public.people order by id"))
    .rows;
  const packages = (
    await client.query("select * from public.packages order by id")
  ).rows;
  for (const cancelled of [false, true]) {
    await client.query("savepoint deletion");
    await client.query("update public.results set cancelled=$1 where id=$2", [
      cancelled,
      history[0].id,
    ]);
    await client.query("set local role authenticated");
    assert.equal(
      (await call([history[0].id, history[0].id])).rows[0].result
        .deleted_results,
      1,
    );
    await rejects(() => call([history[0].id]), /sudah dihapus/);
    await client.query("reset role");
    assert.equal(
      (
        await client.query(
          "select count(*)::int n from public.results where id=$1",
          [history[0].id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await client.query(
          "select count(*)::int n from public.results where id=$1",
          [history[1].id],
        )
      ).rows[0].n,
      1,
    );
    assert.deepEqual(
      (await client.query("select * from public.people order by id")).rows,
      people,
    );
    assert.deepEqual(
      (await client.query("select * from public.packages order by id")).rows,
      packages,
    );
    assert.equal(
      (
        await client.query(
          "select count(*)::int n from public.logs where actor=$1 and message like $2",
          [admin, `%Histori undian dihapus permanen:%${history[0].id}%`],
        )
      ).rows[0].n,
      1,
    );
    await client.query("rollback to savepoint deletion");
  }
  const ids = (await client.query("select id from public.results")).rows.map(
    (row) => row.id,
  );
  await client.query("set local role authenticated");
  assert.equal((await call(ids)).rows[0].result.deleted_results, ids.length);
  await client.query("reset role");
  assert.equal(
    (await client.query("select count(*)::int n from public.results")).rows[0]
      .n,
    0,
  );
  await client.query("set local role anon");
  await rejects(() => call([history[0].id]), /permission denied/);
  console.log(
    "PASS: admin-only single/bulk deletion, active/cancelled results, audit, unchanged participants/packages, deduplication, atomic stale rejection, inactive/district/anonymous denial; rolled back",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
