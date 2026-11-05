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
  await db.query(
    fs
      .readFileSync(
        "supabase/migrations/202611050001_district_impersonation.sql",
        "utf8",
      )
      .replace(/^begin;/, "")
      .replace(/commit;\s*$/, ""),
  );
  const profiles = (
    await db.query("select * from public.profiles where active")
  ).rows;
  const admin = profiles.find((p) => p.role === "admin");
  const district = profiles.find((p) => p.role === "district");
  const category = (
    await db.query(
      "insert into public.categories(name) values('[TEST] Impersonation') returning id",
    )
  ).rows[0].id;
  const session = (
    await db.query(
      "insert into public.sessions(category_id,open) values($1,true) returning id",
      [category],
    )
  ).rows[0].id;
  await db.query(
    "insert into public.packages(category_id,surah,verses) values($1,'Test','1-2')",
    [category],
  );
  const person = (
    await db.query(
      "insert into public.people(name,district,birth,gender,entries,session_open) values('Test',$1,'2000-01-01','Putra',$2,true) returning id",
      [district.district, [category]],
    )
  ).rows[0].id;
  async function draw(actor, target) {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor,
    ]);
    return (
      await db.query("select public.maqro_action('draw',$1::jsonb) as result", [
        JSON.stringify({
          id: person,
          session_id: session,
          ...(target === undefined ? {} : { impersonated_profile_id: target }),
        }),
      ])
    ).rows[0].result;
  }
  async function rejected(actor, target, pattern) {
    await db.query("savepoint rejection");
    try {
      await assert.rejects(() => draw(actor, target), pattern);
    } finally {
      await db.query("rollback to savepoint rejection");
    }
  }
  await rejected(district.id, district.id, /Impersonasi/);
  await rejected(admin.id, admin.id, /tujuan/);
  await rejected(admin.id, undefined, /hanya untuk kecamatan/);
  const result = await draw(admin.id, district.id);
  assert.ok(result.id);
  const log = (
    await db.query(
      "select * from public.logs where impersonated_profile_id=$1",
      [district.id],
    )
  ).rows.find((l) => l.message.includes(result.id));
  assert.equal(log.actor, admin.id);
  assert.equal((await draw(district.id)).id, result.id);
  await db.query("update public.profiles set active=false where id=$1", [
    district.id,
  ]);
  await rejected(admin.id, district.id, /tujuan/);
  console.log(
    "PASS: impersonation authorization, real draw, actor audit, duplicate protection, inactive target",
  );
} finally {
  await db.query("rollback");
  await db.end();
}
