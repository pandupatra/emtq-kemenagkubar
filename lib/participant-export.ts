import ExcelJS from "exceljs";
import { participantNumber } from "./competition-codes";
import type { Data } from "./types";

const drawTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  }).format(new Date(value)) + " WITA";

export function createParticipantWorkbook(data: Data) {
  const workbook = new ExcelJS.Workbook();
  const people = new Map(data.people.map((person) => [person.id, person]));
  const categories = new Map(
    data.categories.map((category) => [category.id, category.name]),
  );
  const results = data.results.filter(
    (result) => !result.cancelled && people.has(result.person_id),
  );
  const participants = workbook.addWorksheet("Peserta");
  participants.columns = [
    { header: "No. peserta", width: 24 },
    { header: "Nama peserta", width: 32 },
    { header: "Kecamatan", width: 24 },
    { header: "Jenis kelamin", width: 18 },
    { header: "Tanggal lahir", width: 18 },
    { header: "Cabang", width: 38 },
    { header: "Status undian", width: 22 },
    { header: "Surah / materi", width: 40 },
    { header: "Ayat / rentang materi", width: 32 },
    { header: "Waktu undian (WITA)", width: 30 },
  ];
  for (const person of data.people) {
    const names = person.entries.map((id) => categories.get(id) ?? id);
    const personResults = results.filter(
      (result) => result.person_id === person.id,
    );
    for (const result of personResults.length ? personResults : [null]) {
      participants.addRow([
        result
          ? participantNumber(person.participant_number, result.category)
          : names
              .map((name) => participantNumber(person.participant_number, name))
              .join("; ") ||
            person.participant_number ||
            "",
        person.name,
        person.district,
        person.gender,
        person.birth,
        result?.category ?? names.join("; "),
        result ? "Sudah diundi" : "Belum diundi",
        result?.surah ?? "",
        result?.verses ?? "",
        result ? drawTime(result.created_at) : "",
      ]);
    }
  }
  for (const sheet of workbook.worksheets) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sheet.rowCount, column: sheet.columnCount },
    };
    sheet.eachRow((row, index) => {
      row.alignment = { vertical: "top", wrapText: true };
      if (index === 1) {
        row.font = { bold: true, color: { argb: "FFFFFFFF" } };
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF245843" },
        };
        row.height = 30;
      } else {
        row.eachCell((cell) => {
          cell.numFmt = "@";
        });
      }
    });
  }
  return workbook;
}

export async function participantWorkbookBuffer(data: Data) {
  return createParticipantWorkbook(data).xlsx.writeBuffer();
}
