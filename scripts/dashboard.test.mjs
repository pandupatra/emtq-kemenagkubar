import assert from "node:assert/strict";
import test from "node:test";
import { summarizeParticipants } from "../lib/dashboard.ts";

const data = {
  categories: [
    { id: "a", name: "Tilawah" },
    { id: "b", name: "Tartil" },
  ],
  profiles: [
    { role: "district", district: "MELAK" },
    { role: "district", district: "BARONG TONGKOK" },
  ],
  people: [
    { id: "1", district: "MELAK", entries: ["a", "b"] },
    { id: "2", district: "MELAK", entries: ["a"] },
    { id: "3", district: "SEKOLAQ DARAT", entries: ["b"] },
  ],
  results: [
    { person_id: "1", category: "Tilawah", cancelled: false },
    { person_id: "1", category: "Tartil", cancelled: false },
    { person_id: "2", category: "Tilawah", cancelled: true },
    { person_id: "3", category: "Old category", cancelled: false },
    { person_id: "deleted", category: "Tilawah", cancelled: false },
  ],
};

test("Count participants once, excluding cancelled and unrelated results", () => {
  const summary = summarizeParticipants(data);
  assert.equal(summary.total, 3);
  assert.equal(summary.drawn, 1);
  assert.equal(summary.remaining, 2);
  assert.equal(
    summary.districts.reduce((sum, row) => sum + row.total, 0),
    summary.total,
  );
  assert.equal(
    summary.districts.reduce((sum, row) => sum + row.drawn, 0),
    summary.drawn,
  );
  assert.equal(
    summary.districts.reduce((sum, row) => sum + row.remaining, 0),
    summary.remaining,
  );
});

test("Include empty district accounts and participants without a district account", () => {
  const { districts } = summarizeParticipants(data);
  assert.deepEqual(
    districts.map((row) => row.district),
    ["BARONG TONGKOK", "MELAK", "SEKOLAQ DARAT"],
  );
  assert.equal(districts[0].total, 0);
  assert.equal(districts[1].remaining, 1);
});

test("Handle empty data and a completed draw", () => {
  assert.equal(
    summarizeParticipants({ ...data, people: [], results: [] }).total,
    0,
  );
  assert.equal(
    summarizeParticipants({ ...data, people: [], profiles: [], results: [] })
      .districts.length,
    0,
  );
  assert.equal(summarizeParticipants({ ...data, results: [] }).remaining, 3);
  const summary = summarizeParticipants({ ...data, people: [data.people[0]] });
  assert.equal(summary.drawn, 1);
  assert.equal(summary.remaining, 0);
});
