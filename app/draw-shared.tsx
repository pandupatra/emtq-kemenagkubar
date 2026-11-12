"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, type ReactNode } from "react";
import type { Person, Result } from "@/lib/types";
import { participantNumber } from "@/lib/competition-codes";
import ActionIcon from "./action-icon";
const date = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  }).format(new Date(value)) + " WITA";
const Badge = ({ children }: { children: ReactNode }) => (
  <span className="status">{children}</span>
);
export function Modal({
  title,
  children,
  close,
  busy,
  className,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={className}
      aria-labelledby="dialog-title"
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="btn icon-btn"
          onClick={close}
          disabled={busy}
          aria-label="Tutup dialog"
          title="Tutup dialog"
        >
          <ActionIcon name="close" />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}

export function Receipt({
  result: r,
  person,
  round = "Penyisihan",
}: {
  result: Result;
  person?: Person;
  round?: "Penyisihan" | "Final";
}) {
  return (
    <article className="receipt">
      <div className="receipt-head">
        <div>
          <div className="wordmark">e-Maqro LPTQ Kubar</div>
          <h2>Bukti hasil undian / {round}</h2>
          <p>MTQ Kabupaten Kutai Barat</p>
        </div>
        <Badge>{r.cancelled ? "Dibatalkan" : "Tersimpan"}</Badge>
      </div>
      <dl className="review">
        <div>
          <dt>Babak</dt>
          <dd>{round}</dd>
        </div>
        <div>
          <dt>Nama peserta</dt>
          <dd>{r.name}</dd>
        </div>
        <div>
          <dt>No. peserta</dt>
          <dd>{participantNumber(person?.participant_number, r.category)}</dd>
        </div>
        <div>
          <dt>Kafilah</dt>
          <dd>
            {r.district} · {r.gender}
          </dd>
        </div>
        <div>
          <dt>Cabang</dt>
          <dd>{r.category}</dd>
        </div>
        <div>
          <dt>Waktu undian</dt>
          <dd>{date(r.created_at)}</dd>
        </div>
      </dl>
      <div className="maqro-result">
        <p>Hasil maqro</p>
        <h2>{r.surah}</h2>
        <p>Ayat / rentang materi: {r.verses}</p>
      </div>
      {r.cancelled ? (
        <div className="notice warn">Alasan pembatalan: {r.reason}</div>
      ) : null}
      <p className="receipt-foot">
        Nomor bukti: {r.id}
        <br />
        Hasil ditetapkan dan disimpan oleh sistem saat undian dilakukan.
      </p>
    </article>
  );
}
