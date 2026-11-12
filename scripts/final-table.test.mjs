import assert from "node:assert/strict";
import test from "node:test";
import { filterFinalParticipants } from "../lib/final-round.ts";

const p = (id, name, number, gender, district, start = null, end = null) => ({
  id,
  name,
  participant_number: number,
  gender,
  district,
  entries: ["c"],
  session_starts_at: start,
  session_ends_at: end,
});
const data = {
  categories: [
    { id: "c", name: "Tartil" },
    { id: "other", name: "Tilawah" },
  ],
  people: [
    p(
      "a",
      "Zahra",
      "010",
      "Putri",
      "MELAK",
      "2030-01-02T00:00:00Z",
      "2030-01-02T01:00:00Z",
    ),
    p("b", "Ahmad", "02", "Putra", "DAMAI"),
    p(
      "c",
      "Budi",
      "001",
      "Putra",
      "MELAK",
      "2020-01-01T00:00:00Z",
      "2020-01-01T01:00:00Z",
    ),
    p("d", "Dina", "011", "Putri", "MELAK"),
  ],
  results: [
    { person_id: "a", category: "Tartil", cancelled: false },
    { person_id: "b", category: "Tartil", cancelled: true },
    { person_id: "c", category: "Tilawah", cancelled: false },
  ],
};
const defaults = {
  query: "",
  category: "",
  district: "",
  gender: "",
  status: "",
  sort: "name-asc",
};
const select = (filter = {}) =>
  filterFinalParticipants(
    data,
    { ...defaults, ...filter },
    (p) => `TQ.T-${p.participant_number}`,
  ).map((p) => p.id);

test("Final filters combine search, branch, district, gender, and active draw status", () => {
  assert.deepEqual(
    select({
      district: "MELAK",
      gender: "Putri",
      category: "c",
      status: "drawn",
    }),
    ["a"],
  );
  assert.deepEqual(select({ query: " tq.t-010 " }), ["a"]);
  assert.deepEqual(select({ query: "damai" }), ["b"]);
  assert.deepEqual(select({ status: "not-drawn" }), ["b", "c", "d"]);
  assert.deepEqual(select({ category: "other" }), []);
  assert.deepEqual(select({ status: "scheduled" }), ["c", "a"]);
});
test("Final sorts numbers numerically and keeps missing schedules last in both directions", () => {
  assert.deepEqual(select({ sort: "name-desc" }), ["a", "d", "c", "b"]);
  assert.deepEqual(select({ sort: "number-asc" }), ["c", "b", "a", "d"]);
  assert.deepEqual(select({ sort: "number-desc" }), ["d", "a", "b", "c"]);
  assert.deepEqual(select({ sort: "session-asc" }), ["c", "a", "b", "d"]);
  assert.deepEqual(select({ sort: "session-desc" }), ["a", "c", "b", "d"]);
  assert.deepEqual(
    data.people.map((p) => p.id),
    ["a", "b", "c", "d"],
  );
});
test("Final filtering searches all rows before pagination and reset restores the default order", () => {
  const people = Array.from({ length: 60 }, (_, i) =>
    p(String(i), `Peserta ${i}`, String(i), "Putra", "MELAK"),
  );
  const rows = { ...data, people, results: [] };
  assert.deepEqual(
    filterFinalParticipants(
      rows,
      { ...defaults, query: "Peserta 59" },
      (p) => p.participant_number,
    ).map((p) => p.id),
    ["59"],
  );
  assert.deepEqual(select(), ["b", "c", "d", "a"]);
  assert.equal(
    filterFinalParticipants(
      { ...data, people: [] },
      defaults,
      (p) => p.participant_number,
    ).length,
    0,
  );
});
