import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";

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
