import type { Result } from "@/lib/types";

export default function ParticipantResults({
  results,
  onView,
  onCancel,
  busy,
}: {
  results: Result[];
  onView: (result: Result) => void;
  onCancel?: (result: Result) => void;
  busy: boolean;
}) {
  if (!results.length)
    return <span className="muted">Belum ada hasil undian</span>;
  const active = results.filter((r) => !r.cancelled);
  const cancelled = results.filter((r) => r.cancelled);
  const entry = (r: Result) => (
    <div className="participant-result" key={r.id} aria-busy={busy}>
      <div>
        <strong>{r.category}</strong>
        <small>
          {r.code} · {r.surah} · {r.verses}
        </small>
        {r.cancelled ? (
          <>
            <span className="status bad">Dibatalkan</span>
            <small>Alasan: {r.reason}</small>
          </>
        ) : (
          <span className="status">Sudah diundi</span>
        )}
      </div>
      <div className="actions">
        <button
          className="btn"
          disabled={busy}
          onClick={() => onView(r)}
          aria-label={`Bukti ${r.category}, ${r.name}`}
        >
          Bukti hasil
        </button>
        {onCancel && !r.cancelled ? (
          <button
            className="btn danger"
            disabled={busy}
            onClick={() => onCancel(r)}
            aria-label={`Batalkan hasil ${r.category}, ${r.name}`}
          >
            Batalkan
          </button>
        ) : null}
      </div>
    </div>
  );
  return (
    <div className="participant-results">
      {active.length ? (
        active.map(entry)
      ) : (
        <span className="muted">Belum ada hasil undian aktif</span>
      )}
      {cancelled.length ? (
        <details className="result-history">
          <summary>Riwayat pembatalan ({cancelled.length})</summary>
          {cancelled.map(entry)}
        </details>
      ) : null}
    </div>
  );
}
