import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";

// This suite creates and removes only its own database on the local fixture server.
const connection = { host: "127.0.0.1", port: 54329, user: "maqro_test" };
const database = `maqro_qa_${randomUUID().replaceAll("-", "")}`;
const root = new pg.Client({ ...connection, database: "postgres" });
await root.connect();
await root.query(`create database "${database}" template template0`);
const db = new pg.Client({ ...connection, database });
const workers = new Set();
let cases = 0;
const pass = (name) => {
  cases++;
  console.log(`PASS: ${name}`);
};
const fresh = async () => {
  const client = new pg.Client({ ...connection, database });
  await client.connect();
  workers.add(client);
  return client;
};
try {
  await db.connect();
  // Emulate the Realtime SQL interface locally; WebSocket delivery needs hosted QA.
  await db.query(`create schema realtime;
    create table realtime.messages(id bigint generated always as identity, topic text, extension text, payload jsonb);
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated;
    grant select on realtime.messages to authenticated;
    create function realtime.topic() returns text language sql stable as $$
      select current_setting('realtime.topic', true);
    $$;
    create function realtime.send(payload jsonb, event text, topic text, private boolean)
      returns void language sql as $$
      insert into realtime.messages(topic,extension,payload) values(topic,'broadcast',payload);
    $$;`);
  await db.query(`create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  for (const file of fs
    .readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.query(fs.readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
  pass("all migrations apply to a clean database");
  const admin = randomUUID(),
    district = randomUUID(),
    other = randomUUID();
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    admin,
    district,
    other,
  ]);
  await db.query(
    `insert into public.profiles(id,username,district,role,active) values
    ($1,'admin',null,'admin',true),($2,'melak','MELAK','district',true),
    ($3,'damai','DAMAI','district',true)`,
    [admin, district, other],
  );
  const category = (
    await db.query(
      "insert into public.categories(name) values('QA Branch') returning id",
    )
  ).rows[0].id;
  const session = (
    await db.query(
      "insert into public.sessions(category_id,open) values($1,false) returning id",
      [category],
    )
  ).rows[0].id;
  await db.query("truncate realtime.messages");
  await db.query(
    "update public.profiles set active=active where role='district'",
  );
  const notices = (
    await db.query("select topic,payload from realtime.messages order by topic")
  ).rows;
  assert.deepEqual(
    notices.map((r) => r.topic),
    ["workspace:admin", "workspace:district:DAMAI", "workspace:district:MELAK"],
  );
  assert.ok(
    notices.every((r) => JSON.stringify(r.payload) === '{"table":"profiles"}'),
  );
  await db.query("begin");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
    district,
  ]);
  await db.query("set local role authenticated");
  for (const [topic, expected] of [
    ["workspace:admin", 0],
    ["workspace:district:DAMAI", 0],
    ["workspace:district:MELAK", 1],
  ]) {
    await db.query("select set_config('realtime.topic',$1,true)", [topic]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from realtime.messages where topic=$1",
          [topic],
        )
      ).rows[0].n,
      expected,
    );
  }
  await db.query("rollback");
  pass(
    "Realtime bulk notifications are private, scoped and contain no participant data",
  );
  const rpc = async (client, actor, action, payload) => {
    await client.query("begin");
    try {
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
        actor,
      ]);
      await client.query("set local role authenticated");
      const result = (
        await client.query("select public.maqro_action($1,$2) result", [
          action,
          payload,
        ])
      ).rows[0].result;
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  };
  const act = (actor, action, payload) => rpc(db, actor, action, payload);
  const person = async (name) => {
    await act(admin, "person", {
      name,
      district: "MELAK",
      birth: "2000-01-01",
      gender: "Putra",
      entries: [category],
      participant_number: "1",
    });
    return (
      await db.query("select id from public.people where name=$1", [name])
    ).rows[0].id;
  };
  const draw = (id, actor = district, extra = {}) =>
    act(actor, "draw", { id, session_id: session, ...extra });
  const p1 = await person("QA One"),
    p2 = await person("QA Two"),
    p3 = await person("QA Three");
  await assert.rejects(
    () => act(admin, "session", { id: session, open: true, repeat: false }),
    /Tambahkan paket/,
  );
  await assert.rejects(() => act(district, "person", {}), /panitia/);
  for (let i = 0; i < 3; i++)
    await act(admin, "package", {
      category_id: category,
      surah: `QA Material ${i}`,
      verses: "1-7",
    });
  await act(admin, "session", { id: session, open: true, repeat: false });
  await assert.rejects(() => draw(p1, other), /ketentuan/);
  await assert.rejects(() => draw(p1, admin), /hanya untuk kecamatan/);
  await assert.rejects(() => draw(p1, ""), /Akses akun/);
  await assert.rejects(
    () => draw(p1, district, { impersonated_profile_id: district }),
    /Impersonasi/,
  );
  pass(
    "participant/package CRUD prerequisites, active account and district authorization",
  );
  await act(admin, "participant-session", { ids: [p1], open: false });
  await assert.rejects(() => draw(p1), /Sesi peserta ditutup/);
  await assert.rejects(
    () => act(district, "participant-session", { ids: [p1], open: true }),
    /panitia/,
  );
  await assert.rejects(
    () =>
      act(admin, "participant-session", {
        ids: [p1, randomUUID()],
        open: true,
      }),
    /tidak ditemukan/,
  );
  assert.equal(
    (await db.query("select session_open from public.people where id=$1", [p1]))
      .rows[0].session_open,
    false,
  );
  const now = Date.now();
  const schedule = (start, end, ids = [p1]) =>
    act(admin, "participant-session", {
      ids,
      open: true,
      session_starts_at: start,
      session_ends_at: end,
    });
  await assert.rejects(
    () => schedule(new Date(now).toISOString(), null),
    /lengkap/,
  );
  await assert.rejects(
    () =>
      schedule(
        new Date(now + 60000).toISOString(),
        new Date(now).toISOString(),
      ),
    /sesudah/,
  );
  await schedule(
    new Date(now + 60000).toISOString(),
    new Date(now + 120000).toISOString(),
  );
  await assert.rejects(() => draw(p1), /Sesi peserta ditutup/);
  await schedule(
    new Date(now - 120000).toISOString(),
    new Date(now - 60000).toISOString(),
  );
  await assert.rejects(() => draw(p1), /Sesi peserta ditutup/);
  await act(admin, "participant-session", {
    ids: [p1],
    open: false,
    session_starts_at: new Date(now - 60000).toISOString(),
    session_ends_at: new Date(now + 60000).toISOString(),
  });
  await act(admin, "session", { id: session, open: false, repeat: false });
  await assert.rejects(() => draw(p1), /Sesi undian belum/);
  await act(admin, "session", { id: session, open: true, repeat: false });
  const result = await draw(p1, admin, { impersonated_profile_id: district });
  assert.equal(result.person_id, p1);
  assert.equal(
    (
      await db.query(
        "select actor,impersonated_profile_id from public.logs where impersonated_profile_id is not null order by created_at desc limit 1",
      )
    ).rows[0].actor,
    admin,
  );
  assert.equal((await draw(p1)).id, result.id);
  await act(admin, "participant-session", { ids: [p1], open: true });
  assert.equal(
    (
      await db.query(
        "select session_starts_at from public.people where id=$1",
        [p1],
      )
    ).rows[0].session_starts_at,
    null,
  );
  pass(
    "manual/scheduled gates, future/expired ranges, batch atomicity, impersonation audit, idempotent draw",
  );
  const w1 = await fresh(),
    w2 = await fresh();
  const concurrent = await Promise.all([
    rpc(w1, district, "draw", { id: p2, session_id: session }),
    rpc(w2, district, "draw", { id: p3, session_id: session }),
  ]);
  assert.equal(
    new Set([result.package_id, ...concurrent.map((r) => r.package_id)]).size,
    3,
  );
  const duplicates = await Promise.all([
    rpc(w1, district, "draw", { id: p2, session_id: session }),
    rpc(w2, district, "draw", { id: p2, session_id: session }),
  ]);
  assert.equal(duplicates[0].id, duplicates[1].id);
  const p4 = await person("QA Four");
  await assert.rejects(() => draw(p4), /habis|belum tersedia/);
  await assert.rejects(
    () => act(district, "cancel", { id: result.id, reason: "QA" }),
    /panitia/,
  );
  await assert.rejects(
    () => act(admin, "cancel", { id: result.id, reason: "" }),
    /alasan/,
  );
  await act(admin, "cancel", { id: result.id, reason: "QA release package" });
  const reused = await draw(p4);
  assert.equal(reused.package_id, result.package_id);
  pass(
    "simultaneous draws use distinct packages, duplicate requests share a result, exhaustion and cancellation/reuse",
  );
  await db.query("update public.profiles set active=false where id=$1", [
    district,
  ]);
  await assert.rejects(() => draw(p4), /Akses akun/);
  await assert.rejects(
    () => draw(p4, admin, { impersonated_profile_id: district }),
    /tidak aktif/,
  );
  await db.query("update public.profiles set active=true where id=$1", [
    district,
  ]);
  await db.query("begin; set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [other]);
  assert.equal(
    (await db.query("select count(*)::int n from public.people")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.results")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.packages")).rows[0].n,
    0,
  );
  await assert.rejects(
    () => db.query("update public.people set session_open=true"),
    /permission denied/,
  );
  await db.query("rollback");
  pass(
    "inactive accounts denied; RLS hides other districts, packages, and direct mutations",
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    admin,
  ]);
  const edited = (
    await db.query("select public.edit_maqro($1) result", [
      {
        id: reused.package_id,
        category_id: category,
        surah: "QA Edited",
        verses: "8-9",
      },
    ])
  ).rows[0].result;
  assert.equal(edited.surah, "QA Edited");
  assert.notEqual(
    (
      await db.query("select surah from public.results where id=$1", [
        reused.id,
      ])
    ).rows[0].surah,
    "QA Edited",
  );
  await db.query("select public.delete_draw_history($1)", [[concurrent[0].id]]);
  assert.equal(
    (
      await db.query("select count(*)::int n from public.people where id=$1", [
        p2,
      ])
    ).rows[0].n,
    1,
  );
  await db.query("select public.delete_participant($1)", [p3]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.results where person_id=$1",
        [p3],
      )
    ).rows[0].n,
    0,
  );
  pass(
    "package edits preserve receipts; history deletion preserves participants; participant deletion removes dependent results",
  );
  await db.query(
    "insert into public.packages(category_id,surah,verses) select id,'QA SQL fixture','1-2' from public.categories where id <> $1",
    [category],
  );
  for (const file of fs
    .readdirSync("supabase/tests")
    .filter((f) => f.endsWith(".sql"))) {
    const run = spawnSync(
      "C:/Program Files/PostgreSQL/15/bin/psql.exe",
      [
        "-h",
        connection.host,
        "-p",
        String(connection.port),
        "-U",
        connection.user,
        "-d",
        database,
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        `supabase/tests/${file}`,
      ],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 0, `${file}: ${run.stderr}\n${run.stdout}`);
    pass(file);
  }
  // A request that waits on another draw must use the time after acquiring locks.
  const queued = await person("QA Queued");
  await schedule(
    new Date(Date.now() - 60000).toISOString(),
    new Date(Date.now() + 500).toISOString(),
    [queued],
  );
  const blocker = await fresh();
  await blocker.query("begin");
  await blocker.query("select id from public.sessions where id=$1 for update", [
    session,
  ]);
  const waiting = rpc(w1, district, "draw", {
    id: queued,
    session_id: session,
  });
  const observed = waiting.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await db.query("select pg_sleep(0.8)");
  await blocker.query("commit");
  const finished = await observed;
  assert.match(
    finished.error?.message ??
      "draw incorrectly succeeded after schedule ended",
    /Sesi peserta ditutup/,
  );
  pass(
    "queued draw is rejected when its schedule expires while waiting for a lock",
  );
  if (process.argv.includes("--browser")) {
    const { default: verifyBrowser } = await import("./browser-workflows.mjs");
    await verifyBrowser({ connection, database, admin, district, db });
    pass("browser/API/database round trip");
  }
  console.log(`PASS: ${cases} workflow groups; isolated database ${database}`);
} finally {
  for (const worker of workers) await worker.end();
  await db.end();
  await root.query(`drop database "${database}" with (force)`);
  await root.end();
}
