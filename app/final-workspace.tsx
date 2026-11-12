"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Data, Package, Person, Result, Session } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import {
  finalExportData,
  finalPeople,
  type FinalData,
} from "@/lib/final-round";
import { participantNumber } from "@/lib/competition-codes";
import DataTable, { TableCell, TableHead, TableRow } from "./data-table";
import DrawPicker from "./draw-picker";
import BankTable from "./bank-table";
import WorkSummary from "./work-summary";
import ParticipantResults from "./participant-results";
import ParticipantSessionControl from "./participant-session-control";
import SessionScheduleForm from "./session-schedule-form";
import useWorkspaceSync from "./use-workspace-sync";
import useSessionClock from "./use-session-clock";
import { Modal, Receipt } from "./draw-shared";

const empty: FinalData = {
  final_participants: [],
  final_sessions: [],
  final_packages: [],
  final_results: [],
};
type DialogState =
  | { kind: "finalists" }
  | { kind: "schedule"; people: Person[] }
  | { kind: "package"; pack?: Package }
  | { kind: "session"; session: Session }
  | { kind: "remove"; person: Person }
  | { kind: "cancel"; result: Result }
  | { kind: "receipt"; result: Result };

async function readFinalTable(name: string) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase()
      .from(name)
      .select("*")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export default function FinalWorkspace({
  base,
  page,
  impersonatedId,
  onBusy,
  onOpenPeople,
}: {
  base: Data;
  page: string;
  impersonatedId?: string;
  onBusy: (busy: boolean) => void;
  onOpenPeople: () => void;
}) {
  const admin = base.profile.role === "admin";
  const [data, setData] = useState<FinalData>(empty);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [district, setDistrict] = useState("");
  const [drawStatus, setDrawStatus] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selection, setSelection] = useState<{
    person: Person;
    session: Session;
  } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [step, setStep] = useState(1);
  const [exporting, setExporting] = useState(false);
  const alive = useRef(true),
    mutation = useRef(false),
    version = useRef(0);
  const people = finalPeople(base.people, data.final_participants);
  useSessionClock(people);
  const categoryName = (id: string) =>
    base.categories.find((c) => c.id === id)?.name || "Cabang tidak tersedia";
  const personNumber = (p: Person) =>
    participantNumber(p.participant_number, categoryName(p.entries[0]));
  const tables = useCallback(
    () => [
      "final_participants",
      "final_sessions",
      "final_results",
      ...(admin ? ["final_packages"] : []),
    ],
    [admin],
  );
  const refresh = useCallback(async () => {
    const current = ++version.current;
    const names = tables();
    const rows = await Promise.all(names.map(readFinalTable));
    if (alive.current && current === version.current) {
      setData({
        ...empty,
        ...Object.fromEntries(names.map((name, i) => [name, rows[i]])),
      });
      setUnavailable(false);
    }
  }, [tables]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await refresh();
    } catch (e) {
      if (!alive.current) return;
      if (["PGRST205", "42P01"].includes((e as { code: string }).code))
        setUnavailable(true);
      else
        setError(
          "Data Final belum dapat dimuat. Periksa koneksi lalu muat ulang.",
        );
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      version.current++;
    };
  }, [load]);
  useEffect(() => {
    setQuery("");
    setCategory("");
    setSelected([]);
    setSelection(null);
    setStep(1);
    setResult(null);
    setDialog(null);
    setError("");
    if (page !== "people") {
      setDistrict("");
      setDrawStatus("");
    }
  }, [page]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 6000);
    return () => clearTimeout(timer);
  }, [feedback]);
  useWorkspaceSync(
    unavailable ? undefined : base.profile,
    () => loading || mutation.current || !!dialog || step === 2 || step === 3,
    async (_tables, valid) => {
      if (valid()) await refresh();
    },
    true,
  );

  async function act(action: string, payload: Record<string, unknown>) {
    if (mutation.current) return null;
    mutation.current = true;
    setBusy(true);
    onBusy(true);
    version.current++;
    setError("");
    setFeedback("");
    try {
      const { data: saved, error: failure } = await supabase().rpc(
        "maqro_final_action",
        {
          action,
          payload: {
            ...payload,
            ...(impersonatedId
              ? { impersonated_profile_id: impersonatedId }
              : {}),
          },
        },
      );
      if (failure) throw failure;
      if (!alive.current) return saved;
      setDialog(null);
      setSelected([]);
      setFeedback("Perubahan babak Final tersimpan.");
      try {
        await refresh();
      } catch {
        setError(
          "Perubahan tersimpan. Data terbaru belum termuat; gunakan Muat ulang sebelum melanjutkan.",
        );
      }
      return saved;
    } catch (e) {
      if (alive.current)
        setError(
          (e as { message?: string }).message ||
            "Perubahan gagal disimpan. Periksa koneksi lalu coba lagi.",
        );
      return null;
    } finally {
      mutation.current = false;
      if (alive.current) setBusy(false);
      onBusy(false);
    }
  }
  const summaryData = finalExportData(base, data);
  const drawnPeople = new Set(
    data.final_results.filter((r) => !r.cancelled).map((r) => r.person_id),
  );
  const search = (p: Person) =>
    (!category || p.entries.includes(category)) &&
    (!district || p.district === district) &&
    (!drawStatus ||
      (drawStatus === "drawn"
        ? drawnPeople.has(p.id)
        : !drawnPeople.has(p.id))) &&
    `${p.name} ${personNumber(p)} ${p.district}`
      .toLocaleLowerCase("id")
      .includes(query.trim().toLocaleLowerCase("id"));
  const filtered = people
    .filter(search)
    .sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }));
  const chosen = people.filter((p) => selected.includes(p.id));
  const activeResults = data.final_results.filter(
    (r) => !r.cancelled && people.some((p) => p.id === r.person_id),
  );
  const sessions = base.categories.map(
    (c) =>
      data.final_sessions.find((s) => s.category_id === c.id) || {
        id: c.id,
        category_id: c.id,
        open: false,
      },
  );
  const sessionCounts = (s: Session) => {
    const finalists = people.filter((p) => p.entries.includes(s.category_id));
    const drawn = activeResults.filter((r) => r.session_id === s.id);
    const packs = data.final_packages.filter(
      (p) => p.category_id === s.category_id,
    );
    return {
      finalists: finalists.length,
      remaining: finalists.length - drawn.length,
      available: packs.filter(
        (p) => !activeResults.some((r) => r.package_id === p.id),
      ).length,
      total: packs.length,
    };
  };
  const filters = (
    <div className="filters final-filters">
      <div className="field">
        <label htmlFor="final-search">Cari finalis</label>
        <input
          id="final-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nama, nomor, atau kecamatan"
        />
      </div>
      <div className="field">
        <label htmlFor="final-category">Cabang</label>
        <select
          id="final-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Semua cabang</option>
          {base.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {admin ? (
        <div className="field">
          <label htmlFor="final-district">Kecamatan</label>
          <select
            id="final-district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            <option value="">Semua kecamatan</option>
            {[
              ...new Set([
                ...base.profiles.flatMap((p) =>
                  p.role === "district" && p.district ? [p.district] : [],
                ),
                ...people.map((p) => p.district),
              ]),
            ]
              .sort((a, b) => a.localeCompare(b, "id"))
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="final-draw-status">Status undian</label>
        <select
          id="final-draw-status"
          value={drawStatus}
          onChange={(e) => setDrawStatus(e.target.value)}
        >
          <option value="">Semua status</option>
          <option value="drawn">Sudah mengundi</option>
          <option value="not-drawn">Belum mengundi</option>
        </select>
      </div>
      <button
        className="btn"
        onClick={() => {
          setQuery("");
          setCategory("");
          setDistrict("");
          setDrawStatus("");
        }}
      >
        Reset filter
      </button>
    </div>
  );

  async function exportFinal() {
    if (exporting) return;
    setExporting(true);
    try {
      const { participantWorkbookBuffer } =
        await import("@/lib/participant-export");
      const buffer = await participantWorkbookBuffer(
        finalExportData(base, data),
        "Final",
      );
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(buffer)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `peserta-final-${Date.now()}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Rekap Final belum dapat dibuat. Coba kembali.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <p role="status">Memuat babak Final…</p>;
  if (unavailable)
    return (
      <section className="panel panel-inset">
        <h2>Babak Final belum diaktifkan</h2>
        <p>
          Hubungi pengelola untuk mengaktifkan babak Final. Undian penyisihan
          tetap tersedia.
        </p>
        <button className="btn" onClick={() => void load()}>
          Periksa kembali
        </button>
      </section>
    );
  return (
    <section
      className="final-workspace"
      aria-label="Babak Final"
      aria-busy={busy}
    >
      <div className="final-toolbar">
        {page !== "dashboard" ? (
          <p>
            Babak <strong>Final</strong> · {people.length} finalis ·{" "}
            {new Set(activeResults.map((r) => r.person_id)).size} sudah mengundi
          </p>
        ) : null}
        <div className="actions">
          {admin && page === "people" ? (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => setDialog({ kind: "finalists" })}
            >
              Pilih finalis
            </button>
          ) : null}
          {admin && page === "bank" ? (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => setDialog({ kind: "package" })}
            >
              Tambah maqro final
            </button>
          ) : null}
          {page === "people" ? (
            <button
              className="btn"
              disabled={busy || exporting || !people.length}
              onClick={() => void exportFinal()}
            >
              {exporting ? "Membuat rekap…" : "Export Excel Final"}
            </button>
          ) : null}
          <button className="btn" disabled={busy} onClick={() => void load()}>
            Muat ulang Final
          </button>
        </div>
      </div>
      {!dialog && error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className="notice" role="status">
          {feedback}
        </p>
      ) : null}

      {page === "dashboard" && admin ? (
        <WorkSummary
          data={summaryData}
          openPeople={(filter) => {
            setDistrict(filter.district || "");
            setDrawStatus(filter.status || "");
            onOpenPeople();
          }}
        />
      ) : null}
      {page === "people" ? (
        <>
          {filters}
          {admin && chosen.length ? (
            <div className="actions">
              <p>{chosen.length} finalis terpilih</p>
              <button
                className="btn"
                disabled={busy}
                onClick={() => setDialog({ kind: "schedule", people: chosen })}
              >
                Atur sesi finalis terpilih
              </button>
              <button className="btn" onClick={() => setSelected([])}>
                Batal pilih
              </button>
            </div>
          ) : null}
          {!people.length ? (
            <div className="empty">
              <h2>Finalis belum ditetapkan panitia</h2>
              <p>
                {admin
                  ? "Gunakan Pilih finalis di Daftar peserta untuk memilih dari peserta terdaftar."
                  : "Finalis kecamatan Anda akan tampil setelah ditetapkan panitia."}
              </p>
            </div>
          ) : !filtered.length ? (
            <p className="empty">
              Finalis tidak ditemukan. Ubah pencarian atau reset filter.
            </p>
          ) : (
            <DataTable
              rows={filtered}
              resetKey={`${query}:${category}:${district}:${drawStatus}`}
              paginationDisabled={busy}
              className="table final-people-table"
              renderRow={(p) => (
                <TableRow key={p.id}>
                  {admin ? (
                    <TableCell data-label="Pilih">
                      <input
                        type="checkbox"
                        aria-label={`Pilih finalis ${p.name}`}
                        checked={selected.includes(p.id)}
                        disabled={busy}
                        onChange={(e) =>
                          setSelected((ids) =>
                            e.target.checked
                              ? [...ids, p.id]
                              : ids.filter((id) => id !== p.id),
                          )
                        }
                      />
                    </TableCell>
                  ) : null}
                  <TableCell data-label="No. peserta">
                    {personNumber(p)}
                  </TableCell>
                  <TableCell data-label="Nama">
                    <strong>{p.name}</strong>
                    <small>
                      {p.district} · {p.gender}
                    </small>
                  </TableCell>
                  <TableCell data-label="Cabang">
                    {categoryName(p.entries[0])}
                  </TableCell>
                  <TableCell data-label="Sesi finalis">
                    <ParticipantSessionControl
                      person={p}
                      busy={busy}
                      onConfigure={
                        admin
                          ? () => setDialog({ kind: "schedule", people: [p] })
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell data-label="Hasil final">
                    <ParticipantResults
                      results={data.final_results.filter(
                        (r) => r.person_id === p.id,
                      )}
                      busy={busy}
                      onView={(r) => setDialog({ kind: "receipt", result: r })}
                      onCancel={
                        admin
                          ? (r) => setDialog({ kind: "cancel", result: r })
                          : undefined
                      }
                    />
                  </TableCell>
                  {admin ? (
                    <TableCell data-label="Tindakan">
                      <button
                        className="btn"
                        disabled={
                          busy ||
                          data.final_results.some((r) => r.person_id === p.id)
                        }
                        onClick={() => setDialog({ kind: "remove", person: p })}
                      >
                        Keluarkan dari Final
                      </button>
                    </TableCell>
                  ) : null}
                </TableRow>
              )}
            >
              <TableHead>
                <TableRow>
                  {[
                    ...(admin ? ["Pilih"] : []),
                    "No. peserta",
                    "Nama",
                    "Cabang",
                    "Sesi finalis",
                    "Hasil final",
                    ...(admin ? ["Tindakan"] : []),
                  ].map((h) => (
                    <TableCell component="th" scope="col" key={h}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
            </DataTable>
          )}
        </>
      ) : null}

      {page === "sessions" && admin ? (
        <DataTable
          rows={sessions}
          paginationDisabled={busy}
          className="table final-sessions-table"
          renderRow={(s) => {
            const count = sessionCounts(s);
            return (
              <TableRow key={s.category_id}>
                <TableCell data-label="Cabang">
                  <strong>{categoryName(s.category_id)}</strong>
                </TableCell>
                <TableCell data-label="Finalis">
                  {count.finalists} finalis · {count.remaining} belum mengundi
                </TableCell>
                <TableCell data-label="Paket">
                  {count.available} tersedia / {count.total} paket
                </TableCell>
                <TableCell data-label="Status">
                  <span className={`status${s.open ? "" : " warn"}`}>
                    {s.open ? "Dibuka" : "Belum dibuka / ditutup"}
                  </span>
                </TableCell>
                <TableCell data-label="Tindakan">
                  <button
                    className={`btn ${s.open ? "" : "primary"}`}
                    disabled={
                      busy ||
                      (!s.open && (!count.finalists || !count.available))
                    }
                    onClick={() => setDialog({ kind: "session", session: s })}
                  >
                    {s.open ? "Tutup undian final" : "Buka undian final"}
                  </button>
                </TableCell>
              </TableRow>
            );
          }}
        >
          <TableHead>
            <TableRow>
              {["Cabang", "Finalis", "Paket", "Status", "Tindakan"].map((h) => (
                <TableCell component="th" scope="col" key={h}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
        </DataTable>
      ) : null}

      {page === "bank" && admin ? (
        <BankTable
          packages={data.final_packages}
          categories={base.categories}
          people={people}
          results={data.final_results}
          busy={busy}
          onView={(r) => setDialog({ kind: "receipt", result: r })}
          onEdit={(pack) => setDialog({ kind: "package", pack })}
        />
      ) : null}

      {page === "draw" ? (
        <div className="draw-layout">
          <ol className="stepper" aria-label="Tahapan undian final">
            {["Pilih finalis", "Periksa data", "Undi maqro", "Bukti hasil"].map(
              (label, i) => (
                <li
                  key={label}
                  aria-current={step === i + 1 ? "step" : undefined}
                >
                  <span>{i + 1}</span>
                  {label}
                </li>
              ),
            )}
          </ol>
          <div className="draw-context">
            Kafilah {base.profile.district} · Babak Final
          </div>
          {step === 1 ? (
            people.length ? (
              <DrawPicker
                round="Final"
                people={people}
                categories={base.categories}
                sessions={data.final_sessions}
                results={data.final_results}
                busy={busy}
                onSelect={(person, session) => {
                  setSelection({ person, session });
                  setStep(2);
                  setError("");
                }}
                onView={(r) => {
                  setResult(r);
                  setStep(4);
                }}
              />
            ) : (
              <div className="empty">
                <h2>Finalis belum ditetapkan panitia</h2>
                <p>Belum ada finalis dari kecamatan Anda.</p>
              </div>
            )
          ) : null}
          {step === 2 && selection ? (
            <section className="panel panel-inset">
              <h2>Periksa data undian final</h2>
              <dl className="review">
                {[
                  ["Babak", "Final"],
                  ["No. peserta", personNumber(selection.person)],
                  ["Nama peserta", selection.person.name],
                  ["Kecamatan", selection.person.district],
                  ["Golongan", selection.person.gender],
                  ["Cabang", categoryName(selection.session.category_id)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="notice">
                Hasil langsung disimpan. Pembatalan hanya dapat dilakukan
                panitia dengan alasan tercatat.
              </p>
              <div className="actions draw-action">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setSelection(null);
                    setStep(1);
                  }}
                >
                  Kembali
                </button>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={async () => {
                    setStep(3);
                    const saved = await act("draw", {
                      id: selection.person.id,
                      session_id: selection.session.id,
                    });
                    if (saved) {
                      setResult(saved as Result);
                      setStep(4);
                    } else setStep(2);
                  }}
                >
                  Undi maqro final
                </button>
              </div>
            </section>
          ) : null}
          {step === 3 ? (
            <div className="panel panel-inset" role="status">
              <div className="draw-shuffle" aria-hidden="true">
                <span className="draw-card draw-card-left" />
                <span className="draw-card draw-card-right" />
                <span className="draw-card draw-card-front">
                  <span>Maqro</span>
                  <span className="draw-card-seal">?</span>
                </span>
              </div>
              <h2>Mengundi maqro final…</h2>
              <p>Menetapkan maqro dan menyimpan hasil.</p>
            </div>
          ) : null}
          {step === 4 && result ? (
            <>
              <Receipt
                result={
                  data.final_results.find((r) => r.id === result.id) || result
                }
                person={people.find((p) => p.id === result.person_id)}
                round="Final"
              />
              <div className="actions receipt-actions">
                <button
                  className="btn"
                  onClick={() => {
                    setStep(1);
                    setResult(null);
                    setSelection(null);
                  }}
                >
                  Kembali ke finalis
                </button>
                <button className="btn primary" onClick={() => window.print()}>
                  Cetak / Simpan PDF
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {dialog ? (
        <Modal
          title={
            {
              finalists: "Pilih finalis",
              schedule: "Atur sesi finalis",
              package: "Paket maqro final",
              session: "Pengaturan sesi Final",
              remove: "Keluarkan finalis",
              cancel: "Batalkan hasil final",
              receipt: "Bukti hasil undian Final",
            }[dialog.kind]
          }
          close={() => {
            if (!busy) {
              setDialog(null);
              setError("");
            }
          }}
          busy={busy}
        >
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {dialog.kind === "finalists" ? (
            <FinalistPicker
              people={base.people}
              categories={base.categories}
              finalists={data.final_participants.map((p) => p.id)}
              busy={busy}
              onSave={(ids, category_id) =>
                void act("finalists", { ids, category_id })
              }
            />
          ) : null}
          {dialog.kind === "schedule" ? (
            <SessionScheduleForm
              people={dialog.people}
              busy={busy}
              onSave={(values) => void act("participant-session", values)}
            />
          ) : null}
          {dialog.kind === "package" ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act("package", {
                  id: dialog.pack?.id,
                  category_id: f.get("category_id"),
                  surah: f.get("surah"),
                  verses: f.get("verses"),
                });
              }}
            >
              <p>
                Babak Final. Perubahan paket berlaku untuk undian berikutnya;
                bukti tersimpan tetap sama.
              </p>
              <label htmlFor="final-pack-category">Cabang *</label>
              <select
                id="final-pack-category"
                name="category_id"
                defaultValue={dialog.pack?.category_id || ""}
                required
                disabled={busy}
              >
                <option value="" disabled>
                  Pilih cabang
                </option>
                {base.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <label htmlFor="final-surah">Surah / materi *</label>
              <input
                id="final-surah"
                name="surah"
                required
                maxLength={100}
                defaultValue={dialog.pack?.surah}
                disabled={busy}
              />
              <label htmlFor="final-verses">Ayat / rentang materi *</label>
              <input
                id="final-verses"
                name="verses"
                required
                maxLength={100}
                defaultValue={dialog.pack?.verses}
                disabled={busy}
              />
              <button className="btn primary" disabled={busy}>
                Simpan maqro final
              </button>
            </form>
          ) : null}
          {dialog.kind === "session" ? (
            <>
              <p>
                <strong>
                  {categoryName(dialog.session.category_id)} · Babak Final
                </strong>
              </p>
              <p>
                {sessionCounts(dialog.session).finalists} finalis;{" "}
                {sessionCounts(dialog.session).remaining} belum mengundi;{" "}
                {sessionCounts(dialog.session).available} paket tersedia.
              </p>
              {!dialog.session.open &&
              sessionCounts(dialog.session).available <
                sessionCounts(dialog.session).remaining ? (
                <p className="notice warn">
                  Paket belum cukup untuk seluruh finalis yang belum mengundi.
                  Tambahkan paket sebelum peserta berikutnya mengundi.
                </p>
              ) : null}
              <p>
                {dialog.session.open
                  ? "Undian baru akan dihentikan. Bukti hasil tetap tersimpan."
                  : "Finalis hanya dapat mengundi jika sesi peserta juga dibuka atau jadwalnya sudah dimulai."}
              </p>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  void act("session", {
                    category_id: dialog.session.category_id,
                    open: !dialog.session.open,
                  })
                }
              >
                {dialog.session.open
                  ? "Tutup undian final"
                  : "Buka undian final"}
              </button>
            </>
          ) : null}
          {dialog.kind === "remove" ? (
            <>
              <p>
                Keluarkan <strong>{dialog.person.name}</strong> dari daftar
                finalis? Data peserta dan hasil penyisihan tetap tersimpan.
              </p>
              <button
                className="btn danger"
                disabled={busy}
                onClick={() =>
                  void act("remove-finalist", { id: dialog.person.id })
                }
              >
                Keluarkan dari Final
              </button>
            </>
          ) : null}
          {dialog.kind === "cancel" ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void act("cancel", {
                  id: dialog.result.id,
                  reason: new FormData(e.currentTarget).get("reason"),
                });
              }}
            >
              <p>
                Batalkan hasil Final <strong>{dialog.result.name}</strong>?
                Hasil lama tetap tercatat dan paket kembali tersedia.
              </p>
              <label htmlFor="final-cancel-reason">Alasan pembatalan *</label>
              <textarea
                id="final-cancel-reason"
                name="reason"
                required
                maxLength={250}
                disabled={busy}
              />
              <button className="btn danger" disabled={busy}>
                Batalkan hasil final
              </button>
            </form>
          ) : null}
          {dialog.kind === "receipt" ? (
            <>
              <Receipt
                result={dialog.result}
                person={people.find((p) => p.id === dialog.result.person_id)}
                round="Final"
              />
              <div className="actions dialog-actions">
                <button className="btn primary" onClick={() => window.print()}>
                  Cetak / Simpan PDF
                </button>
              </div>
            </>
          ) : null}
        </Modal>
      ) : null}
    </section>
  );
}

function FinalistPicker({
  people,
  categories,
  finalists,
  busy,
  onSave,
}: {
  people: Person[];
  categories: Data["categories"];
  finalists: string[];
  busy: boolean;
  onSave: (ids: string[], category: string) => void;
}) {
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const candidates = people.filter(
    (p) => p.entries.includes(category) && !finalists.includes(p.id),
  );
  const chosen = candidates.filter((p) => selected.includes(p.id));
  const name = categories.find((c) => c.id === category)?.name || "";
  const filtered = candidates.filter((p) =>
    `${p.name} ${p.district} ${participantNumber(p.participant_number, name)}`
      .toLocaleLowerCase("id")
      .includes(query.toLocaleLowerCase("id")),
  );
  return (
    <div className="form-stack">
      {review ? (
        <>
          <h3>Periksa finalis yang dipilih</h3>
          <p>
            Babak Final · {name} · {chosen.length} peserta
          </p>
          <ul>
            {chosen.map((p) => (
              <li key={p.id}>
                {participantNumber(p.participant_number, name)} · {p.name} ·{" "}
                {p.district} · {p.gender}
              </li>
            ))}
          </ul>
          <p>
            Sesi finalis dimulai dalam keadaan ditutup. Atur aksesnya setelah
            penetapan.
          </p>
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setReview(false)}
            >
              Kembali
            </button>
            <button
              className="btn primary"
              disabled={busy || !chosen.length}
              onClick={() =>
                onSave(
                  chosen.map((p) => p.id),
                  category,
                )
              }
            >
              Tetapkan finalis
            </button>
          </div>
        </>
      ) : (
        <>
          <label htmlFor="choose-final-category">Cabang *</label>
          <select
            id="choose-final-category"
            value={category}
            disabled={busy}
            onChange={(e) => {
              setCategory(e.target.value);
              setSelected([]);
            }}
          >
            <option value="">Pilih cabang</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label htmlFor="choose-final-search">Cari peserta terdaftar</label>
          <input
            id="choose-final-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nama, nomor, atau kecamatan"
          />
          {!category ? (
            <p>Pilih cabang terlebih dahulu.</p>
          ) : !filtered.length ? (
            <p>
              Tidak ada peserta yang sesuai atau seluruh peserta sudah menjadi
              finalis.
            </p>
          ) : (
            <DataTable
              rows={filtered}
              resetKey={`${category}:${query}`}
              paginationDisabled={busy}
              className="table final-candidates-table"
              renderRow={(p) => (
                <TableRow key={p.id}>
                  <TableCell data-label="Pilih">
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      disabled={busy}
                      aria-label={`Pilih ${p.name}`}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, p.id]
                            : ids.filter((id) => id !== p.id),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell data-label="Peserta">
                    <strong>{p.name}</strong>
                    <small>
                      {participantNumber(p.participant_number, name)} ·{" "}
                      {p.gender}
                    </small>
                  </TableCell>
                  <TableCell data-label="Kecamatan">{p.district}</TableCell>
                </TableRow>
              )}
            >
              <TableHead>
                <TableRow>
                  {["Pilih", "Peserta", "Kecamatan"].map((h) => (
                    <TableCell key={h} component="th" scope="col">
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
            </DataTable>
          )}
          <button
            className="btn primary"
            disabled={busy || !chosen.length}
            onClick={() => setReview(true)}
          >
            Periksa {chosen.length} finalis terpilih
          </button>
        </>
      )}
    </div>
  );
}
