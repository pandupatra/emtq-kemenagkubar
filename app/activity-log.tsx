"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Log } from "@/lib/types";
import { PageControls } from "./data-table";

type LogPage = { rows: Log[]; count: number };
const time = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Makassar",
  dateStyle: "medium",
  timeStyle: "short",
});

export default function ActivityLog({
  active,
  revision,
}: {
  active: boolean;
  revision: object;
}) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [result, setResult] = useState<LogPage>({ rows: [], count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const cache = useMemo(() => new Map<string, LogPage>(), [revision]);

  useEffect(() => {
    if (!active) return;
    let current = true;
    const key = `${page}:${size}`;
    const cached = cache.get(key);
    setError("");
    if (cached) {
      setResult(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    async function load() {
      try {
        const { data, error, count } = await supabase()
          .from("logs")
          .select("id,message,created_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(page * size, (page + 1) * size - 1);
        if (!current) return;
        if (error) throw error;
        const total = count ?? 0;
        const last = Math.max(0, Math.ceil(total / size) - 1);
        if (page > last) {
          setPage(last);
          return;
        }
        const next = { rows: data as Log[], count: total };
        cache.set(key, next);
        setResult(next);
      } catch {
        if (current) setError("Catatan aktivitas gagal dimuat. Coba lagi.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [active, page, size, cache, retry]);

  return (
    <section className="panel" hidden={!active} aria-busy={loading}>
      <h2>Catatan aktivitas</h2>
      {error ? (
        <div className="error" role="alert">
          {error}{" "}
          <button
            type="button"
            className="btn"
            onClick={() => setRetry((value) => value + 1)}
          >
            Coba lagi
          </button>
        </div>
      ) : loading ? (
        <p role="status">Memuat catatan aktivitas…</p>
      ) : result.rows.length ? (
        result.rows.map((log) => (
          <div className="log-item" key={log.id}>
            {log.message}
            <small>{time.format(new Date(log.created_at))} WITA</small>
          </div>
        ))
      ) : (
        <div className="empty">
          <h3>Belum ada perubahan</h3>
          <p>
            Perubahan peserta, pengaturan sesi, dan hasil undian akan tercatat
            setelah dilakukan.
          </p>
        </div>
      )}
      <PageControls
        count={result.count}
        page={page}
        size={size}
        disabled={loading || !!error}
        onPage={setPage}
        onSize={(value) => {
          setPage(0);
          setSize(value);
        }}
      />
    </section>
  );
}
