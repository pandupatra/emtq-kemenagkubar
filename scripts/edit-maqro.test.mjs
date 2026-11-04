import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";

const db = new pg.Client({
  host: "127.0.0.1",
  port: 54329,
  user: "maqro_test",
  database: "maqro_single_session_test",
});
await db.connect();
try {
  await db.query("begin");
  const migration = fs
    .readdirSync("supabase/migrations")
    .find((f) => f.endsWith("_edit_maqro.sql"));
  await db.query(
    fs
      .readFileSync(`supabase/migrations/${migration}`, "utf8")
      .replace(/^begin;/, "")
      .replace(/commit;\s*$/, ""),
  );
  const admin = (
    await db.query(
      "select id from public.profiles where role='admin' and active limit 1",
    )
  ).rows[0].id;
  const district = (
    await db.query(
      "select id from public.profiles where role='district' and active limit 1",
    )
  ).rows[0].id;
  const pack = (await db.query("select * from public.packages limit 1"))
    .rows[0];
  assert.ok(pack);
  const beforeResults = (
    await db.query("select * from public.results order by id")
  ).rows;
  const payload = {
    id: pack.id,
    category_id: pack.category_id,
    surah: " [TEST] Edited ",
    verses: " 2-8 ",
  };
  await db.query("set local role authenticated");
  const edit = async (actor, value) => {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor,
    ]);
    return (await db.query("select public.edit_maqro($1) as result", [value]))
      .rows[0].result;
  };
  const reject = async (actor, value, pattern) => {
    await db.query("savepoint rejected");
    await assert.rejects(() => edit(actor, value), pattern);
    await db.query("rollback to savepoint rejected");
  };
  await reject(district, payload, /panitia/);
  await reject("", payload, /panitia/);
  await reject(admin, { ...payload, surah: " " }, /Isi surah/);
  await reject(
    admin,
    { ...payload, id: "00000000-0000-0000-0000-000000000000" },
    /tidak ditemukan/,
  );
  const updated = await edit(admin, payload);
  assert.equal(updated.id, pack.id);
  assert.equal(updated.surah, "[TEST] Edited");
  assert.equal(updated.verses, "2-8");
  await db.query("reset role");
  assert.deepEqual(
    (await db.query("select * from public.results order by id")).rows,
    beforeResults,
  );
  assert.ok(
    (
      await db.query(
        "select 1 from public.logs where actor=$1 and message like $2",
        [admin, `Maqro diperbarui: ${pack.id}%`],
      )
    ).rowCount,
  );
  const used = (
    await db.query(
      "select p.* from public.packages p where exists(select 1 from public.results r where r.package_id=p.id) limit 1",
    )
  ).rows[0];
  if (used) {
    const other = (
      await db.query("select id from public.categories where id<>$1 limit 1", [
        used.category_id,
      ])
    ).rows[0];
    await db.query("set local role authenticated");
    await reject(
      admin,
      { ...payload, id: used.id, category_id: other.id },
      /sudah pernah diundi/,
    );
  }
  console.log(
    "PASS: admin edit, validation, access restrictions, audit log, unchanged draw snapshots",
  );
} finally {
  await db.query("rollback");
  await db.end();
}
