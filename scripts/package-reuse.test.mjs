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
    "supabase/migrations/20261103004202_delete_participant_draw_history.sql",
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
    await client.query(
      "insert into public.categories(name) values('[TEST] Package reuse') returning id",
    )
  ).rows[0].id;
  const session = (
    await client.query(
      "insert into public.sessions(category_id,open) values($1,true) returning id",
      [category],
    )
  ).rows[0].id;
  const pack = (
    await client.query(
      "insert into public.packages(category_id,surah,verses) values($1,'[TEST] Reusable maqro','1-5') returning id",
      [category],
    )
  ).rows[0].id;
  const people = [];
  for (let i = 0; i < 4; i++) {
    people.push(
      (
        await client.query(
          "insert into public.people(name,district,birth,gender,entries) values($1,$2,'2000-01-01','Putra',$3) returning id",
          [`[TEST] Reuse ${i}`, district.district, [category]],
        )
      ).rows[0].id,
    );
  }
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
  const draw = (person) =>
    act(district.id, "draw", { id: person, session_id: session });
  const remove = async (person) => {
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
      admin,
    ]);
    await client.query("select public.delete_participant($1)", [person]);
  };
  const unavailable = async (person) => {
    await client.query("savepoint unavailable");
    await assert.rejects(() => draw(person), /sudah habis/);
    await client.query("rollback to savepoint unavailable");
  };
  const first = await draw(people[0]);
  assert.equal(first.package_id, pack);
  await unavailable(people[1]);
  await act(admin, "cancel", { id: first.id, reason: "[TEST] Release maqro" });
  const second = await draw(people[1]);
  assert.equal(second.package_id, pack, "Cancelled package must be reusable");
  await remove(people[0]);
  await unavailable(people[2]);
  await remove(people[1]);
  const third = await draw(people[2]);
  assert.equal(
    third.package_id,
    pack,
    "Deleting active history must release the package",
  );
  await act(admin, "cancel", {
    id: third.id,
    reason: "[TEST] Cancel then delete history",
  });
  await remove(people[2]);
  assert.equal((await draw(people[3])).package_id, pack);
  await client.query("reset role");
  assert.equal(
    (
      await client.query(
        "select count(*)::int n from public.packages where id=$1",
        [pack],
      )
    ).rows[0].n,
    1,
  );
  console.log(
    "PASS: active package unavailable; cancellation releases package; deleting cancelled history preserves another participant's active draw; deleting active/cancelled history releases package; package retained; all changes rolled back",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
