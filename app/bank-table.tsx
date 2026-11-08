"use client";
import DataTable, { TableHead, TableRow, TableCell } from "./data-table";

import { useMemo, useState } from "react";
import type { Category, Package, Person, Result } from "@/lib/types";
import ActionIcon from "./action-icon";

export default function BankTable({
  packages,
  categories,
  people,
  results,
  busy,
  onView,
  onEdit,
}: {
  packages: Package[];
  categories: Category[];
  people: Person[];
  results: Result[];
  busy: boolean;
  onView: (result: Result) => void;
  onEdit: (pack: Package) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("material");
  const rows = useMemo(() => {
    const recipients = new Map<string, Result[]>();
    for (const result of results) {
      if (result.cancelled) continue;
      const entries = recipients.get(result.package_id) ?? [];
      entries.push(result);
      recipients.set(result.package_id, entries);
    }
    const names = new Map(categories.map((entry) => [entry.id, entry.name]));
    const persons = new Map(people.map((person) => [person.id, person]));
    return packages.map((pack) => ({
      ...pack,
      category: names.get(pack.category_id) ?? "Cabang tidak ditemukan",
      recipients: (recipients.get(pack.id) ?? []).map((result) => ({
        result,
        name: persons.get(result.person_id)?.name ?? result.name,
        district: persons.get(result.person_id)?.district ?? result.district,
      })),
    }));
  }, [packages, categories, people, results]);
  const search = query.trim().toLocaleLowerCase("id");
  const filtered = rows
    .filter(
      (row) =>
        (!category || row.category_id === category) &&
        (!status ||
          (status === "assigned"
            ? row.recipients.length > 0
            : row.recipients.length === 0)) &&
        (!search ||
          [
            row.category,
            row.surah,
            row.verses,
            ...row.recipients.flatMap((recipient) => [
              recipient.name,
              recipient.district,
            ]),
          ]
            .join(" ")
            .toLocaleLowerCase("id")
            .includes(search)),
    )
    .sort(
      (a, b) =>
        (sort === "category"
          ? a.category.localeCompare(b.category, "id")
          : 0) ||
        a.surah.localeCompare(b.surah, "id", { numeric: true }) ||
        a.verses.localeCompare(b.verses, "id", { numeric: true }) ||
        a.id.localeCompare(b.id),
    );
  const hasFilters = Boolean(
    query || category || status || sort !== "material",
  );
  return (
    <section aria-label="Daftar paket maqro">
      <div className="filters bank-filters">
        <div className="field bank-search">
          <label htmlFor="bank-search">Cari paket atau penerima</label>
          <input
            id="bank-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Materi, nama, atau kecamatan"
          />
        </div>
        <div className="field">
          <label htmlFor="bank-category">Cabang</label>
          <select
            id="bank-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Semua cabang</option>
            {categories.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bank-status">Status paket</label>
          <select
            id="bank-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Semua status</option>
            <option value="available">Tersedia</option>
            <option value="assigned">Sudah diundi</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="bank-sort">Urutkan</label>
          <select
            id="bank-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="material">Surah / materi</option>
            <option value="category">Cabang, lalu materi</option>
          </select>
        </div>
      </div>
      <div className="people-filter-summary">
        <p role="status">
          Menampilkan {filtered.length} dari {packages.length} paket
        </p>
        {hasFilters ? (
          <button
            className="btn"
            onClick={() => {
              setQuery("");
              setCategory("");
              setStatus("");
              setSort("material");
            }}
          >
            Reset filter &amp; urutan
          </button>
        ) : null}
      </div>
      <p className="hint">
        Penerima ditampilkan dari hasil undian aktif. Paket dari undian yang
        dibatalkan atau dihapus kembali tersedia.
      </p>
      <div className="panel data-panel">
        {filtered.length ? (
          <DataTable
            rows={filtered}
            resetKey={JSON.stringify([query, category, status, sort])}
            paginationDisabled={busy}
            renderRow={(row) => (
              <TableRow key={row.id}>
                <TableCell data-label="Cabang">{row.category}</TableCell>
                <TableCell data-label="Materi">
                  <div>
                    {row.surah}
                    <small>Ayat / rentang materi: {row.verses}</small>
                  </div>
                </TableCell>
                <TableCell data-label="Status">
                  <span
                    className={row.recipients.length ? "status warn" : "status"}
                  >
                    {row.recipients.length ? "Sudah diundi" : "Tersedia"}
                  </span>
                </TableCell>
                <TableCell data-label="Penerima undian">
                  {row.recipients.length ? (
                    <div className="bank-recipients">
                      {row.recipients.map((recipient) => (
                        <div
                          className="bank-recipient"
                          key={recipient.result.id}
                        >
                          <div>
                            <strong>{recipient.name}</strong>
                            <small>
                              {recipient.district} · {recipient.result.gender}
                            </small>
                          </div>
                          <button
                            className="btn icon-btn"
                            title="Lihat bukti undian"
                            aria-label={`Lihat bukti ${row.surah}, ${recipient.name}`}
                            disabled={busy}
                            onClick={() => onView(recipient.result)}
                          >
                            <ActionIcon name="eye" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">Belum ada penerima</span>
                  )}
                </TableCell>
                <TableCell data-label="Tindakan">
                  <button
                    className="btn icon-btn"
                    disabled={busy}
                    onClick={() => onEdit(row)}
                    title="Edit maqro"
                    aria-label={`Edit maqro ${row.surah}, ${row.verses}`}
                  >
                    <ActionIcon name="edit" />
                  </button>
                </TableCell>
              </TableRow>
            )}
            className="table bank-table"
          >
            <caption className="sr-only">
              Paket maqro dan penerima undian aktif
            </caption>
            <TableHead>
              <TableRow>
                <TableCell component="th" scope="col">
                  Cabang
                </TableCell>
                <TableCell component="th" scope="col">
                  Materi
                </TableCell>
                <TableCell component="th" scope="col">
                  Status
                </TableCell>
                <TableCell component="th" scope="col">
                  Penerima undian
                </TableCell>
                <TableCell component="th" scope="col">
                  Tindakan
                </TableCell>
              </TableRow>
            </TableHead>
          </DataTable>
        ) : (
          <div className="panel-inset">
            <h2>
              {packages.length
                ? "Paket tidak ditemukan"
                : "Belum ada paket maqro"}
            </h2>
            <p className="hint">
              {packages.length
                ? "Ubah pencarian atau reset filter untuk melihat paket lainnya."
                : "Gunakan Tambah maqro untuk memasukkan paket resmi sebelum membuka sesi cabang."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
