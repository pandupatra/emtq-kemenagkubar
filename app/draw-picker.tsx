"use client";
import {
  participantSessionOpen,
  participantSessionLabel,
} from "@/lib/participant-session";
import DataTable, { TableHead, TableRow, TableCell } from "./data-table";
import ParticipantSessionControl from "./participant-session-control";

import useSessionClock from "./use-session-clock";
import { useState } from "react";
import { participantNumber } from "@/lib/competition-codes";
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
  useSessionClock(people);
  const [sessionId, setSessionId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{
    key: "name" | "number" | "session";
    direction: "asc" | "desc";
  } | null>(null);
  const sessionSort = sort?.key === "session" ? sort.direction : null;
  const resetFilters = () => {
    setSessionId("");
    setQuery("");
    setStatus("all");
    setSort(null);
  };
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
          status: result
            ? "done"
            : currentSession.open && participantSessionOpen(person)
              ? "ready"
              : "closed",
        };
      }),
  );
  const visible = rows.filter(
    (r) =>
      (status === "all" ||
        (status === "scheduled"
          ? !!r.person.session_starts_at && !!r.person.session_ends_at
          : r.status === status)) &&
      `${r.person.name} ${r.person.gender} ${participantNumber(r.person.participant_number, category(r.session.category_id))}`
        .toLocaleLowerCase("id")
        .includes(query.trim().toLocaleLowerCase("id")),
  );
  if (sort) {
    visible.sort((a, b) => {
      const compare = new Intl.Collator("id", {
        sensitivity: "base",
        numeric: true,
      });
      const byName =
        compare.compare(a.person.name, b.person.name) ||
        compare.compare(a.person.id, b.person.id) ||
        compare.compare(a.session.id, b.session.id);
      if (sort.key === "name")
        return sort.direction === "asc" ? byName : -byName;
      if (sort.key === "number") {
        const byNumber = compare.compare(
          participantNumber(
            a.person.participant_number,
            category(a.session.category_id),
          ),
          participantNumber(
            b.person.participant_number,
            category(b.session.category_id),
          ),
        );
        return (sort.direction === "asc" ? byNumber : -byNumber) || byName;
      }
      const startA = Date.parse(a.person.session_starts_at ?? "");
      const startB = Date.parse(b.person.session_starts_at ?? "");
      const scheduledA = Number.isFinite(startA);
      const scheduledB = Number.isFinite(startB);
      if (scheduledA !== scheduledB) return scheduledA ? -1 : 1;
      if (!scheduledA) return byName;
      return (
        (sessionSort === "asc" ? startA - startB : startB - startA) || byName
      );
    });
  }
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
                placeholder="Nama atau no. peserta"
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
                <option value="scheduled">
                  Sesi terjadwal (
                  {
                    rows.filter(
                      (r) =>
                        r.person.session_starts_at && r.person.session_ends_at,
                    ).length
                  }
                  )
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
          <div className="people-filter-summary">
            <p className="hint" role="status">
              {visible.length} dari {rows.length} pilihan undian ·{" "}
              {session ? category(session.category_id) : "Semua cabang"}
            </p>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={resetFilters}
            >
              Reset filter & urutan
            </button>
          </div>
          {visible.length ? (
            <DataTable
              rows={visible}
              resetKey={JSON.stringify([sessionId, query, status, sort])}
              paginationDisabled={busy}
              renderRow={({
                person,
                session: rowSession,
                result,
                status: rowStatus,
              }) => (
                <TableRow key={`${person.id}:${rowSession.id}`}>
                  <TableCell data-label="Peserta">
                    <strong>{person.name}</strong>
                    <small>{person.gender}</small>
                  </TableCell>
                  <TableCell data-label="No. peserta">
                    {participantNumber(
                      person.participant_number,
                      category(rowSession.category_id),
                    )}
                  </TableCell>
                  <TableCell data-label="Cabang">
                    {category(rowSession.category_id)}
                  </TableCell>
                  <TableCell data-label="Sesi peserta">
                    <ParticipantSessionControl person={person} busy={busy} />
                  </TableCell>
                  <TableCell data-label="Status">
                    <div>
                      <span
                        className={`status${rowStatus === "closed" ? " warn" : ""}`}
                      >
                        {rowStatus === "done"
                          ? "Sudah diundi"
                          : rowStatus === "ready"
                            ? "Siap diundi"
                            : !rowSession.open
                              ? "Menunggu pembukaan sesi cabang"
                              : participantSessionLabel(person)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell data-label="Tindakan">
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
                        disabled={
                          !rowSession.open ||
                          !participantSessionOpen(person) ||
                          busy
                        }
                        onClick={() => onSelect(person, rowSession)}
                        aria-label={`Undi maqro ${person.name}, ${category(rowSession.category_id)}`}
                      >
                        Undi maqro
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              )}
              aria-label="Pilihan peserta undian"
              className="table draw-participants"
            >
              <TableHead>
                <TableRow>
                  {(
                    [
                      ["name", "Peserta"],
                      ["number", "No. peserta"],
                    ] as const
                  ).map(([key, label]) => (
                    <TableCell
                      key={key}
                      component="th"
                      scope="col"
                      aria-sort={
                        sort?.key === key
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        className="table-sort"
                        onClick={() =>
                          setSort({
                            key,
                            direction:
                              sort?.key === key && sort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        {label}{" "}
                        <span aria-hidden="true">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            {sort?.key !== key || sort.direction !== "desc" ? (
                              <path d="m4 6 4-4 4 4" />
                            ) : null}
                            {sort?.key !== key || sort.direction !== "asc" ? (
                              <path d="m4 10 4 4 4-4" />
                            ) : null}
                          </svg>
                        </span>
                      </button>
                    </TableCell>
                  ))}
                  <TableCell component="th">Cabang</TableCell>
                  <TableCell
                    component="th"
                    scope="col"
                    aria-sort={
                      sessionSort === "asc"
                        ? "ascending"
                        : sessionSort === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    <button
                      type="button"
                      className="table-sort"
                      title="Urutkan berdasarkan waktu mulai sesi"
                      onClick={() =>
                        setSort({
                          key: "session",
                          direction: sessionSort === "asc" ? "desc" : "asc",
                        })
                      }
                    >
                      Sesi peserta{" "}
                      <span aria-hidden="true">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          {sessionSort !== "desc" ? (
                            <path d="m4 6 4-4 4 4" />
                          ) : null}
                          {sessionSort !== "asc" ? (
                            <path d="m4 10 4 4 4-4" />
                          ) : null}
                        </svg>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell component="th">Status undian</TableCell>
                  <TableCell component="th">Tindakan</TableCell>
                </TableRow>
              </TableHead>
            </DataTable>
          ) : (
            <div className="empty">
              <h3>Peserta tidak ditemukan</h3>
              <p>Ubah nama atau status untuk melihat pilihan undian lainnya.</p>
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={resetFilters}
              >
                Reset filter & urutan
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
