"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Data } from "@/lib/types";

export type SyncTable =
  | "categories"
  | "people"
  | "sessions"
  | "results"
  | "profiles"
  | "packages"
  | "final_participants"
  | "final_sessions"
  | "final_packages"
  | "final_results";

export default function useWorkspaceSync(
  profile: Data["profile"] | undefined,
  blocked: () => boolean,
  refresh: (tables: SyncTable[], valid: () => boolean) => Promise<void>,
  final = false,
) {
  const latest = useRef({ blocked, refresh });
  latest.current = { blocked, refresh };
  useEffect(() => {
    if (!profile) return;
    const db = supabase();
    const tables: SyncTable[] = final
      ? [
          "final_participants",
          "final_sessions",
          "final_results",
          ...(profile.role === "admin" ? ["final_packages" as const] : []),
        ]
      : [
          "categories",
          "people",
          "sessions",
          "results",
          ...(profile.role === "admin"
            ? (["profiles", "packages"] as SyncTable[])
            : []),
        ];
    const pending = new Set<SyncTable>();
    let disposed = false,
      running = false,
      connected = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fallback: ReturnType<typeof setTimeout>;
    const visible = () =>
      document.visibilityState === "visible" && navigator.onLine;
    const flush = async () => {
      timer = undefined;
      if (disposed || !visible() || running || !pending.size) return;
      if (latest.current.blocked()) {
        schedule();
        return;
      }
      running = true;
      const batch = [...pending];
      pending.clear();
      try {
        await latest.current.refresh(
          batch,
          () => !disposed && !latest.current.blocked(),
        );
        failures = 0;
      } catch {
        batch.forEach((t) => pending.add(t));
        failures = Math.min(failures + 1, 5);
      } finally {
        running = false;
        if (pending.size) schedule();
      }
    };
    const schedule = () => {
      if (!disposed && !timer)
        timer = setTimeout(
          () => void flush(),
          failures ? Math.min(60000, 2000 * 2 ** failures) : 1500,
        );
    };
    const reconcile = () => {
      tables.forEach((t) => pending.add(t));
      schedule();
    };
    const channel = final
      ? undefined
      : db
          .channel(
            profile.role === "admin"
              ? "workspace:admin"
              : `workspace:district:${profile.district}`,
            { config: { private: true } },
          )
          .on("broadcast", { event: "changed" }, ({ payload }) => {
            if (String(payload.table).startsWith("final_")) {
              window.dispatchEvent(new Event("maqro-final-changed"));
              return;
            }
            if (payload.table === "profiles") {
              reconcile();
              return;
            }
            if (tables.includes(payload.table)) {
              pending.add(payload.table);
              schedule();
            }
          })
          .subscribe((status) => {
            connected = status === "SUBSCRIBED";
            if (connected) reconcile();
          });
    const poll = () => {
      fallback = setTimeout(
        () => {
          if (!connected && visible()) reconcile();
          poll();
        },
        45000 + Math.random() * 15000,
      );
    };
    poll();
    if (final) {
      window.addEventListener("maqro-final-changed", reconcile);
      reconcile();
    }
    // Reconcile missed events after returning from sleep, a hidden tab, or offline.
    const resume = () => {
      if (visible()) reconcile();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(fallback);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      if (final) window.removeEventListener("maqro-final-changed", reconcile);
      if (channel) void db.removeChannel(channel);
    };
  }, [profile?.id, profile?.role, profile?.district, final]);
}
