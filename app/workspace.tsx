"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Data, Person, Result, Session } from "@/lib/types";
import { LoginSkeleton, WorkspaceSkeleton } from "./skeletons";
import Brand from "./brand";
import ActionIcon from "./action-icon";
import ParticipantResults from "./participant-results";
import DrawPicker from "./draw-picker";
import WorkSummary from "./work-summary";
import { useInitialPageReady } from "./initial-page-loader";

const titles: Record<string, string> = {
  dashboard: "Ringkasan kerja",
  people: "Daftar peserta",
  sessions: "Cabang & sesi",
  bank: "Bank maqro",
  accounts: "Akun kecamatan",
  draw: "Undian maqro",
  logs: "Catatan aktivitas",
};
const descriptions: Record<string, string> = {
  people:
    "Data peserta, cabang perlombaan, dan hasil undian dalam satu daftar.",
  sessions: "Atur akses undian setiap cabang perlombaan.",
  bank: "Kelola paket maqro berdasarkan cabang perlombaan.",
  accounts: "Satu kecamatan memiliki satu akun pengelola kafilah.",
  draw: "Pastikan identitas peserta sebelum menetapkan maqro.",
  logs: "Perubahan data dan keputusan panitia yang tercatat.",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  }).format(new Date(value)) + " WITA";
const formValues = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return new FormData(event.currentTarget);
};
const text = (f: FormData, key: string) => String(f.get(key) || "").trim();
type MutationAction =
  | "person"
  | "delete-person"
  | "session"
  | "package"
  | "account"
  | "draw"
  | "cancel";
type MutableCollection =
  "people" | "sessions" | "packages" | "profiles" | "results";
type PendingChange = {
  action: MutationAction;
  id?: string;
  categoryId?: string;
};
async function readTable(db: ReturnType<typeof supabase>, name: string) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from(name)
      .select("*")
      .order(
        name === "logs" || name === "results"
          ? "created_at"
          : name === "categories"
            ? "name"
            : "id",
        { ascending: name !== "logs" && name !== "results" },
      )
      .order("id")
      .range(offset, offset + 499);
    if (error)
      throw new Error(
        "Data ruang kerja gagal dimuat. Periksa koneksi lalu coba lagi.",
      );
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className={`status ${children === "Ditutup" ? "warn" : children === "Dibatalkan" ? "bad" : ""}`}
    >
      {children}
    </span>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Field({
  label,
  name,
  type = "text",
  value = "",
  required = true,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  required?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </label>
      {children || (
        <input
          id={name}
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          maxLength={type === "password" ? 128 : 250}
          autoComplete={type === "password" ? "new-password" : "off"}
        />
      )}
    </div>
  );
}

