"use client";

import { useState } from "react";
import type { Category, Person, Result, Session } from "@/lib/types";

export default function DrawPicker({
  people,
  sessions,
  categories,
  results,
  busy,
  onSelect,
  onView,
}: {
  people: Person[];
  sessions: Session[];
  categories: Category[];
  results: Result[];
  busy: boolean;
  onSelect: (person: Person, session: Session) => void;
  onView: (result: Result) => void;
}) {
  const [sessionId, setSessionId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const category = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "Cabang tidak tersedia";
  const available = sessions
    .filter((s) => people.some((p) => p.entries.includes(s.category_id)))
    .sort(
      (a, b) =>
        Number(b.open) - Number(a.open) ||
        category(a.category_id).localeCompare(category(b.category_id), "id"),
    );
  const session = available.find((s) => s.id === sessionId);
  const activeResults = new Map(
    results
      .filter((r) => !r.cancelled)
      .map((r) => [`${r.person_id}:${r.session_id}`, r]),
  );
  const rows = (session ? [session] : available).flatMap((currentSession) =>
    people
      .filter((p) => p.entries.includes(currentSession.category_id))
      .map((person) => {
        const result = activeResults.get(`${person.id}:${currentSession.id}`);
        return {
          person,
          session: currentSession,
          result,
          status: result ? "done" : currentSession.open ? "ready" : "closed",
        };
      }),
  );
  const visible = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      `${r.person.name} ${r.person.gender}`
        .toLocaleLowerCase("id")
        .includes(query.trim().toLocaleLowerCase("id")),
  );
  return (
    <section className="panel draw-picker">
      <h2>Pilih peserta undian</h2>
      <p className="muted">
        Tampilkan semua cabang atau pilih satu cabang, lalu tentukan peserta
        yang akan diundi.
      </p>
      {!people.length ? (
        <div className="empty">
          <h3>Belum ada peserta</h3>
          <p>Panitia belum memasukkan peserta untuk kecamatan Anda.</p>
        </div>
      ) : !available.length ? (
        <div className="empty">
          <h3>Sesi belum tersedia</h3>
          <p>Belum ada sesi untuk cabang yang diikuti peserta Anda.</p>
        </div>
      ) : (
        <>
          <div className="filters draw-filters">
            <div className="field draw-session-field">
              <label htmlFor="draw-session">Cabang perlombaan</label>
              <select
                id="draw-session"
                value={session?.id ?? ""}
                disabled={busy}
                onChange={(e) => {
                  setSessionId(e.target.value);
                  setStatus("all");
                }}
              >
                <option value="">Semua cabang</option>
                {available.map((s) => (
                  <option value={s.id} key={s.id}>
                    {category(s.category_id)} ({s.open ? "Dibuka" : "Ditutup"})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="draw-search">Cari peserta</label>
              <input
                id="draw-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nama peserta"
              />
            </div>
            <div className="field">
              <label htmlFor="draw-status">Status undian</label>
              <select
                id="draw-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">Semua status ({rows.length})</option>
                <option value="ready">
                  Siap diundi ({rows.filter((r) => r.status === "ready").length}
                  )
                </option>
                <option value="done">
                  Sudah diundi ({rows.filter((r) => r.status === "done").length}
                  )
                </option>
                <option value="closed">
                  Sesi ditutup (
                  {rows.filter((r) => r.status === "closed").length})
                </option>
              </select>
            </div>
          </div>
          {session && !session.open ? (
            <p className="notice warn">
              Sesi ini ditutup. Bukti yang sudah tersimpan tetap dapat dilihat;
              undian baru menunggu panitia membuka sesi.
            </p>
          ) : null}
          <p className="hint" role="status">
            {visible.length} dari {rows.length} pilihan undian ·{" "}
            {session ? category(session.category_id) : "Semua cabang"}
          </p>
          {visible.length ? (
            <table className="table draw-participants">
              <thead>
                <tr>
                  <th>Peserta</th>
                  <th>Cabang</th>
                  <th>Status undian</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(
                  ({
                    person,
                    session: rowSession,
                    result,
                    status: rowStatus,
                  }) => (
                    <tr key={`${person.id}:${rowSession.id}`}>
                      <td data-label="Peserta">
                        <strong>{person.name}</strong>
                        <small>{person.gender}</small>
                      </td>
                      <td data-label="Cabang">
                        {category(rowSession.category_id)}
                      </td>
                      <td data-label="Status">
                        <div>
                          <span
                            className={`status${rowStatus === "closed" ? " warn" : ""}`}
                          >
                            {result
                              ? "Sudah diundi"
                              : rowSession.open
                                ? "Siap diundi"
                                : "Sesi ditutup"}
                          </span>
                          {result ? <small>{result.code}</small> : null}
                        </div>
                      </td>
                      <td data-label="Tindakan">
                        {result ? (
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() => onView(result)}
                            aria-label={`Lihat bukti ${person.name}, ${category(rowSession.category_id)}`}
                          >
                            Lihat bukti
                          </button>
                        ) : (
                          <button
                            className="btn primary"
                            disabled={!rowSession.open || busy}
                            onClick={() => onSelect(person, rowSession)}
                            aria-label={`Undi maqro ${person.name}, ${category(rowSession.category_id)}`}
                          >
                            Undi maqro
                          </button>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          ) : (
            <div className="empty">
              <h3>Peserta tidak ditemukan</h3>
              <p>Ubah nama atau status untuk melihat pilihan undian lainnya.</p>
              <button
                className="btn"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                }}
              >
                Reset pencarian
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
