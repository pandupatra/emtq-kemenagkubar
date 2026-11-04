import assert from "node:assert/strict";
import test from "node:test";
import {
  competitionCode,
  participantNumber,
} from "../lib/competition-codes.ts";

test("all 21 workbook branches map to their official codes", () => {
  const names = [
    "Tartil",
    "Tilawah Anak-Anak",
    "Tilawah Remaja",
    "Tilawah Dewasa",
    "Qiro'at Murottal Remaja",
    "Qiro'at Murottal Dewasa",
    "Qiro'at Mujawwad Remaja",
    "Qiro'at Mujawwad Dewasa",
    "Tahfidz 1 Juz",
    "Tahfidz 5 Juz",
    "Tahfidz 10 Juz",
    "Tahfidz 20 Juz",
    "Tahfidz 30 Juz",
    "Fahmil",
    "Syarhil",
    "Naskah",
    "Hiasan Mushaf",
    "Dekorasi",
    "Kontemporer",
    "Kaligrafi Digital",
    "KTIQ (Makalah Hadits)",
  ];
  assert.deepEqual(names.map(competitionCode), [
    "TQ.T",
    "TQ.A",
    "TQ.R",
    "TQ.D",
    "Q.ML.R",
    "Q.ML.D",
    "Q.MD.R",
    "Q.MD.D",
    "HQ.1",
    "HQ.5",
    "HQ.10",
    "HQ.20",
    "HQ.30",
    "FQ",
    "SY.Q",
    "KQ.N",
    "KQ.H",
    "KQ.D",
    "KQ.K",
    "KQ.DL",
    "MH",
  ]);
});

test("existing app names and manual numbers retain their meaning", () => {
  assert.equal(participantNumber("01", "Tilawah Anak"), "TQ.A-01");
  assert.equal(participantNumber("01", "1 Juz dan Tilawah"), "HQ.1-01");
  assert.equal(participantNumber("01", "Qira'at Murattal Remaja"), "Q.ML.R-01");
  assert.equal(participantNumber("01", "Syarhil Qur'an"), "SY.Q-01");
  assert.equal(participantNumber("TQ.A-01", "Tilawah Anak"), "TQ.A-01");
  assert.equal(participantNumber("TQ.A-01", "Tilawah Remaja"), "TQ.R-01");
  assert.equal(participantNumber(null, "Tilawah Anak"), "—");
  assert.equal(participantNumber("  ", "Tilawah Anak"), "—");
  assert.equal(participantNumber("07", "Cabang baru"), "07");
});
