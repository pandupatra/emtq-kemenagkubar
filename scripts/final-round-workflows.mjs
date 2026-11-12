import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyFinalUpgrade(db, migration) {
  const actor = randomUUID(),
    category = randomUUID(),
    person = randomUUID(),
    session = randomUUID(),
    pack = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [actor]);
  await db.query(
    "insert into public.profiles(id,username,district,role) values($1,'upgrade-fixture','UPGRADE','district')",
    [actor],
  );
  await db.query(
    "insert into public.categories(id,name) values($1,'Upgrade fixture')",
    [category],
  );
  await db.query(
    "insert into public.people(id,name,district,birth,gender,entries) values($1,'Upgrade fixture','UPGRADE','2000-01-01','Putra',array[$2::uuid])",
    [person, category],
  );
  await db.query(
    "insert into public.sessions(id,category_id,open) values($1,$2,true)",
    [session, category],
  );
  await db.query(
    "insert into public.packages(id,category_id,surah,verses) values($1,$2,'Preserved material','1-7')",
    [pack, category],
  );
  await db.query(
    "insert into public.results(person_id,session_id,package_id,name,district,category,surah,verses,gender) values($1,$2,$3,'Upgrade fixture','UPGRADE','Upgrade fixture','Preserved material','1-7','Putra')",
    [person, session, pack],
  );
  const snapshot = async () =>
    (
      await db.query(`select
    (select jsonb_agg(p order by id) from public.people p) people,
    (select jsonb_agg(s order by id) from public.sessions s) sessions,
    (select jsonb_agg(p order by id) from public.packages p) packages,
    (select jsonb_agg(r order by id) from public.results r) results,
    pg_get_functiondef('public.maqro_action(text,jsonb)'::regprocedure) rpc`)
    ).rows[0];
  const before = await snapshot();
  await db.query(migration);
  assert.deepEqual(await snapshot(), before);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.final_sessions where open",
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.final_participants"))
      .rows[0].n,
    0,
  );
  await db.query("delete from public.results where person_id=$1", [person]);
  await db.query("delete from public.packages where id=$1", [pack]);
  await db.query("delete from public.sessions where id=$1", [session]);
  await db.query("delete from public.final_sessions where category_id=$1", [
    category,
  ]);
  await db.query("delete from public.people where id=$1", [person]);
  await db.query("delete from public.categories where id=$1", [category]);
  await db.query("delete from public.profiles where id=$1", [actor]);
  await db.query("delete from auth.users where id=$1", [actor]);
}

