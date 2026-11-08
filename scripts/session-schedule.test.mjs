import assert from "node:assert/strict";
import test from "node:test";
import {
  participantSessionOpen,
  participantSessionLabel,
} from "../lib/participant-session.ts";

test("manual access remains compatible", () => {
  assert.equal(participantSessionOpen({ session_open: true }), true);
  assert.equal(participantSessionOpen({ session_open: false }), false);
});
test("schedule overrides manual flag and uses inclusive start and exclusive end", () => {
  const person = {
    session_open: false,
    session_starts_at: "2026-11-07T08:00:00+08:00",
    session_ends_at: "2026-11-08T01:00:00+08:00",
  };
  const start = Date.parse(person.session_starts_at),
    end = Date.parse(person.session_ends_at);
  assert.equal(participantSessionOpen(person, start - 1), false);
  assert.equal(participantSessionOpen(person, start), true);
  assert.equal(participantSessionOpen(person, end - 1), true);
  assert.equal(
    participantSessionOpen({ ...person, session_open: true }, end),
    false,
  );
  assert.match(participantSessionLabel(person, start - 1), /Terjadwal.*WITA/);
  assert.match(
    participantSessionLabel(person, start),
    /Dibuka.*Berakhir.*WITA/,
  );
  assert.match(participantSessionLabel(person, end), /Jadwal berakhir/);
});
test("incomplete ranges fail closed", () => {
  assert.equal(
    participantSessionOpen({
      session_open: true,
      session_starts_at: "2026-11-07T00:00:00Z",
    }),
    false,
  );
});
