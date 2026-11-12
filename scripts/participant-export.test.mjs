import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import { finalPeople, finalExportData } from "../lib/final-round.ts";

const require = createRequire(import.meta.url);
const source = await readFile(
  new URL("../lib/participant-export.ts", import.meta.url),
  "utf8",
);
const compiled = stripTypeScriptTypes(source)
  .replace(
    '"./competition-codes"',
    JSON.stringify(
      new URL("../lib/competition-codes.ts", import.meta.url).href,
    ),
  )
  .replace(
    '"exceljs"',
    JSON.stringify(pathToFileURL(require.resolve("exceljs")).href),
  );
const { participantWorkbookBuffer } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("XLSX round-trip preserves identity and exports only scoped active draws", async () => {
  const person = {
    id: "p1",
    participant_number: "001",
    name: "=SUM(1,2)",
    district: "Melak",
    gender: "L",
    birth: "2000-01-02",
    entries: ["c1"],
  };
  const result = {
    id: "r1",
    person_id: "p1",
    category: "Tartil",
    surah: "Al-Fatihah",
    verses: "1-7",
    created_at: "2026-11-11T00:00:00Z",
    cancelled: false,
  };
  const buffer = await participantWorkbookBuffer({
    people: [
      person,
      { ...person, id: "p2", name: "Belum undi", participant_number: "002" },
    ],
    categories: [{ id: "c1", name: "Tartil" }],
    results: [
      result,
      { ...result, id: "cancelled", person_id: "p2", cancelled: true },
      { ...result, id: "outside", person_id: "outside" },
    ],
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const people = workbook.getWorksheet("Peserta");
  assert.equal(workbook.worksheets.length, 1);
  assert.ok(!people.getRow(1).values.includes("Nomor bukti"));
  assert.equal(people.rowCount, 3);
  assert.equal(people.getCell("A2").value, "TQ.T-001");
  assert.equal(people.getCell("B2").value, "=SUM(1,2)");
  assert.equal(people.getCell("B2").type, ExcelJS.ValueType.String);
  assert.equal(people.getCell("G3").value, "Belum diundi");
  assert.ok(!people.getCell("H3").value);
  assert.ok(!people.getCell("I3").value);
  assert.equal(people.getCell("H2").value, "Al-Fatihah");
  assert.equal(people.getCell("I2").value, "1-7");
  assert.match(people.getCell("J2").value, /08[.:]00.*WITA/);
});

test("Empty results still produce a workbook with participants and headers", async () => {
  const buffer = await participantWorkbookBuffer({
    people: [],
    categories: [],
    results: [],
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.equal(workbook.worksheets.length, 1);
  assert.equal(workbook.getWorksheet("Peserta").rowCount, 1);
});

test("Final data uses its own schedule and exports only finalists with a round label", async () => {
  const person = {
    id: "p1",
    name: "Finalis",
    district: "Melak",
    gender: "Putra",
    birth: "2000-01-01",
    participant_number: "001",
    entries: ["c1"],
    session_open: true,
    session_starts_at: "2030-01-01T00:00:00Z",
    session_ends_at: "2030-01-01T01:00:00Z",
  };
  const finalist = {
    id: "p1",
    category_id: "c1",
    session_open: false,
    session_starts_at: null,
    session_ends_at: null,
  };
  const base = {
    people: [person, { ...person, id: "p2", name: "Bukan finalis" }],
    categories: [{ id: "c1", name: "Tartil" }],
    results: [{ person_id: "p1", surah: "Penyisihan" }],
  };
  const final = {
    final_participants: [finalist],
    final_sessions: [],
    final_packages: [],
    final_results: [],
  };
  assert.equal(
    finalPeople(base.people, final.final_participants)[0].session_open,
    false,
  );
  assert.equal(
    finalPeople(base.people, final.final_participants)[0].session_starts_at,
    null,
  );
  assert.equal(person.session_open, true);
  const data = finalExportData(base, final);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await participantWorkbookBuffer(data, "Final"));
  const sheet = book.getWorksheet("Peserta");
  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.getCell("K1").value, "Babak");
  assert.equal(sheet.getCell("K2").value, "Final");
  assert.equal(sheet.getCell("G2").value, "Belum diundi");
  assert.ok(!sheet.getCell("H2").value);
});