export default async function verifyFinal({
  db,
  fresh,
  admin,
  district,
  other,
  pass,
}) {
  const rpc = async (client, actor, action, payload) => {
    await client.query("begin");
    try {
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
        actor,
      ]);
      await client.query("set local role authenticated");
      const result = (
        await client.query("select public.maqro_final_action($1,$2) result", [
          action,
          payload,
        ])
      ).rows[0].result;
      await client.query("commit");
      return result;
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  };
  const act = (actor, action, payload) => rpc(db, actor, action, payload);
  const category = (
    await db.query(
      "insert into public.categories(name) values('QA Final') returning id",
    )
  ).rows[0].id;
  const people = (
    await db.query(
      `insert into public.people(name,district,birth,gender,entries,session_open)
    select 'QA Final '||n,'MELAK','2000-01-01','Putra',array[$1::uuid],true from generate_series(1,5) n returning id`,
      [category],
    )
  ).rows;
  const [p1, p2, p3, p4, p5] = people.map((p) => p.id);
  const legacyBefore = (
    await db.query(
      "select (select jsonb_agg(s order by id) from public.sessions s) sessions, (select jsonb_agg(r order by id) from public.results r) results, (select jsonb_agg(p order by id) from public.packages p) packages, (select jsonb_agg(p order by id) from public.people p) people",
    )
  ).rows[0];
  const legacy = async () =>
    (
      await db.query(
        "select (select jsonb_agg(s order by id) from public.sessions s) sessions, (select jsonb_agg(r order by id) from public.results r) results, (select jsonb_agg(p order by id) from public.packages p) packages, (select jsonb_agg(p order by id) from public.people p) people",
      )
    ).rows[0];
  await assert.rejects(
    () => act(district, "finalists", { ids: [p1], category_id: category }),
    /panitia/,
  );
  await assert.rejects(
    () =>
      act(admin, "finalists", {
        ids: [p1, randomUUID()],
        category_id: category,
      }),
    /tidak ditemukan/,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.final_participants where id=$1",
        [p1],
      )
    ).rows[0].n,
    0,
  );
  await act(admin, "finalists", {
    ids: [p1, p2, p3, p4],
    category_id: category,
  });
  await act(admin, "finalists", { ids: [p1], category_id: category });
  const session = (
    await db.query(
      "select id from public.final_sessions where category_id=$1",
      [category],
    )
  ).rows[0].id;
  assert.equal(
    (
      await db.query(
        "select session_open from public.final_participants where id=$1",
        [p1],
      )
    ).rows[0].session_open,
    false,
  );
  await assert.rejects(
    () => act(admin, "session", { category_id: category, open: true }),
    /sediakan paket/,
  );
  const pack = await act(admin, "package", {
    category_id: category,
    surah: "QA Final A",
    verses: "1-7",
  });
  await act(admin, "package", {
    category_id: category,
    surah: "QA Final B",
    verses: "1-5",
  });
  await act(admin, "session", { category_id: category, open: true });
  const draw = (id, actor = district, extra = {}) =>
    act(actor, "draw", { id, session_id: session, ...extra });
  await assert.rejects(() => draw(p1), /Sesi finalis ditutup/);
  await assert.rejects(() => draw(p5), /ketentuan final/);
  await assert.rejects(() => draw(p1, other), /ketentuan final/);
  await assert.rejects(() => draw(p1, admin), /hanya untuk kecamatan/);
  await assert.rejects(
    () => draw(p1, district, { impersonated_profile_id: district }),
    /Impersonasi/,
  );
  await act(admin, "participant-session", {
    ids: [p1, p2, p3, p4],
    open: true,
  });
  const w1 = await fresh(),
    w2 = await fresh();
  const [r1, r2] = await Promise.all([
    rpc(w1, district, "draw", { id: p1, session_id: session }),
    rpc(w2, district, "draw", { id: p2, session_id: session }),
  ]);
  assert.notEqual(r1.package_id, r2.package_id);
  await act(admin, "session", { category_id: category, open: false });
  assert.equal((await draw(p1)).id, r1.id);
  await assert.rejects(() => draw(p3), /Sesi final belum/);
  await act(admin, "cancel", { id: r1.id, reason: "QA cancellation" });
  await act(admin, "session", { category_id: category, open: true });
  const replacement = await draw(p3, admin, {
    impersonated_profile_id: district,
  });
  assert.equal(replacement.package_id, r1.package_id);
  assert.equal(
    (
      await db.query(
        "select impersonated_profile_id from public.logs where message like $1 order by created_at desc limit 1",
        [`%${replacement.id}%`],
      )
    ).rows[0].impersonated_profile_id,
    district,
  );
  await assert.rejects(() => draw(p4), /habis/);
  await assert.rejects(
    () => act(admin, "remove-finalist", { id: p1 }),
    /riwayat/,
  );
  await act(admin, "remove-finalist", { id: p4 });
  await act(admin, "package", {
    id: pack.id,
    category_id: category,
    surah: "Edited Final",
    verses: "10-20",
  });
  assert.equal(
    (
      await db.query("select surah from public.final_results where id=$1", [
        r1.id,
      ])
    ).rows[0].surah,
    r1.surah,
  );
  assert.deepEqual(await legacy(), legacyBefore);
  pass(
    "Final eligibility, atomic selection, independent schedules/data, concurrent allocation, idempotence, cancellation and impersonation",
  );

  await act(admin, "finalists", { ids: [p4], category_id: category });
  await act(admin, "package", {
    category_id: category,
    surah: "Scheduled Final",
    verses: "1-3",
  });
  await act(admin, "participant-session", {
    ids: [p4],
    open: true,
    session_starts_at: new Date(Date.now() + 60000).toISOString(),
    session_ends_at: new Date(Date.now() + 120000).toISOString(),
  });
  await assert.rejects(() => draw(p4), /Sesi finalis ditutup/);
  await assert.rejects(
    () =>
      act(admin, "participant-session", {
        ids: [p4],
        open: true,
        session_starts_at: new Date().toISOString(),
        session_ends_at: new Date(Date.now() - 1000).toISOString(),
      }),
    /Waktu selesai/,
  );
  await act(admin, "participant-session", {
    ids: [p4],
    open: false,
    session_starts_at: new Date(Date.now() - 60000).toISOString(),
    session_ends_at: new Date(Date.now() + 800).toISOString(),
  });
  const blocker = await fresh();
  await blocker.query("begin");
  await blocker.query(
    "select id from public.final_sessions where id=$1 for update",
    [session],
  );
  const waiting = rpc(w1, district, "draw", {
    id: p4,
    session_id: session,
  }).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await db.query("select pg_sleep(1)");
  await blocker.query("commit");
  assert.match(
    (await waiting).error?.message || "draw should fail",
    /Sesi finalis ditutup/,
  );
  await act(admin, "participant-session", { ids: [p4], open: true });
  const [same1, same2] = await Promise.all([
    rpc(w1, district, "draw", { id: p4, session_id: session }),
    rpc(w2, district, "draw", { id: p4, session_id: session }),
  ]);
  assert.equal(same1.id, same2.id);
  await db.query("begin");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [other]);
  await db.query("set local role authenticated");
  assert.equal(
    (await db.query("select count(*)::int n from public.final_participants"))
      .rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.final_results")).rows[0]
      .n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.final_packages"))
      .rows[0].n,
    0,
  );
  await assert.rejects(
    () => db.query("update public.final_sessions set open=true"),
    /permission denied/,
  );
  await db.query("rollback");
  await db.query("update public.profiles set active=false where id=$1", [
    district,
  ]);
  await assert.rejects(() => draw(p4), /Akses akun/);
  await db.query("update public.profiles set active=true where id=$1", [
    district,
  ]);
  await db.query("begin");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [admin]);
  await db.query("set local role authenticated");
  await db.query("select public.delete_participant($1)", [p4]);
  await db.query("commit");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.final_results where person_id=$1",
        [p4],
      )
    ).rows[0].n,
    0,
  );
  pass(
    "Final RLS, inactive-account gates, lock-wait schedule expiry, duplicate requests, and participant deletion compatibility",
  );

  const remainingResults = (
    await db.query(
      "select id,cancelled from public.final_results where session_id=$1 order by id",
      [session],
    )
  ).rows;
  const ids = remainingResults.map((r) => r.id);
  const finalBeforeDelete = (
    await db.query(
      "select jsonb_agg(r order by id) snapshot from public.final_results r",
    )
  ).rows[0].snapshot;
  const preliminaryBeforeDelete = await legacy();
  async function deletionAs(actor, targetIds, inspect) {
    await db.query("begin");
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        actor,
      ]);
      await db.query("set local role authenticated");
      const saved = (
        await db.query(
          "select public.delete_final_draw_history($1::uuid[]) result",
          [targetIds],
        )
      ).rows[0].result;
      if (inspect) await inspect(saved);
      return saved;
    } finally {
      await db.query("rollback");
    }
  }
  await assert.rejects(() => deletionAs(district, ids), /panitia aktif/);
  await assert.rejects(() => deletionAs(other, ids), /panitia aktif/);
  await assert.rejects(() => deletionAs(admin, []), /Pilih hasil/);
  await assert.rejects(
    () => deletionAs(admin, [ids[0], randomUUID()]),
    /Sebagian histori/,
  );
  await assert.rejects(
    () => deletionAs(admin, [ids[0], null, randomUUID()]),
    /Sebagian histori/,
  );
  await db.query("update public.profiles set active=false where id=$1", [
    admin,
  ]);
  await assert.rejects(() => deletionAs(admin, ids), /panitia aktif/);
  await db.query("update public.profiles set active=true where id=$1", [admin]);
  await db.query("begin");
  await db.query("set local role anon");
  await assert.rejects(
    () =>
      db.query("select public.delete_final_draw_history($1::uuid[])", [ids]),
    /permission denied/,
  );
  await db.query("rollback");
  const activeId = remainingResults.find((r) => !r.cancelled).id;
  await deletionAs(admin, [activeId, activeId, null], async (saved) => {
    assert.equal(saved.deleted_results, 1);
    assert.deepEqual(saved.ids, [activeId]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.final_results where id=$1",
          [activeId],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.final_participants where category_id=$1",
          [category],
        )
      ).rows[0].n,
      3,
    );
    const log = (
      await db.query(
        "select actor,message from public.logs where message like 'Histori Final dihapus permanen:%' order by created_at desc limit 1",
      )
    ).rows[0];
    assert.equal(log.actor, admin);
    assert.ok(log.message.includes(activeId));
  });
  await deletionAs(admin, ids, async (saved) => {
    assert.equal(saved.deleted_results, ids.length);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.final_results where session_id=$1",
          [session],
        )
      ).rows[0].n,
      0,
    );
    const redrawn = (
      await db.query("select public.maqro_final_action('draw',$1) result", [
        { id: p2, session_id: session, impersonated_profile_id: district },
      ])
    ).rows[0].result;
    assert.ok(redrawn.id);
    assert.equal(redrawn.person_id, p2);
    assert.ok(!ids.includes(redrawn.id));
  });
  assert.deepEqual(
    (
      await db.query(
        "select jsonb_agg(r order by id) snapshot from public.final_results r",
      )
    ).rows[0].snapshot,
    finalBeforeDelete,
  );
  assert.deepEqual(await legacy(), preliminaryBeforeDelete);
  pass(
    "Final history deletion: admin-only, inactive/anonymous denial, atomic stale IDs, deduplication, audit, bulk active/cancelled deletion and redraw without changing preliminary data",
  );
}