function Modal({
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
  return (
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
    </dialog>
  );
}

function Receipt({ result: r }: { result: Result }) {
  return (
    <article className="receipt">
      <div className="receipt-head">
        <div>
          <div className="wordmark">e-MTQ LPTQ Kubar</div>
          <h2>Bukti hasil undian</h2>
          <p>MTQ Kabupaten Kutai Barat</p>
        </div>
        <Badge>{r.cancelled ? "Dibatalkan" : "Tersimpan"}</Badge>
      </div>
      <dl className="review">
        <div>
          <dt>Nama peserta</dt>
          <dd>{r.name}</dd>
        </div>
        <div>
          <dt>ID peserta</dt>
          <dd className="identifier">{r.person_id}</dd>
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
        <div className="package-code">{r.code}</div>
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

export default function Workspace({ configured }: { configured: boolean }) {
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(configured),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  useInitialPageReady(!loading);
  const [page, setPage] = useState("dashboard"),
    [menu, setMenu] = useState(false),
    [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [peopleDistrict, setPeopleDistrict] = useState("");
  const [peopleCategory, setPeopleCategory] = useState("");
  const [peopleGender, setPeopleGender] = useState("");
  const [peopleDrawStatus, setPeopleDrawStatus] = useState("");
  const [peopleSort, setPeopleSort] = useState("name-asc");
  const resetPeopleFilters = () => {
    setQuery("");
    setPeopleDistrict("");
    setPeopleCategory("");
    setPeopleGender("");
    setPeopleDrawStatus("");
    setPeopleSort("name-asc");
  };
  const menuPanel = useRef<HTMLElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const panel = menuPanel.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href]",
        ) ?? [],
      );
    controls()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1120px)");
    const onResize = () => {
      if (desktop.matches) setMenu(false);
    };
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onResize);
      menuTrigger.current?.focus();
    };
  }, [menu]);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(
    null,
  );
  const [openingSessions, setOpeningSessions] = useState<string[]>([]);
  const [modal, setModal] = useState<{
    kind: string;
    person?: Person;
    id?: string;
    result?: Result;
  } | null>(null);
  const [selection, setSelection] = useState<{
      person: Person;
      session: Session;
    } | null>(null),
    [drawStep, setDrawStep] = useState(1),
    [drawResult, setDrawResult] = useState<Result | null>(null);
  const request = useRef(0),
    mutation = useRef(false);
  const admin = data?.profile.role === "admin";
  const pages = admin
    ? ["dashboard", "people", "sessions", "bank", "accounts", "logs"]
    : ["people", "draw"];
  const category = (id: string) =>
    data?.categories.find((c) => c.id === id)?.name || "Cabang tidak tersedia";
  const updating = (action: MutationAction, id: string) =>
    (pendingChange?.action === action && pendingChange.id === id) ||
    (action === "session" && openingSessions.includes(id));
  const readySessions =
    data?.sessions.filter(
      (s) =>
        !s.open && data.packages.some((p) => p.category_id === s.category_id),
    ) || [];
  const blockedSessions =
    data?.sessions.filter(
      (s) =>
        !s.open && !data.packages.some((p) => p.category_id === s.category_id),
    ) || [];
  const close = () => {
    if (!mutation.current) {
      setModal(null);
      setError("");
    }
  };
  const load = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    setError("");
    try {
      const db = supabase();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (version !== request.current) return;
      if (!auth.user) {
        setData(null);
        if (authError && authError.name !== "AuthSessionMissingError")
          throw new Error("Sesi tidak dapat diperiksa. Silakan masuk kembali.");
        return;
      }
      const { data: profile, error: pe } = await db
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .single();
      if (pe || !profile?.active) {
        setData(null);
        throw new Error(
          "Akun tidak aktif atau profil belum tersedia. Hubungi panitia.",
        );
      }
      const names = [
        "categories",
        "people",
        "sessions",
        "results",
        ...(profile.role === "admin" ? ["profiles", "packages", "logs"] : []),
      ];
      const responses = await Promise.all(names.map((n) => readTable(db, n)));
      if (version !== request.current) return;
      const rows = Object.fromEntries(names.map((n, i) => [n, responses[i]]));
      if (rows.sessions.some((s) => "round" in s))
        throw new Error(
          "Jalankan migrasi 202610300004_single_session_per_category.sql di Supabase untuk mengaktifkan satu sesi per cabang.",
        );
      setPage((current) =>
        profile.role === "district" && !["people", "draw"].includes(current)
          ? "people"
          : current,
      );
      setData({
        profile,
        categories: [],
        people: [],
        sessions: [],
        results: [],
        profiles: [],
        packages: [],
        logs: [],
        ...rows,
      } as Data);
    } catch (e) {
      if (version === request.current)
        setError(e instanceof Error ? e.message : "Koneksi gagal. Coba lagi.");
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    try {
      setDark(localStorage.getItem("maqro-theme") === "dark");
    } catch {}
    if (!configured) return;
    void load();
    const {
      data: { subscription },
    } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        request.current++;
        setData(null);
        setModal(null);
        setSelection(null);
        setDrawResult(null);
        setPage("dashboard");
        setLoading(false);
      }
    });
    return () => {
      request.current++;
      subscription.unsubscribe();
    };
  }, [configured, load]);
  useEffect(() => {
    document.body.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("maqro-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(""), 6000);
    return () => clearTimeout(id);
  }, [feedback]);
  function go(next: string) {
    if (mutation.current || !pages.includes(next)) return;
    setPage(next);
    setMenu(false);
    setQuery("");
    setSelection(null);
    setDrawStep(1);
    setDrawResult(null);
    setError("");
    requestAnimationFrame(() => document.getElementById("workspace")?.focus());
    void load();
  }
  async function act(
    action: MutationAction,
    payload: Record<string, unknown>,
    message: string,
  ) {
    if (mutation.current) return null;
    mutation.current = true;
    setBusy(true);
    setPendingChange({
      action,
      id: typeof payload.id === "string" ? payload.id : undefined,
      categoryId:
        typeof payload.category_id === "string"
          ? payload.category_id
          : undefined,
    });
    setError("");
    setFeedback("");
    try {
      const { data: result, error: e } =
        action === "delete-person"
          ? await supabase().rpc("delete_participant", {
              participant_id: payload.id,
            })
          : await supabase().rpc("maqro_action", { action, payload });
      if (e) throw e;
      setModal(null);
      setFeedback(message);
      try {
        await refreshMutation(action, payload, result);
      } catch {
        setError(
          "Perubahan sudah tersimpan, tetapi data terbaru belum dapat dimuat. Gunakan Muat ulang untuk memperbarui tampilan.",
        );
      }
      return result;
    } catch (e) {
      const msg = (e as { message?: string }).message || "";
      setError(
        /duplicate key/.test(msg)
          ? "Data yang sama sudah tersimpan. Muat ulang halaman lalu coba lagi."
          : /constraint|invalid input|not-null/.test(msg)
            ? "Data belum sesuai. Periksa kolom wajib, tanggal, dan pilihan cabang."
            : msg ||
              "Perubahan gagal disimpan. Periksa koneksi lalu coba lagi.",
      );
      return null;
    } finally {
      mutation.current = false;
      setBusy(false);
      setPendingChange(null);
    }
  }
  async function refreshMutation(
    action: MutationAction,
    payload: Record<string, unknown>,
    result: unknown,
  ) {
    if (action === "delete-person") {
      setData((current) =>
        current
          ? {
              ...current,
              people: current.people.filter(
                (person) => person.id !== payload.id,
              ),
            }
          : current,
      );
      return;
    }
    const collection: MutableCollection = {
      person: "people",
      session: "sessions",
      package: "packages",
      account: "profiles",
      draw: "results",
      cancel: "results",
    }[action] as MutableCollection;
    const owner = data?.profile.id;
    if (!owner) return;
    let rows: { id: string }[];
    let replace = false;
    if (
      (action === "package" || action === "draw") &&
      result &&
      typeof result === "object" &&
      "id" in result &&
      typeof result.id === "string"
    ) {
      rows = [result as { id: string }];
    } else if (typeof payload.id === "string" && payload.id) {
      const { data: row, error: refreshError } = await supabase()
        .from(collection)
        .select("*")
        .eq("id", payload.id)
        .single();
      if (refreshError) throw refreshError;
      rows = [row];
    } else {
      rows = await readTable(supabase(), collection);
      replace = true;
    }
    setData((current) => {
      if (!current || current.profile.id !== owner) return current;
      const previous = current[collection] as { id: string }[];
      const existing = new Map(previous.map((row) => [row.id, row]));
      const changed = new Map(
        rows.map((row) => {
          const old = existing.get(row.id);
          return [
            row.id,
            old && JSON.stringify(old) === JSON.stringify(row) ? old : row,
          ];
        }),
      );
      const additions = rows.filter((row) => !existing.has(row.id));
      const updated = previous.map((row) => changed.get(row.id) || row);
      const next = replace
        ? rows.map((row) => changed.get(row.id)!)
        : collection === "results"
          ? [...additions, ...updated]
          : [...updated, ...additions];
      return { ...current, [collection]: next } as Data;
    });
  }
  async function openAllSessions() {
    if (mutation.current || !admin || !readySessions.length) return;
    const targets = readySessions;
    mutation.current = true;
    setBusy(true);
    setOpeningSessions(targets.map((s) => s.id));
    setModal(null);
    setError("");
    try {
      const outcomes = await Promise.allSettled(
        targets.map(async (s) => {
          const { error: saveError } = await supabase().rpc("maqro_action", {
            action: "session",
            payload: { id: s.id, open: true, repeat: false },
          });
          if (saveError) throw saveError;
          try {
            await refreshMutation("session", { id: s.id }, {});
            return true;
          } catch {
            return false;
          }
        }),
      );
      const opened = outcomes.filter((o) => o.status === "fulfilled").length;
      const failed = targets.filter(
        (_, i) => outcomes[i].status === "rejected",
      );
      const stale = outcomes.some((o) => o.status === "fulfilled" && !o.value);
      setFeedback(
        `${opened} sesi berhasil dibuka.${blockedSessions.length ? ` ${blockedSessions.length} sesi tanpa paket tetap ditutup.` : ""}`,
      );
      const messages: string[] = [];
      if (failed.length)
        messages.push(
          `${failed.length} sesi belum berhasil dibuka: ${failed.map((s) => category(s.category_id)).join(", ")}. Coba kembali setelah memeriksa koneksi dan ketersediaan paket.`,
        );
      if (stale)
        messages.push(
          "Sebagian sesi sudah dibuka, tetapi data terbarunya belum dapat dimuat. Gunakan Muat ulang untuk memperbarui tampilan.",
        );
      if (messages.length) setError(messages.join(" "));
    } finally {
      mutation.current = false;
      setOpeningSessions([]);
      setBusy(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    const f = formValues(e);
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      const username = text(f, "username").toLowerCase();
      if (!/^[a-z0-9-]+$/.test(username))
        throw new Error("Gunakan nama pengguna yang diberikan panitia.");
      const { error: e } = await supabase().auth.signInWithPassword({
        email: `${username}@accounts.maqro.invalid`,
        password: String(f.get("password")),
      });
      if (e)
        throw new Error(
          e.code === "invalid_credentials"
            ? "Nama pengguna atau kata sandi tidak sesuai. Periksa kembali isian Anda."
            : "Tidak dapat masuk. Coba lagi. Jika tetap gagal, hubungi panitia.",
        );
      setPage("dashboard");
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Tidak dapat masuk. Coba lagi.",
      );
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    if (mutation.current) return;
    setBusy(true);
    try {
      const { error: e } = await supabase().auth.signOut();
      if (e) throw e;
      setError("");
    } catch {
      setError("Gagal keluar. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  async function password(e: FormEvent<HTMLFormElement>) {
    const f = formValues(e);
    if (mutation.current) return;
    const next = String(f.get("password"));
    if (next !== String(f.get("confirm"))) {
      setError("Konfirmasi kata sandi belum sama.");
      return;
    }
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      const db = supabase();
      const { data: u, error: ue } = await db.auth.getUser();
      if (ue || !u.user?.email)
        throw new Error("Sesi berakhir. Masuk kembali.");
      const { error: re } = await db.auth.signInWithPassword({
        email: u.user.email,
        password: String(f.get("current")),
      });
      if (re) throw new Error("Kata sandi saat ini tidak sesuai.");
      const { error: pe } = await db.auth.updateUser({ password: next });
      if (pe)
        throw new Error(
          "Kata sandi belum dapat diperbarui. Coba lagi. Jika tetap gagal, hubungi pengelola aplikasi.",
        );
      setModal(null);
      setFeedback("Kata sandi diperbarui.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kata sandi gagal diperbarui.");
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  async function resetPassword(e: FormEvent<HTMLFormElement>) {
    const f = formValues(e);
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      const { data: s } = await supabase().auth.getSession();
      const response = await fetch("/api/accounts/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.session?.access_token}`,
        },
        body: JSON.stringify({
          id: modal?.id,
          password: String(f.get("password")),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setModal(null);
      setFeedback(
        "Kata sandi akun diperbarui. Sampaikan kata sandi baru kepada pengelola kecamatan.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset kata sandi gagal.");
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  async function saveDistrictAccount(e: FormEvent<HTMLFormElement>) {
    const f = formValues(e);
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    const owner = data?.profile.id;
    const previous = data?.profiles.find((p) => p.id === modal?.id);
    try {
      const { data: session } = await supabase().auth.getSession();
      const response = await fetch("/api/accounts", {
        method: modal?.id ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({
          id: modal?.id,
          username: text(f, "username"),
          district: text(f, "district"),
          ...(modal?.id ? {} : { password: String(f.get("password")) }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const profile = result.profile as Data["profile"];
      setData((current) => {
        if (!current || current.profile.id !== owner) return current;
        const renamed = previous && previous.district !== profile.district;
        return {
          ...current,
          profiles: current.profiles.some((p) => p.id === profile.id)
            ? current.profiles.map((p) => (p.id === profile.id ? profile : p))
            : [...current.profiles, profile],
          people: renamed
            ? current.people.map((p) =>
                p.district === previous.district
                  ? { ...p, district: profile.district! }
                  : p,
              )
            : current.people,
          results: renamed
            ? current.results.map((r) =>
                r.district === previous.district
                  ? { ...r, district: profile.district! }
                  : r,
              )
            : current.results,
        };
      });
      setModal(null);
      setFeedback(
        previous
          ? "Akun kecamatan diperbarui."
          : "Akun kecamatan ditambahkan. Sampaikan nama pengguna dan kata sandi awal kepada pengelola kecamatan.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Akun belum dapat disimpan.");
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  function personActions(p: Person) {
    return (
      <div className="actions" aria-busy={updating("person", p.id)}>
        {admin ? (
          <button
            className="btn icon-btn"
            title="Edit peserta"
            aria-label={`Edit peserta ${p.name}`}
            onClick={() => setModal({ kind: "person", person: p })}
          >
            <ActionIcon name="edit" />
          </button>
        ) : null}
        {admin ? (
          <button
            className="btn danger icon-btn"
            title="Hapus peserta"
            disabled={busy}
            aria-label={`Hapus peserta ${p.name}`}
            onClick={() => setModal({ kind: "delete-person", person: p })}
          >
            <ActionIcon name="trash" />
          </button>
        ) : null}
        <button
          className="btn icon-btn"
          title="Lihat detail"
          aria-label={`Lihat detail ${p.name}`}
          onClick={() => setModal({ kind: "detail", person: p })}
        >
          <ActionIcon name="eye" />
        </button>
      </div>
    );
  }
  function exportCSV() {
    if (!data) return;
    const cell = (v: string) =>
      '"' +
      (/^[=+@\-\t\r\n]/.test(v) ? "'" : "") +
      v.replaceAll('"', '""') +
      '"';
    const rows = [
      [
        "Nomor bukti",
        "Peserta",
        "Kecamatan",
        "Kategori",
        "Paket",
        "Surah / materi",
        "Ayat / rentang materi",
        "Waktu WITA",
        "Status",
        "Alasan",
      ],
      ...data.results.map((r) => [
        r.id,
        r.name,
        r.district,
        r.category,
        r.code,
        r.surah,
        r.verses,
        date(r.created_at),
        r.cancelled ? "Dibatalkan" : "Tersimpan",
        r.reason,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "hasil-undian-maqro.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const themeButton = (
    <button
      type="button"
      className="btn icon-btn"
      onClick={() => setDark(!dark)}
      aria-label={dark ? "Tema terang" : "Tema gelap"}
      title={dark ? "Tema terang" : "Tema gelap"}
    >
      <ActionIcon name={dark ? "sun" : "moon"} />
    </button>
  );
  const errorBox = error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
  if (!data)
    return (
      <>
        <a className="skip" href="#workspace">
          Lewati navigasi
        </a>
        <div className="login">
          <section className="login-context">
            <Brand login />
            <h1>
              Selamat datang di{" "}
              <span style={{ whiteSpace: "nowrap" }}>e-MTQ</span> Kabupaten
              Kutai Barat
            </h1>
            <div className="event-stamp">MTQ Kabupaten Kutai Barat</div>
          </section>
          <main className="login-main" id="workspace">
            <div className="login-box" aria-busy={loading || busy}>
              <h1>Masuk</h1>
              {!configured ? (
                <div className="notice warn">
                  <strong>Aplikasi belum siap digunakan.</strong>
                  <br />
                  Hubungi pengelola aplikasi.
                </div>
              ) : null}
              {loading ? <LoginSkeleton /> : null}
              {errorBox}
              <div hidden={loading}>
                <form className="form-stack" onSubmit={login}>
                  <div>
                    <label htmlFor="username">Nama pengguna *</label>
                    <input
                      id="username"
                      name="username"
                      required
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="Nama pengguna"
                      maxLength={64}
                    />
                  </div>
                  <div>
                    <label htmlFor="login-password">Kata sandi *</label>
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      maxLength={128}
                    />
                  </div>
                  <button
                    className="btn primary"
                    disabled={!configured || busy || loading}
                  >
                    {busy ? (
                      <>
                        <span className="sr-only">Memeriksa akun</span>
                        <span className="skeleton-button" aria-hidden="true" />
                      </>
                    ) : (
                      "Masuk"
                    )}
                  </button>
                </form>
              </div>
              <p className="hint">
                Jika akses bermasalah, hubungi panitia MTQ.
              </p>
              {themeButton}
              {configured && error ? (
                <button className="btn" onClick={() => void load()}>
                  Periksa koneksi kembali
                </button>
              ) : null}
            </div>
          </main>
        </div>
      </>
    );

  const compareText = new Intl.Collator("id", {
    sensitivity: "base",
    numeric: true,
  });
  const districts = [
    ...new Set([
      ...data.people.map((p) => p.district),
      ...data.profiles.flatMap((p) =>
        p.role === "district" && p.district ? [p.district] : [],
      ),
    ]),
  ].sort(compareText.compare);
  const activeDraws = new Set(
    data.results
      .filter((r) => !r.cancelled)
      .map((r) => `${r.person_id}:${r.category}`),
  );
  const hasPeopleFilters = Boolean(
    query ||
    peopleDistrict ||
    peopleCategory ||
    peopleGender ||
    peopleDrawStatus ||
    peopleSort !== "name-asc",
  );
  const visiblePeople = data.people
    .filter((p) => {
      if (
        !(p.name + " " + p.district)
          .toLocaleLowerCase("id")
          .includes(query.trim().toLocaleLowerCase("id"))
      )
        return false;
      if (admin && peopleDistrict && p.district !== peopleDistrict)
        return false;
      if (peopleCategory && !p.entries.includes(peopleCategory)) return false;
      if (peopleGender && p.gender !== peopleGender) return false;
      const entries = peopleCategory ? [peopleCategory] : p.entries;
      const drawn = entries.some((id) =>
        activeDraws.has(`${p.id}:${category(id)}`),
      );
      return (
        !peopleDrawStatus || (peopleDrawStatus === "drawn" ? drawn : !drawn)
      );
    })
    .sort((a, b) => {
      const byName =
        compareText.compare(a.name, b.name) || compareText.compare(a.id, b.id);
      switch (peopleSort) {
        case "name-desc":
          return -byName;
        case "district-asc":
          return compareText.compare(a.district, b.district) || byName;
        case "district-desc":
          return compareText.compare(b.district, a.district) || byName;
        case "youngest":
          return b.birth.localeCompare(a.birth) || byName;
        case "oldest":
          return a.birth.localeCompare(b.birth) || byName;
        default:
          return byName;
      }
    });
  return (
    <>
      <a className="skip" href="#workspace">
        Lewati navigasi
      </a>
      <div className="shell">
        <header className="mobile-header" inert={menu}>
          <Brand />
          <button
            className="btn mobile-toggle"
            ref={menuTrigger}
            type="button"
            aria-expanded={menu}
            aria-controls="navigation"
            onClick={() => setMenu(true)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            Menu
          </button>
        </header>
        {menu && (
          <div
            className="menu-backdrop"
            onClick={() => setMenu(false)}
            aria-hidden="true"
          />
        )}
        <aside
          ref={menuPanel}
          className={`side ${menu ? "is-open" : ""}`}
          role={menu ? "dialog" : undefined}
          aria-modal={menu ? true : undefined}
          aria-label="Menu utama"
        >
          <div className="side-heading">
            <Brand />
            <button
              type="button"
              className="btn icon-btn mobile-close"
              aria-label="Tutup menu"
              onClick={() => setMenu(false)}
            >
              <ActionIcon name="close" />
            </button>
          </div>
          <nav id="navigation" aria-label="Navigasi utama">
            {pages.map((p) => (
              <button
                type="button"
                className="nav-link"
                key={p}
                aria-current={page === p ? "page" : undefined}
                disabled={busy}
                onClick={() => go(p)}
              >
                {titles[p]}
              </button>
            ))}
          </nav>
          <div className="side-foot">
            <p>
              {admin ? "Admin utama" : `Kafilah ${data.profile.district}`}
              <br />
              MTQ Kabupaten Kutai Barat
            </p>
            <div className="actions">
              <button
                className="btn"
                onClick={() => {
                  setMenu(false);
                  setModal({ kind: "account" });
                }}
              >
                Pengaturan akun
              </button>
              <button
                className="btn icon-btn"
                disabled={busy}
                onClick={() => {
                  setMenu(false);
                  void logout();
                }}
                aria-label="Keluar"
                title="Keluar"
              >
                <ActionIcon name="logout" />
              </button>
            </div>
          </div>
        </aside>
        <main className="main" inert={menu}>
          <header className="topbar">
            <span>MTQ Kutai Barat</span>
            <button
              className="btn account-trigger"
              onClick={() => setModal({ kind: "account" })}
            >
              {admin ? "Admin utama" : `Kafilah ${data.profile.district}`}
            </button>
          </header>
          <div className="workspace" id="workspace" tabIndex={-1}>
            <div className="page-head">
              <div>
                <p className="overline">
                  {admin
                    ? "Panitia kabupaten"
                    : `Kecamatan ${data.profile.district}`}
                </p>
                <h1>{titles[page]}</h1>
                {descriptions[page] ? <p>{descriptions[page]}</p> : null}
              </div>
              <div className="actions">
                {page === "people" ? (
                  <button
                    className="btn"
                    disabled={!data.results.length || busy}
                    onClick={exportCSV}
                  >
                    Ekspor hasil CSV
                  </button>
                ) : null}
                {page === "accounts" && admin ? (
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() => setModal({ kind: "district-account" })}
                  >
                    Tambah akun kecamatan
                  </button>
                ) : null}
                {page === "people" && admin ? (
                  <button
                    className="btn primary"
                    onClick={() => setModal({ kind: "person" })}
                  >
                    Tambah peserta
                  </button>
                ) : null}
                {page === "bank" ? (
                  <button
                    className="btn primary"
                    onClick={() => setModal({ kind: "package" })}
                  >
                    Tambah paket
                  </button>
                ) : null}
                {page === "sessions" && admin ? (
                  <button
                    className="btn primary"
                    disabled={busy || loading || !readySessions.length}
                    onClick={() => setModal({ kind: "open-sessions" })}
                  >
                    Buka semua sesi
                  </button>
                ) : null}
                <button
                  className="btn icon-btn"
                  disabled={loading || busy}
                  onClick={() => void load()}
                  aria-label="Muat ulang"
                  title="Muat ulang"
                >
                  <ActionIcon name="refresh" />
                </button>
              </div>
            </div>
            {!modal ? errorBox : null}
            <div aria-busy={loading}>
              {loading && drawStep !== 3 ? (
                <WorkspaceSkeleton page={drawStep === 4 ? "receipt" : page} />
              ) : (
                <>
                  {page === "dashboard" && admin ? (
                    <WorkSummary
                      data={data}
                      openPeople={({ district = "", status = "" }) => {
                        resetPeopleFilters();
                        setPeopleDistrict(district);
                        setPeopleDrawStatus(status);
                        go("people");
                      }}
                    />
                  ) : null}
                  {page === "people" ? (
                    <>
                      <div className="filters people-filters">
                        <div className="field">
                          <label htmlFor="search">
                            Cari peserta atau kecamatan
                          </label>
                          <input
                            id="search"
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Nama peserta atau kecamatan"
                          />
                        </div>
                        {admin ? (
                          <div className="field">
                            <label htmlFor="people-district">Kecamatan</label>
                            <select
                              id="people-district"
                              value={peopleDistrict}
                              onChange={(e) =>
                                setPeopleDistrict(e.target.value)
                              }
                            >
                              <option value="">Semua kecamatan</option>
                              {districts.map((district) => (
                                <option key={district} value={district}>
                                  {district}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        <div className="field">
                          <label htmlFor="people-category">Cabang</label>
                          <select
                            id="people-category"
                            value={peopleCategory}
                            onChange={(e) => setPeopleCategory(e.target.value)}
                          >
                            <option value="">Semua cabang</option>
                            {data.categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="people-gender">Putra / Putri</label>
                          <select
                            id="people-gender"
                            value={peopleGender}
                            onChange={(e) => setPeopleGender(e.target.value)}
                          >
                            <option value="">Semua peserta</option>
                            <option value="Putra">Putra</option>
                            <option value="Putri">Putri</option>
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="people-draw-status">
                            Status undian
                          </label>
                          <select
                            id="people-draw-status"
                            value={peopleDrawStatus}
                            onChange={(e) =>
                              setPeopleDrawStatus(e.target.value)
                            }
                            aria-describedby="people-draw-hint"
                          >
                            <option value="">Semua status</option>
                            <option value="drawn">Sudah mengundi</option>
                            <option value="not-drawn">Belum mengundi</option>
                          </select>
                        </div>
                      </div>
                      <div className="people-filter-summary">
                        <p role="status">
                          Menampilkan {visiblePeople.length} dari{" "}
                          {data.people.length} peserta
                        </p>
                        <button
                          type="button"
                          className="btn"
                          onClick={resetPeopleFilters}
                          disabled={!hasPeopleFilters}
                        >
                          Reset filter & urutan
                        </button>
                      </div>
                      <p className="hint" id="people-draw-hint">
                        {peopleCategory
                          ? "Status undian mengikuti cabang yang dipilih."
                          : "Sudah mengundi berarti memiliki hasil aktif pada setidaknya satu cabang."}
                      </p>
                      <section className="panel data-panel">
                        {visiblePeople.length ? (
                          <table className="table people-table">
                            <caption className="people-table-caption">
                              {" "}
                              <div className="field">
                                <label htmlFor="people-sort">Urutkan</label>
                                <select
                                  id="people-sort"
                                  value={peopleSort}
                                  onChange={(e) =>
                                    setPeopleSort(e.target.value)
                                  }
                                >
                                  <option value="name-asc">Nama A–Z</option>
                                  <option value="name-desc">Nama Z–A</option>
                                  {admin ? (
                                    <option value="district-asc">
                                      Kecamatan A–Z
                                    </option>
                                  ) : null}
                                  {admin ? (
                                    <option value="district-desc">
                                      Kecamatan Z–A
                                    </option>
                                  ) : null}
                                  <option value="youngest">Usia termuda</option>
                                  <option value="oldest">Usia tertua</option>
                                </select>
                              </div>
                            </caption>
                            <thead>
                              <tr>
                                <th
                                  scope="col"
                                  aria-sort={
                                    peopleSort === "name-asc"
                                      ? "ascending"
                                      : peopleSort === "name-desc"
                                        ? "descending"
                                        : "none"
                                  }
                                >
                                  <button
                                    type="button"
                                    className="table-sort"
                                    onClick={() =>
                                      setPeopleSort(
                                        peopleSort === "name-asc"
                                          ? "name-desc"
                                          : "name-asc",
                                      )
                                    }
                                  >
                                    Peserta{" "}
                                    <span aria-hidden="true">
                                      <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                      >
                                        {peopleSort !== "name-desc" ? (
                                          <path d="m4 6 4-4 4 4" />
                                        ) : null}
                                        {peopleSort !== "name-asc" ? (
                                          <path d="m4 10 4 4 4-4" />
                                        ) : null}
                                      </svg>
                                    </span>
                                  </button>
                                </th>
                                <th
                                  scope="col"
                                  aria-sort={
                                    peopleSort === "district-asc"
                                      ? "ascending"
                                      : peopleSort === "district-desc"
                                        ? "descending"
                                        : "none"
                                  }
                                >
                                  {admin ? (
                                    <button
                                      type="button"
                                      className="table-sort"
                                      onClick={() =>
                                        setPeopleSort(
                                          peopleSort === "district-asc"
                                            ? "district-desc"
                                            : "district-asc",
                                        )
                                      }
                                    >
                                      Kecamatan & cabang{" "}
                                      <span aria-hidden="true">
                                        <svg
                                          width="16"
                                          height="16"
                                          viewBox="0 0 16 16"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                        >
                                          {peopleSort !== "district-desc" ? (
                                            <path d="m4 6 4-4 4 4" />
                                          ) : null}
                                          {peopleSort !== "district-asc" ? (
                                            <path d="m4 10 4 4 4-4" />
                                          ) : null}
                                        </svg>
                                      </span>
                                    </button>
                                  ) : (
                                    "Kecamatan & cabang"
                                  )}
                                </th>
                                <th>Hasil undian</th>
                                <th>Tindakan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visiblePeople.map((p) => (
                                <tr
                                  key={p.id}
                                  aria-busy={updating("person", p.id)}
                                >
                                  <td data-label="Peserta">
                                    <strong>{p.name}</strong>
                                    <small>{p.gender}</small>
                                  </td>
                                  <td data-label="Kecamatan & cabang">
                                    <div>
                                      {p.district}
                                      <small>
                                        {p.entries.map(category).join(", ")}
                                      </small>
                                    </div>
                                  </td>
                                  <td data-label="Hasil undian">
                                    <ParticipantResults
                                      results={data.results.filter(
                                        (r) => r.person_id === p.id,
                                      )}
                                      busy={busy}
                                      onView={(result) =>
                                        setModal({ kind: "receipt", result })
                                      }
                                      onCancel={
                                        admin
                                          ? (result) =>
                                              setModal({
                                                kind: "cancel",
                                                result,
                                              })
                                          : undefined
                                      }
                                    />
                                  </td>
                                  <td data-label="Tindakan">
                                    {personActions(p)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="panel-inset">
                            <Empty title="Peserta tidak ditemukan">
                              {hasPeopleFilters
                                ? "Ubah pencarian atau filter, atau gunakan Reset filter & urutan untuk melihat peserta lain."
                                : admin
                                  ? "Tambahkan peserta dan tentukan kecamatannya."
                                  : "Panitia belum memasukkan peserta untuk kecamatan Anda."}
                            </Empty>
                          </div>
                        )}
                      </section>
                    </>
                  ) : null}
                  {page === "sessions" && admin ? (
                    <>
                      <div className="notice">
                        Setiap cabang memiliki satu sesi. Peserta dapat langsung
                        mengundi sesuai cabang yang diikuti.
                      </div>
                      <section className="panel data-panel section-gap">
                        {data.sessions.length ? (
                          <table className="table sessions-table">
                            <thead>
                              <tr>
                                <th scope="col">Cabang</th>
                                <th scope="col">Paket</th>
                                <th scope="col">Status</th>
                                <th scope="col">Tindakan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.sessions.map((s) => (
                                <SessionRow
                                  key={s.id}
                                  session={s}
                                  name={category(s.category_id)}
                                  count={
                                    data.packages.filter(
                                      (m) => m.category_id === s.category_id,
                                    ).length
                                  }
                                  busy={busy}
                                  updating={updating("session", s.id)}
                                  save={async (open) =>
                                    (await act(
                                      "session",
                                      { id: s.id, open, repeat: false },
                                      "Pengaturan sesi disimpan.",
                                    )) !== null
                                  }
                                />
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="panel-inset">
                            <Empty title="Belum ada sesi">
                              Sesi perlombaan belum tersedia.
                            </Empty>
                          </div>
                        )}
                      </section>
                    </>
                  ) : null}
                  {page === "bank" && admin ? (
                    <div className="cardgrid">
                      {data.categories.map((c) => (
                        <section
                          className="panel"
                          key={c.id}
                          aria-busy={
                            pendingChange?.action === "package" &&
                            pendingChange.categoryId === c.id
                          }
                        >
                          <h2>{c.name}</h2>
                          <p className="hint">
                            {
                              data.packages.filter(
                                (m) => m.category_id === c.id,
                              ).length
                            }{" "}
                            paket
                          </p>
                          {data.packages
                            .filter((m) => m.category_id === c.id)
                            .map((m) => (
                              <article className="bank-item" key={m.id}>
                                <h3>{m.code}</h3>
                                <p>
                                  {m.surah}
                                  <br />
                                  Ayat / rentang materi: {m.verses}
                                </p>
                              </article>
                            ))}
                          {!data.packages.some(
                            (m) => m.category_id === c.id,
                          ) ? (
                            <Empty title="Belum ada paket">
                              Tambahkan paket resmi sebelum membuka sesi cabang
                              ini.
                            </Empty>
                          ) : null}
                        </section>
                      ))}
                    </div>
                  ) : null}
                  {page === "accounts" && admin ? (
                    <section className="panel data-panel">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Kecamatan</th>
                            <th>Nama pengguna</th>
                            <th>Status</th>
                            <th>Tindakan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.profiles
                            .filter((p) => p.role === "district")
                            .map((p) => (
                              <tr
                                key={p.id}
                                aria-busy={updating("account", p.id)}
                              >
                                <td data-label="Kecamatan">
                                  <strong>{p.district}</strong>
                                </td>
                                <td data-label="Nama pengguna">{p.username}</td>
                                <td data-label="Status">
                                  <Badge>
                                    {p.active ? "Aktif" : "Nonaktif"}
                                  </Badge>
                                </td>
                                <td data-label="Tindakan">
                                  <div className="actions">
                                    <button
                                      className="btn icon-btn"
                                      disabled={busy}
                                      aria-label={`Edit akun ${p.district}`}
                                      title={`Edit akun ${p.district}`}
                                      onClick={() =>
                                        setModal({
                                          kind: "district-account",
                                          id: p.id,
                                        })
                                      }
                                    >
                                      <ActionIcon name="edit" />
                                    </button>
                                    <button
                                      className="btn"
                                      disabled={busy}
                                      onClick={() =>
                                        setModal({
                                          kind: "toggle-account",
                                          id: p.id,
                                        })
                                      }
                                    >
                                      {p.active ? "Nonaktifkan" : "Aktifkan"}
                                    </button>
                                    <button
                                      className="btn"
                                      onClick={() =>
                                        setModal({ kind: "reset", id: p.id })
                                      }
                                    >
                                      Reset kata sandi
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {!data.profiles.some((p) => p.role === "district") ? (
                        <div className="panel-inset">
                          <Empty title="Akun kecamatan belum tersedia">
                            Gunakan Tambah akun kecamatan untuk membuat akun.
                          </Empty>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                  {page === "draw" && !admin ? (
                    <div className="draw-layout">
                      <ol className="stepper" aria-label="Tahapan undian">
                        {[
                          "Pilih peserta",
                          "Periksa data",
                          "Proses undian",
                          "Bukti hasil",
                        ].map((s, i) => (
                          <li
                            key={s}
                            aria-current={
                              drawStep === i + 1 ? "step" : undefined
                            }
                          >
                            <span>{i + 1}</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                      <div className="draw-context">
                        <span>
                          Kafilah <strong>{data.profile.district}</strong>
                        </span>
                        <span>
                          Satu hasil undian aktif per peserta dan cabang
                        </span>
                      </div>
                      <div hidden={drawStep !== 1}>
                        <DrawPicker
                          people={data.people}
                          sessions={data.sessions}
                          categories={data.categories}
                          results={data.results}
                          busy={busy || loading}
                          onSelect={(person, session) => {
                            setSelection({ person, session });
                            setDrawStep(2);
                          }}
                          onView={(result) => {
                            setDrawResult(result);
                            setDrawStep(4);
                          }}
                        />
                      </div>
                      {drawStep === 2 && selection ? (
                        <section className="panel">
                          <h2>Periksa data undian</h2>
                          <dl className="review">
                            <div>
                              <dt>Nama peserta</dt>
                              <dd>{selection.person.name}</dd>
                            </div>
                            <div>
                              <dt>Kecamatan</dt>
                              <dd>{selection.person.district}</dd>
                            </div>
                            <div>
                              <dt>Kategori peserta</dt>
                              <dd>{selection.person.gender}</dd>
                            </div>
                            <div>
                              <dt>Cabang</dt>
                              <dd>{category(selection.session.category_id)}</dd>
                            </div>
                          </dl>
                          <p className="notice section-gap">
                            Hasil langsung ditetapkan dan disimpan. Jika ada
                            kesalahan, pembatalan hanya dapat dilakukan panitia
                            dengan alasan yang tercatat.
                          </p>
                          <div className="draw-action">
                            <button
                              className="btn"
                              disabled={busy}
                              onClick={() => setDrawStep(1)}
                            >
                              Kembali
                            </button>
                            <button
                              className="btn primary"
                              disabled={busy || loading}
                              onClick={async () => {
                                if (busy || mutation.current) return;
                                setDrawStep(3);
                                const reducedMotion = window.matchMedia(
                                  "(prefers-reduced-motion: reduce)",
                                ).matches;
                                const [result] = await Promise.all([
                                  act(
                                    "draw",
                                    {
                                      id: selection.person.id,
                                      session_id: selection.session.id,
                                    },
                                    "Hasil undian tersimpan.",
                                  ),
                                  new Promise<void>((resolve) =>
                                    window.setTimeout(
                                      resolve,
                                      reducedMotion ? 0 : 2200,
                                    ),
                                  ),
                                ]);
                                if (result) {
                                  setDrawResult(result as Result);
                                  setDrawStep(4);
                                } else setDrawStep(2);
                              }}
                            >
                              Tetapkan maqro
                            </button>
                          </div>
                        </section>
                      ) : null}
                      {drawStep === 3 ? (
                        <section
                          className="panel drawing"
                          role="status"
                          aria-live="polite"
                          aria-busy="true"
                        >
                          <div className="draw-shuffle" aria-hidden="true">
                            <span className="draw-card draw-card-left" />
                            <span className="draw-card draw-card-right" />
                            <span className="draw-card draw-card-front">
                              <span>MAQRO</span>
                              <span className="draw-card-seal">?</span>
                            </span>
                          </div>
                          <h2>Mengundi maqro</h2>
                          <p>Menetapkan maqro dan menyimpan hasil undian.</p>
                          <p className="muted">
                            Mohon tunggu, jangan tutup halaman ini.
                          </p>
                        </section>
                      ) : null}
                      {drawStep === 4 && drawResult ? (
                        <>
                          <div className="draw-reveal">
                            <Receipt result={drawResult} />
                          </div>
                          <div className="actions receipt-actions">
                            <button
                              className="btn"
                              onClick={() => {
                                setDrawStep(1);
                              }}
                            >
                              Kembali ke peserta
                            </button>
                            <button
                              className="btn primary"
                              onClick={() => window.print()}
                            >
                              Cetak / Simpan PDF
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {page === "logs" && admin ? (
                    <section className="panel">
                      <h2>Catatan aktivitas</h2>
                      {data.logs.length ? (
                        data.logs.map((l) => (
                          <div className="log-item" key={l.id}>
                            {l.message}
                            <small>{date(l.created_at)}</small>
                          </div>
                        ))
                      ) : (
                        <Empty title="Belum ada perubahan">
                          Perubahan peserta, pengaturan sesi, dan hasil undian
                          akan tercatat setelah dilakukan.
                        </Empty>
                      )}
                    </section>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
      <div id="feedback" role="status" aria-live="polite">
        {feedback}
      </div>
      {modal ? (
        <Modal
          className={modal.kind === "account" ? "account-dialog" : undefined}
          title={
            {
              person: modal.person ? "Edit peserta" : "Tambah peserta",
              detail: "Detail peserta",
              "delete-person": "Hapus peserta",
              package: "Tambah maqro",
              cancel: "Batalkan hasil undian",
              account: "Pengaturan akun",
              "district-account": modal.id
                ? "Edit akun kecamatan"
                : "Tambah akun kecamatan",
              password: "Ubah kata sandi",
              reset: "Reset kata sandi akun kecamatan",
              "toggle-account": "Ubah status akun",
              "open-sessions": "Buka semua sesi",
              receipt: "Bukti hasil undian",
            }[modal.kind] || "Konfirmasi"
          }
          close={close}
          busy={busy}
        >
          {errorBox}
          {modal.kind === "delete-person" && modal.person && admin ? (
            <>
              <p>
                Hapus peserta <strong>{modal.person.name}</strong> dari
                kecamatan <strong>{modal.person.district}</strong>?
              </p>
              <p className="hint">
                Data yang dihapus tidak dapat dikembalikan. Peserta yang
                memiliki riwayat undian, termasuk hasil yang dibatalkan, tidak
                dapat dihapus.
              </p>
              <div className="actions dialog-actions">
                <button className="btn" disabled={busy} onClick={close}>
                  Batal
                </button>
                <button
                  className="btn danger"
                  disabled={
                    busy ||
                    data.results.some(
                      (result) => result.person_id === modal.person?.id,
                    )
                  }
                  onClick={() =>
                    void act(
                      "delete-person",
                      { id: modal.person!.id },
                      "Data peserta dihapus.",
                    )
                  }
                >
                  {busy ? "Menghapus…" : "Hapus peserta"}
                </button>
              </div>
            </>
          ) : null}
          {modal.kind === "district-account" && admin ? (
            <form className="form-stack" onSubmit={saveDistrictAccount}>
              <Field label="Kecamatan" name="district">
                <input
                  id="district"
                  name="district"
                  required
                  maxLength={100}
                  autoComplete="off"
                  defaultValue={
                    data.profiles.find((p) => p.id === modal.id)?.district ?? ""
                  }
                />
              </Field>
              <Field label="Nama pengguna" name="username">
                <input
                  id="username"
                  name="username"
                  required
                  pattern="(?:[a-z0-9]|-)+"
                  maxLength={64}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="account-username-help"
                  defaultValue={
                    data.profiles.find((p) => p.id === modal.id)?.username ?? ""
                  }
                />
              </Field>
              <p id="account-username-help">
                Gunakan huruf kecil, angka, atau tanda hubung. Nama ini dipakai
                untuk masuk.
              </p>
              {!modal.id ? (
                <Field label="Kata sandi awal" name="password">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    aria-describedby="account-password-help"
                  />
                </Field>
              ) : null}
              <p id="account-password-help">
                {modal.id
                  ? "Kata sandi tetap berlaku. Gunakan Reset kata sandi untuk menggantinya."
                  : "Kata sandi minimal 12 karakter."}
              </p>
              <button className="btn primary" disabled={busy}>
                {busy ? (
                  <>
                    <span className="sr-only">Menyimpan akun</span>
                    <span className="skeleton-button" aria-hidden="true" />
                  </>
                ) : modal.id ? (
                  "Simpan perubahan"
                ) : (
                  "Tambah akun"
                )}
              </button>
            </form>
          ) : null}
          {modal.kind === "open-sessions" && admin ? (
            <>
              <p>
                Buka {readySessions.length} sesi yang sudah memiliki paket
                maqro? Setiap cabang memiliki satu sesi undian.
              </p>
              {blockedSessions.length ? (
                <p className="notice warn">
                  {blockedSessions.length} sesi belum memiliki paket dan akan
                  tetap ditutup.
                </p>
              ) : null}
              <div className="actions dialog-actions">
                <button className="btn" disabled={busy} onClick={close}>
                  Batal
                </button>
                <button
                  className="btn primary"
                  disabled={busy || !readySessions.length}
                  onClick={() => void openAllSessions()}
                >
                  Buka sesi yang siap
                </button>
              </div>
            </>
          ) : null}
          {modal.kind === "person" && admin ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                const f = formValues(e);
                void act(
                  "person",
                  {
                    id: modal.person?.id,
                    name: text(f, "name"),
                    birth: text(f, "birth"),
                    gender: text(f, "gender"),
                    district: text(f, "district"),
                    entries: f.getAll("entries"),
                  },
                  "Data peserta disimpan dan langsung tersedia untuk undian sesuai sesi yang dibuka.",
                );
              }}
            >
              <p className="hint">Kolom bertanda * wajib diisi.</p>
              <Field
                label="Nama lengkap"
                name="name"
                value={modal.person?.name}
              />
              <Field label="Kecamatan" name="district">
                <select
                  id="district"
                  name="district"
                  required
                  defaultValue={modal.person?.district || ""}
                >
                  <option value="" disabled>
                    Pilih kecamatan
                  </option>
                  {data.profiles
                    .filter((p) => p.role === "district")
                    .map((p) => (
                      <option key={p.id} value={p.district!}>
                        {p.district}
                      </option>
                    ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Tanggal lahir" name="birth">
                  <input
                    id="birth"
                    name="birth"
                    type="date"
                    defaultValue={modal.person?.birth}
                    required
                    max={new Date().toLocaleDateString("en-CA", {
                      timeZone: "Asia/Makassar",
                    })}
                  />
                </Field>
                <Field label="Kategori peserta" name="gender">
                  <select
                    id="gender"
                    name="gender"
                    defaultValue={modal.person?.gender || "Putra"}
                  >
                    <option>Putra</option>
                    <option>Putri</option>
                  </select>
                </Field>
              </div>
              <fieldset className="fieldset">
                <legend>Cabang yang diikuti *</legend>
                {data.categories.map((c) => (
                  <label className="checkline" key={c.id}>
                    <input
                      name="entries"
                      type="checkbox"
                      value={c.id}
                      defaultChecked={modal.person?.entries.includes(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </fieldset>
              <p className="hint">
                Pilih minimal satu cabang yang diikuti peserta.
              </p>
              <div className="dialog-actions actions">
                <button
                  type="button"
                  className="btn"
                  onClick={close}
                  disabled={busy}
                >
                  Batal
                </button>
                <button className="btn primary" disabled={busy}>
                  {busy ? (
                    <>
                      <span className="sr-only">Menyimpan data</span>
                      <span className="skeleton-button" aria-hidden="true" />
                    </>
                  ) : (
                    "Simpan data"
                  )}
                </button>
              </div>
            </form>
          ) : null}
          {modal.kind === "detail" && modal.person ? (
            <>
              <dl className="review">
                {[
                  ["Nama peserta", modal.person.name],
                  ["Kecamatan", modal.person.district],
                  ["Tanggal lahir", modal.person.birth],
                  ["Kategori peserta", modal.person.gender],
                  ["Cabang", modal.person.entries.map(category).join(", ")],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="dialog-actions actions">
                <button className="btn" onClick={close}>
                  Selesai
                </button>
              </div>
            </>
          ) : null}
          {modal.kind === "package" ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                const f = formValues(e);
                void act(
                  "package",
                  Object.fromEntries(f),
                  "Maqro ditambahkan.",
                );
              }}
            >
              <p className="hint">
                Masukkan paket resmi yang telah ditetapkan panitia. Semua kolom
                wajib diisi. Kode paket dibuat otomatis saat disimpan.
              </p>
              <Field label="Cabang" name="category_id">
                <select name="category_id" id="category_id" required>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Surah / materi" name="surah" />
              <Field label="Ayat / rentang materi" name="verses" />
              <button className="btn primary" disabled={busy}>
                Simpan paket
              </button>
            </form>
          ) : null}
          {modal.kind === "cancel" && modal.result ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                const f = formValues(e);
                void act(
                  "cancel",
                  { id: modal.result?.id, reason: text(f, "reason") },
                  "Hasil dibatalkan. Catatan lama dipertahankan.",
                );
              }}
            >
              <p>
                <strong>{modal.result.name}</strong> · {modal.result.code}
                <br />
                Hasil lama tetap tercatat. Undian pengganti dapat dilakukan jika
                sesi dibuka.
              </p>
              <Field label="Alasan pembatalan" name="reason" />
              <button className="btn danger" disabled={busy}>
                Batalkan hasil
              </button>
            </form>
          ) : null}
          {modal.kind === "account" ? (
            <div className="account-settings">
              <div className="account-identity">
                <h3>
                  {admin ? "Admin utama" : `Kafilah ${data.profile.district}`}
                </h3>
                <p>
                  Nama pengguna: <strong>{data.profile.username}</strong>
                </p>
              </div>
              <div className="account-setting-row">
                <div>
                  <h3>Kata sandi</h3>
                  <p>Kelola kata sandi untuk masuk ke akun.</p>
                </div>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => setModal({ kind: "password" })}
                >
                  Ubah kata sandi
                </button>
              </div>
              <div className="account-setting-row">
                <div>
                  <h3>Tampilan</h3>
                  <p>Tema {dark ? "gelap" : "terang"} sedang aktif.</p>
                </div>
                <button className="btn" onClick={() => setDark(!dark)}>
                  <ActionIcon name={dark ? "sun" : "moon"} />
                  {dark ? "Tema terang" : "Tema gelap"}
                </button>
              </div>
              <div className="account-signout">
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() => void logout()}
                  aria-label="Keluar dari akun"
                  title="Keluar dari akun"
                >
                  <ActionIcon name="logout" />
                  {busy ? "Sedang keluar…" : "Keluar dari akun"}
                </button>
              </div>
            </div>
          ) : null}
          {modal.kind === "password" ? (
            <form className="form-stack" onSubmit={password}>
              <Field label="Kata sandi saat ini" name="current">
                <input
                  id="current"
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label="Kata sandi baru" name="password">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </Field>
              <Field
                label="Ulangi kata sandi baru"
                name="confirm"
                type="password"
              />
              <p className="hint">
                Minimal 12 karakter, maksimal 128 karakter.
              </p>
              <button className="btn primary" disabled={busy}>
                Simpan kata sandi
              </button>
            </form>
          ) : null}
          {modal.kind === "reset" ? (
            <form className="form-stack" onSubmit={resetPassword}>
              <p>
                Tetapkan kata sandi baru untuk akun{" "}
                <strong>
                  {data.profiles.find((p) => p.id === modal.id)?.username}
                </strong>
                . Sampaikan kata sandi kepada pengelola kecamatan.
              </p>
              <Field label="Kata sandi baru" name="password">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </Field>
              <p className="hint">
                Minimal 12 karakter, maksimal 128 karakter.
              </p>
              <button className="btn primary" disabled={busy}>
                Simpan kata sandi baru
              </button>
            </form>
          ) : null}
          {modal.kind === "toggle-account" ? (
            <>
              <p>
                {data.profiles.find((p) => p.id === modal.id)?.active
                  ? "Nonaktifkan"
                  : "Aktifkan"}{" "}
                akun{" "}
                <strong>
                  {data.profiles.find((p) => p.id === modal.id)?.district}
                </strong>
                ?{" "}
                {data.profiles.find((p) => p.id === modal.id)?.active
                  ? "Akun ini tidak dapat mengakses data atau melakukan undian setelah dinonaktifkan."
                  : "Akun ini dapat kembali mengakses data dan melakukan undian pada sesi yang dibuka."}
              </p>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  void act(
                    "account",
                    {
                      id: modal.id,
                      active: !data.profiles.find((p) => p.id === modal.id)
                        ?.active,
                    },
                    "Status akun diperbarui.",
                  )
                }
              >
                {data.profiles.find((p) => p.id === modal.id)?.active
                  ? "Nonaktifkan akun"
                  : "Aktifkan akun"}
              </button>
            </>
          ) : null}
          {modal.kind === "receipt" && modal.result ? (
            <>
              <Receipt result={modal.result} />
              <div className="actions dialog-actions">
                <button className="btn primary" onClick={() => window.print()}>
                  Cetak / Simpan PDF
                </button>
              </div>
            </>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}

function SessionRow({
  session: s,
  name,
  count,
  busy,
  updating,
  save,
}: {
  session: Session;
  name: string;
  count: number;
  busy: boolean;
  updating: boolean;
  save: (open: boolean) => Promise<boolean>;
}) {
  return (
    <tr aria-busy={updating} className="session-table-row">
      <td data-label="Cabang">
        <strong>{name}</strong>
      </td>
      <td data-label="Paket">{count} paket</td>
      <td data-label="Status">
        <Badge>{s.open ? "Dibuka" : "Ditutup"}</Badge>
      </td>
      <td data-label="Tindakan">
        <div className="actions">
          <button
            type="button"
            className={`btn ${s.open ? "" : "primary"}`}
            disabled={busy || (!s.open && !count)}
            onClick={() => void save(!s.open)}
          >
            {s.open ? "Tutup sesi" : "Buka sesi"}
          </button>
        </div>
      </td>
    </tr>
  );
}
