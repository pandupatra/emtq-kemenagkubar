import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";

const source = stripTypeScriptTypes(
  readFileSync("app/use-workspace-sync.ts", "utf8"),
)
  .replace(
    'import { useEffect, useRef } from "react";',
    'const { useEffect, useRef } = require("react");',
  )
  .replace(
    'import { supabase } from "@/lib/supabase";',
    'const { supabase } = require("@/lib/supabase");',
  )
  .replace(
    "export default function useWorkspaceSync",
    "exports.default = function useWorkspaceSync",
  );

function fixture() {
  let effect, handler, status, cleanup;
  let blocked = false;
  let now = 0,
    id = 0;
  const timers = new Map(),
    listeners = new Map(),
    batches = [];
  const document = {
    visibilityState: "visible",
    addEventListener: (n, cb) => listeners.set(n, cb),
    removeEventListener: (n) => listeners.delete(n),
  };
  const navigator = { onLine: true };
  const channel = {
    on: (_, __, cb) => {
      handler = cb;
      return channel;
    },
    subscribe: (cb) => {
      status = cb;
      return channel;
    },
  };
  const exports = {};
  let removed = false;
  vm.runInNewContext(source, {
    exports,
    document,
    navigator,
    window: {
      addEventListener: (n, cb) => listeners.set(n, cb),
      removeEventListener: (n) => listeners.delete(n),
    },
    require: (name) =>
      name === "react"
        ? {
            useRef: (current) => ({ current }),
            useEffect: (cb) => {
              effect = cb;
            },
          }
        : {
            supabase: () => ({
              channel: () => channel,
              removeChannel: async () => {
                removed = true;
              },
            }),
          },
    setTimeout: (fn, delay) => {
      const key = ++id;
      timers.set(key, { fn, at: now + delay });
      return key;
    },
    clearTimeout: (key) => timers.delete(key),
  });
  let fail = false;
  exports.default(
    { id: "district", role: "district", district: "MELAK" },
    () => blocked,
    async (tables) => {
      if (fail) throw Error("offline");
      batches.push(Array.from(tables));
    },
  );
  cleanup = effect();
  return {
    batches,
    document,
    navigator,
    listeners,
    timers,
    emit: (table) => handler({ payload: { table } }),
    status: (value) => status(value),
    block: (value) => {
      blocked = value;
    },
    fail: (value) => {
      fail = value;
    },
    cleanup: () => {
      cleanup();
      assert.equal(removed, true);
    },
    async tick(ms) {
      now += ms;
      for (const [key, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(key);
          timer.fn();
        }
      }
      for (let i = 0; i < 8; i++) await Promise.resolve();
    },
  };
}

test("Coalesce bursts and refresh only changed, permitted tables", async () => {
  const f = fixture();
  for (let i = 0; i < 50; i++) f.emit("people");
  f.emit("results");
  f.emit("packages");
  await f.tick(1500);
  assert.deepEqual(f.batches, [["people", "results"]]);
  f.cleanup();
  assert.equal(f.timers.size, 0);
});

test("Defer during editing, skip hidden/offline polling and reconcile on resume", async () => {
  const f = fixture();
  f.block(true);
  f.emit("sessions");
  await f.tick(1500);
  assert.equal(f.batches.length, 0);
  f.block(false);
  await f.tick(1500);
  assert.deepEqual(f.batches, [["sessions"]]);
  f.document.visibilityState = "hidden";
  await f.tick(60000);
  assert.equal(f.batches.length, 1);
  f.document.visibilityState = "visible";
  f.listeners.get("visibilitychange")();
  await f.tick(1500);
  assert.equal(f.batches.length, 2);
  f.cleanup();
});

test("Retry failed reads with backoff, and reconcile district profile changes", async () => {
  const f = fixture();
  f.fail(true);
  f.emit("people");
  await f.tick(1500);
  f.fail(false);
  await f.tick(1500);
  assert.equal(f.batches.length, 0);
  await f.tick(2500);
  assert.deepEqual(f.batches, [["people"]]);
  f.emit("profiles");
  await f.tick(1500);
  assert.deepEqual(f.batches[1], [
    "categories",
    "people",
    "sessions",
    "results",
  ]);
  f.cleanup();
});

test("Connected channels avoid fallback reads; disconnected channels recover by polling", async () => {
  const f = fixture();
  f.status("SUBSCRIBED");
  await f.tick(1500);
  await f.tick(60000);
  assert.equal(f.batches.length, 1);
  f.status("CHANNEL_ERROR");
  await f.tick(60000);
  await f.tick(1500);
  assert.equal(f.batches.length, 2);
  f.cleanup();
});
