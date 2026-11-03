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
  const sql = fs.readFileSync(
    "supabase/migrations/202611020001_admin_delete_participant.sql",
    "utf8",
  );
  await client.query(sql.replace(/^begin;/, "").replace(/commit;\s*$/, ""));
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
    await client.query("select id from public.categories limit 1")
  ).rows[0].id;
  const person = (
    await client.query(
      "insert into public.people(name,district,birth,gender,entries) values('[TEST] Delete participant',$1,'2000-01-01','Putra',$2) returning id",
      [district.district, [category]],
    )
  ).rows[0].id;
  const call = async (id, actor = admin) => {
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor,
    ]);
    return client.query("select public.delete_participant($1) as result", [id]);
  };
  const rejects = async (operation, pattern) => {
    await client.query("savepoint rejection");
    await assert.rejects(operation, pattern);
    await client.query("rollback to savepoint rejection");
  };
  await client.query("set local role authenticated");
  await rejects(() => call(person, district.id), /panitia aktif/);
  await rejects(() => call(person, ""), /panitia aktif/);
  await client.query("reset role");
  await client.query("update public.profiles set active=false where id=$1", [
    admin,
  ]);
  await client.query("set local role authenticated");
  await rejects(() => call(person), /panitia aktif/);
  await client.query("reset role");
  await client.query("update public.profiles set active=true where id=$1", [
    admin,
  ]);
  const history = (
    await client.query("select person_id from public.results limit 1")
  ).rows[0];
  assert.ok(history, "Fixture must include an undian result");
  await client.query("set local role authenticated");
  await rejects(() => call(history.person_id), /riwayat undian/);
  await client.query("reset role");
  await client.query(
    "update public.results set cancelled=true where person_id=$1",
    [history.person_id],
  );
  await client.query("set local role authenticated");
  await rejects(() => call(history.person_id), /riwayat undian/);
  assert.equal((await call(person)).rows[0].result.id, person);
  assert.equal(
    (
      await client.query(
        "select count(*)::int n from public.people where id=$1",
        [person],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await client.query(
        "select count(*)::int n from public.logs where actor=$1 and message like $2",
        [admin, `%${person}%`],
      )
    ).rows[0].n,
    1,
  );
  await rejects(() => call(person), /sudah dihapus/);
  await client.query("set local role anon");
  await rejects(() => call(person), /permission denied/);
  console.log(
    "PASS: admin delete, audit log, district/anonymous/inactive denial, active/cancelled history protection, repeated delete; all changes rolled back",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
