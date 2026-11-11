"use client";
import ActivityLog from "./activity-log";
import useWorkspaceSync from "./use-workspace-sync";
import useSessionClock from "./use-session-clock";
import SessionScheduleForm from "./session-schedule-form";
import ParticipantSessionControl from "./participant-session-control";
import DataTable, { TableHead, TableRow, TableCell } from "./data-table";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Data, Package, Person, Result, Session } from "@/lib/types";
import { LoginSkeleton, WorkspaceSkeleton } from "./skeletons";
import Brand from "./brand";
import ActionIcon from "./action-icon";
import SvgIcon from "@mui/material/SvgIcon";
import ParticipantResults from "./participant-results";
import DrawPicker from "./draw-picker";
import WorkSummary from "./work-summary";
import BankTable from "./bank-table";
import { competitionCode, participantNumber } from "@/lib/competition-codes";
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
const menuIconPaths: Record<string, string> = {
  dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  people:
    "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05C16.19 13.89 17 15.02 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  sessions:
    "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z",
  bank: "M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-10 6H3V6h8v4zm10 0h-8V6h8v4zM3 12h8v6H3v-6zm10 6v-6h8v6h-8z",
  accounts:
    "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  draw: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18C6.67 18 6 17.33 6 16.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9C15.67 9 15 8.33 15 7.5S15.67 6 16.5 6 18 6.67 18 7.5 17.33 9 16.5 9z",
  logs: "M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54 1.02-1.71-3.3-1.96V8h-2z",
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
  | "delete-history"
  | "participant-session"
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

function ParticipantEntryFields({
  person,
  categories,
}: {
  person?: Person;
  categories: Data["categories"];
}) {
  const [categoryId, setCategoryId] = useState(
    person?.entries.length === 1 ? person.entries[0] : "",
  );
  const categoryName = categories.find((c) => c.id === categoryId)?.name || "";
  const code = competitionCode(categoryName) || "";
  const storedNumber = person?.participant_number || "";
  const serial = storedNumber.replace(
    /^(?:TQ\.[TARD]|Q\.M[LD]\.[RD]|HQ\.(?:1|5|10|20|30)|FQ|SY\.Q|KQ\.(?:DL|N|H|D|K)|MH)-/i,
    "",
  );
  return (
    <>
      <Field label="Cabang yang diikuti" name="entries">
        <select
          id="entries"
          name="entries"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="" disabled>
            Pilih cabang lomba
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Nomor urut peserta"
        name="participant_number"
        required={false}
      >
        <div className="participant-number-input">
          <input
            aria-label="Kode cabang"
            value={code ? code + "-" : ""}
            placeholder="Kode"
            readOnly
          />
          <input
            id="participant_number"
            name="participant_number"
            defaultValue={serial}
            maxLength={250}
            aria-describedby="participant-number-hint"
          />
        </div>
      </Field>
      <p className="hint" id="participant-number-hint">
        Kode mengikuti cabang yang dipilih. Isi nomor urut peserta, misalnya 01.
      </p>
    </>
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

function Receipt({ result: r, person }: { result: Result; person?: Person }) {
  return (
    <article className="receipt">
      <div className="receipt-head">
        <div>
          <div className="wordmark">e-Maqro LPTQ Kubar</div>
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

export default function Workspace({ configured }: { configured: boolean }) {
  const [exporting, setExporting] = useState(false);
  const [rawData, setData] = useState<Data | null>(null),
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
  useSessionClock(rawData?.people);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [openingSessions, setOpeningSessions] = useState<string[]>([]);
  const [modal, setModal] = useState<{
    kind: string;
    person?: Person;
    package?: Package;
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
  useWorkspaceSync(
    rawData?.profile,
    () =>
      mutation.current ||
      loading ||
      !!modal ||
      drawStep === 2 ||
      drawStep === 3,
    async (tables, valid) => {
      const version = request.current;
      const { data: profile, error: profileError } = await supabase()
        .from("profiles")
        .select("*")
        .eq("id", rawData!.profile.id)
        .single();
      if (profileError) throw profileError;
      if (!valid() || version !== request.current)
        throw new Error("Sync deferred");
      if (!profile?.active) {
        setData(null);
        return;
      }
      const rows = await Promise.all(
        tables.map((name) => readTable(supabase(), name)),
      );
      if (!valid() || version !== request.current)
        throw new Error("Sync deferred");
      if (
        profile.role !== rawData!.profile.role ||
        profile.district !== rawData!.profile.district
      ) {
        await load();
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              profile,
              ...Object.fromEntries(tables.map((name, i) => [name, rows[i]])),
            }
          : current,
      );
    },
  );
  const [impersonatedId, setImpersonatedId] = useState<string | null>(null);
  const targetProfile =
    rawData?.profile.role === "admin"
      ? rawData.profiles.find(
          (p) => p.id === impersonatedId && p.role === "district" && p.active,
        )
      : undefined;
  const data =
    rawData && targetProfile
      ? {
          ...rawData,
          profile: targetProfile,
          people: rawData.people.filter(
            (p) => p.district === targetProfile.district,
          ),
          results: rawData.results.filter(
            (r) => r.district === targetProfile.district,
          ),
          profiles: [],
          packages: [],
          logs: [],
        }
      : rawData;
  const admin = data?.profile.role === "admin";
  function changeImpersonation(id: string | null) {
    if (mutation.current) return;
    setImpersonatedId(id);
    resetPeopleFilters();
    setSelectedPeople([]);
    setSelection(null);
    setDrawResult(null);
    setDrawStep(1);
    setModal(null);
    setMenu(false);
    setError("");
    setFeedback("");
    setPage(id ? "draw" : "accounts");
  }
  useEffect(() => {
    if (impersonatedId && !targetProfile) {
      setImpersonatedId(null);
      setSelection(null);
      setDrawResult(null);
      setModal(null);
      setPage("accounts");
    }
  }, [impersonatedId, targetProfile]);
  const pages = admin
    ? ["dashboard", "people", "sessions", "bank", "accounts", "logs"]
    : ["people", "draw"];
  const category = (id: string) =>
    data?.categories.find((c) => c.id === id)?.name || "Cabang tidak tersedia";
  const personNumbers = (person: Person) =>
    person.entries.length
      ? person.entries
          .map((id) =>
            participantNumber(person.participant_number, category(id)),
          )
          .join(", ")
      : person.participant_number || "?";
  const updating = (action: MutationAction, id: string) =>
    (pendingChange?.action === action && pendingChange.id === id) ||
    (action === "session" && openingSessions.includes(id));
  const allSessionsOpen =
    !!data?.sessions.length && data.sessions.every((s) => s.open);
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
        ...(profile.role === "admin" ? ["profiles", "packages"] : []),
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
    setSelectedPeople([]);
    setSelection(null);
    setDrawStep(1);
    setDrawResult(null);
    setError("");
    requestAnimationFrame(() => document.getElementById("workspace")?.focus());
  }
  async function act(
    action: MutationAction,
    payload: Record<string, unknown>,
    message: string,
  ) {
    if (mutation.current) return null;
    if (targetProfile) {
      if (action !== "draw") return null;
      payload = { ...payload, impersonated_profile_id: targetProfile.id };
    }
    mutation.current = true;
    request.current++;
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
          : action === "delete-history"
            ? await supabase().rpc("delete_draw_history", {
                result_ids: payload.ids,
              })
            : action === "package" && payload.id
              ? await supabase().rpc("edit_maqro", { payload })
              : await supabase().rpc("maqro_action", { action, payload });
      if (e) throw e;
      setModal(null);
      setFeedback(message);
      if (action === "participant-session") setSelectedPeople([]);
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
    if (action === "delete-history") {
      const ids = new Set(payload.ids as string[]);
      setData((current) =>
        current
          ? {
              ...current,
              results: current.results.filter((row) => !ids.has(row.id)),
            }
          : current,
      );
      return;
    }
    if (action === "delete-person") {
      setData((current) =>
        current
          ? {
              ...current,
              people: current.people.filter(
                (person) => person.id !== payload.id,
              ),
              results: current.results.filter(
                (result) => result.person_id !== payload.id,
              ),
            }
          : current,
      );
      return;
    }
    const collection: MutableCollection = {
      person: "people",
      "participant-session": "people",
      session: "sessions",
      package: "packages",
      account: "profiles",
      draw: "results",
      cancel: "results",
    }[action] as MutableCollection;
    const owner = rawData?.profile.id;
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
  async function toggleAllSessions() {
    const open = !allSessionsOpen;
    const targets = open ? readySessions : data?.sessions || [];
    if (mutation.current || !admin || !targets.length) return;
    const resultLabel = open ? "dibuka" : "ditutup";
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
            payload: { id: s.id, open, repeat: false },
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
        `${opened} sesi berhasil ${resultLabel}.${open && blockedSessions.length ? ` ${blockedSessions.length} sesi tanpa paket tetap ditutup.` : ""}`,
      );
      const messages: string[] = [];
      if (failed.length)
        messages.push(
          `${failed.length} sesi belum berhasil ${resultLabel}: ${failed.map((s) => category(s.category_id)).join(", ")}. Coba kembali setelah memeriksa koneksi${open ? " dan ketersediaan paket" : ""}.`,
        );
      if (stale)
        messages.push(
          `Sebagian sesi sudah ${resultLabel}, tetapi data terbarunya belum dapat dimuat. Gunakan Muat ulang untuk memperbarui tampilan.`,
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
  async function exportXLSX() {
    if (!data || exporting) return;
    setExporting(true);
    setError("");
    try {
      const { participantWorkbookBuffer } =
        await import("@/lib/participant-export");
      const buffer = await participantWorkbookBuffer(data);
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(buffer)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `peserta-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback("XLSX peserta dan hasil undian aktif telah dibuat.");
    } catch {
      setError("XLSX belum dapat dibuat. Silakan coba lagi.");
    } finally {
      setExporting(false);
    }
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
            <h1 className="text-center">
              Selamat datang di{" "}
              <span style={{ whiteSpace: "nowrap" }}>e-Maqro</span> Kabupaten
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
        !(p.name + " " + p.district + " " + personNumbers(p))
          .toLocaleLowerCase("id")
          .includes(query.trim().toLocaleLowerCase("id"))
      )
        return false;
      if (admin && peopleDistrict && p.district !== peopleDistrict)
        return false;
      if (peopleCategory && !p.entries.includes(peopleCategory)) return false;
      if (peopleGender && p.gender !== peopleGender) return false;
      if (peopleDrawStatus === "scheduled")
        return !!p.session_starts_at && !!p.session_ends_at;
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
        case "session-asc":
        case "session-desc": {
          const startA = a.session_starts_at
            ? Date.parse(a.session_starts_at)
            : NaN;
          const startB = b.session_starts_at
            ? Date.parse(b.session_starts_at)
            : NaN;
          const scheduledA = Number.isFinite(startA);
          const scheduledB = Number.isFinite(startB);
          if (scheduledA !== scheduledB) return scheduledA ? -1 : 1;
          if (!scheduledA) return byName;
          return (
            (peopleSort === "session-asc"
              ? startA - startB
              : startB - startA) || byName
          );
        }
        case "number-asc":
          return (
            compareText.compare(personNumbers(a), personNumbers(b)) || byName
          );
        case "number-desc":
          return (
            compareText.compare(personNumbers(b), personNumbers(a)) || byName
          );
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
            aria-label="Buka menu navigasi"
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
                <SvgIcon className="nav-icon" aria-hidden="true">
                  <path d={menuIconPaths[p]} />
                </SvgIcon>
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
          {targetProfile ? (
            <div className="impersonation-banner" role="status">
              <strong>
                Anda sedang bertindak sebagai Kecamatan {targetProfile.district}
              </strong>
              <button
                className="btn"
                disabled={busy}
                onClick={() => changeImpersonation(null)}
              >
                Kembali ke admin
              </button>
            </div>
          ) : null}
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
                {page === "people" && admin ? (
                  <button
                    className="btn danger"
                    disabled={!data.results.length || busy}
                    onClick={() => setModal({ kind: "delete-history" })}
                  >
                    Hapus seluruh histori undian
                  </button>
                ) : null}
                {page === "people" ? (
                  <button
                    className="btn"
                    disabled={!data.people.length || busy || exporting}
                    onClick={() => void exportXLSX()}
                    aria-busy={exporting}
                    title="Seluruh peserta dan hasil undian aktif dalam cakupan akun ini"
                  >
                    {exporting ? "Membuat XLSX…" : "Export Excel"}
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
                    disabled={
                      busy ||
                      loading ||
                      (!allSessionsOpen && !readySessions.length)
                    }
                    onClick={() => setModal({ kind: "open-sessions" })}
                  >
                    {allSessionsOpen ? "Tutup semua sesi" : "Buka semua sesi"}
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
                            placeholder="Nama, no. peserta, atau kecamatan"
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
                            <option value="scheduled">Sesi terjadwal</option>
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
                          <DataTable
                            rows={visiblePeople}
                            resetKey={JSON.stringify([
                              query,
                              peopleDistrict,
                              peopleCategory,
                              peopleGender,
                              peopleDrawStatus,
                              peopleSort,
                              impersonatedId,
                            ])}
                            paginationDisabled={busy}
                            renderRow={(p) => (
                              <TableRow
                                key={p.id}
                                aria-busy={updating("person", p.id)}
                              >
                                {admin ? (
                                  <TableCell data-label="Pilih">
                                    <input
                                      type="checkbox"
                                      aria-label={`Pilih ${p.name}`}
                                      disabled={busy}
                                      checked={selectedPeople.includes(p.id)}
                                      onChange={(event) =>
                                        setSelectedPeople((current) =>
                                          event.target.checked
                                            ? [...current, p.id]
                                            : current.filter(
                                                (id) => id !== p.id,
                                              ),
                                        )
                                      }
                                    />
                                  </TableCell>
                                ) : null}
                                <TableCell data-label="Peserta">
                                  <strong>{p.name}</strong>
                                  <small>{p.gender}</small>
                                  <small>{p.district}</small>
                                </TableCell>
                                <TableCell data-label="No. peserta">
                                  {personNumbers(p)}
                                  <small>
                                    {p.entries.map(category).join(", ")}
                                  </small>
                                </TableCell>
                                <TableCell data-label="Sesi peserta">
                                  <ParticipantSessionControl
                                    person={p}
                                    busy={busy}
                                    onConfigure={
                                      admin
                                        ? () =>
                                            setModal({
                                              kind: "participant-schedule",
                                              person: p,
                                            })
                                        : undefined
                                    }
                                  />
                                </TableCell>
                                <TableCell data-label="Hasil undian">
                                  <ParticipantResults
                                    onDelete={
                                      admin
                                        ? (result) =>
                                            setModal({
                                              kind: "delete-history",
                                              result,
                                            })
                                        : undefined
                                    }
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
                                </TableCell>
                                <TableCell data-label="Tindakan">
                                  {personActions(p)}
                                </TableCell>
                              </TableRow>
                            )}
                            aria-label="Daftar peserta"
                            className={`table people-table${admin ? " people-table-admin" : ""}`}
                          >
                            {admin ? (
                              <caption className="people-table-caption">
                                <div className="actions">
                                  <span role="status">
                                    {
                                      visiblePeople.filter((p) =>
                                        selectedPeople.includes(p.id),
                                      ).length
                                    }{" "}
                                    peserta dipilih
                                  </span>
                                  <button
                                    className="btn"
                                    disabled={busy || !selectedPeople.length}
                                    onClick={() =>
                                      setModal({ kind: "participant-schedule" })
                                    }
                                  >
                                    Atur sesi terpilih
                                  </button>
                                  <button
                                    className="btn"
                                    disabled={busy || !selectedPeople.length}
                                    onClick={() => setSelectedPeople([])}
                                  >
                                    Hapus pilihan
                                  </button>
                                </div>
                              </caption>
                            ) : null}
                            <TableHead>
                              <TableRow>
                                {admin ? (
                                  <TableCell component="th" scope="col">
                                    <input
                                      type="checkbox"
                                      aria-label="Pilih semua peserta sesuai filter, di semua halaman"
                                      disabled={busy}
                                      checked={
                                        visiblePeople.length > 0 &&
                                        visiblePeople.every((p) =>
                                          selectedPeople.includes(p.id),
                                        )
                                      }
                                      ref={(element) => {
                                        if (element)
                                          element.indeterminate =
                                            visiblePeople.some((p) =>
                                              selectedPeople.includes(p.id),
                                            ) &&
                                            !visiblePeople.every((p) =>
                                              selectedPeople.includes(p.id),
                                            );
                                      }}
                                      onChange={(event) =>
                                        setSelectedPeople(
                                          event.target.checked
                                            ? visiblePeople.map((p) => p.id)
                                            : [],
                                        )
                                      }
                                    />
                                  </TableCell>
                                ) : null}
                                <TableCell
                                  component="th"
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
                                </TableCell>
                                <TableCell
                                  component="th"
                                  scope="col"
                                  aria-sort={
                                    peopleSort === "number-asc"
                                      ? "ascending"
                                      : peopleSort === "number-desc"
                                        ? "descending"
                                        : "none"
                                  }
                                >
                                  <button
                                    type="button"
                                    className="table-sort"
                                    onClick={() =>
                                      setPeopleSort(
                                        peopleSort === "number-asc"
                                          ? "number-desc"
                                          : "number-asc",
                                      )
                                    }
                                  >
                                    No. peserta{" "}
                                    <span aria-hidden="true">
                                      <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                      >
                                        {peopleSort !== "number-desc" ? (
                                          <path d="m4 6 4-4 4 4" />
                                        ) : null}
                                        {peopleSort !== "number-asc" ? (
                                          <path d="m4 10 4 4 4-4" />
                                        ) : null}
                                      </svg>
                                    </span>
                                  </button>
                                </TableCell>
                                <TableCell
                                  component="th"
                                  scope="col"
                                  aria-sort={
                                    peopleSort === "session-asc"
                                      ? "ascending"
                                      : peopleSort === "session-desc"
                                        ? "descending"
                                        : "none"
                                  }
                                >
                                  <button
                                    type="button"
                                    className="table-sort"
                                    title="Urutkan berdasarkan waktu mulai sesi"
                                    onClick={() =>
                                      setPeopleSort(
                                        peopleSort === "session-asc"
                                          ? "session-desc"
                                          : "session-asc",
                                      )
                                    }
                                  >
                                    Sesi peserta{" "}
                                    <span aria-hidden="true">
                                      <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                      >
                                        {peopleSort !== "session-desc" ? (
                                          <path d="m4 6 4-4 4 4" />
                                        ) : null}
                                        {peopleSort !== "session-asc" ? (
                                          <path d="m4 10 4 4 4-4" />
                                        ) : null}
                                      </svg>
                                    </span>
                                  </button>
                                </TableCell>
                                <TableCell component="th">
                                  Hasil undian
                                </TableCell>
                                <TableCell component="th">Tindakan</TableCell>
                              </TableRow>
                            </TableHead>
                          </DataTable>
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
                          <DataTable
                            rows={data.sessions}
                            resetKey={"sessions"}
                            paginationDisabled={busy}
                            renderRow={(s) => (
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
                            )}
                            aria-label="Cabang dan sesi"
                            className="table sessions-table"
                          >
                            <TableHead>
                              <TableRow>
                                <TableCell component="th" scope="col">
                                  Cabang
                                </TableCell>
                                <TableCell component="th" scope="col">
                                  Paket
                                </TableCell>
                                <TableCell component="th" scope="col">
                                  Status
                                </TableCell>
                                <TableCell component="th" scope="col">
                                  Tindakan
                                </TableCell>
                              </TableRow>
                            </TableHead>
                          </DataTable>
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
                    <BankTable
                      packages={data.packages}
                      categories={data.categories}
                      people={data.people}
                      results={data.results}
                      busy={busy}
                      onView={(result) => setModal({ kind: "receipt", result })}
                      onEdit={(pack) =>
                        setModal({ kind: "package", package: pack })
                      }
                    />
                  ) : null}
                  {page === "accounts" && admin ? (
                    <section className="panel data-panel">
                      <DataTable
                        rows={data.profiles.filter(
                          (p) => p.role === "district",
                        )}
                        resetKey={"accounts"}
                        paginationDisabled={busy}
                        renderRow={(p) => (
                          <TableRow
                            key={p.id}
                            aria-busy={updating("account", p.id)}
                          >
                            <TableCell data-label="Kecamatan">
                              <strong>{p.district}</strong>
                            </TableCell>
                            <TableCell data-label="Nama pengguna">
                              {p.username}
                            </TableCell>
                            <TableCell data-label="Status">
                              <Badge>{p.active ? "Aktif" : "Nonaktif"}</Badge>
                            </TableCell>
                            <TableCell data-label="Tindakan">
                              <div className="actions">
                                <button
                                  className="btn"
                                  disabled={busy || !p.active}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Masuk sebagai Kecamatan " +
                                          p.district +
                                          "? Undian yang dilakukan akan disimpan sebagai hasil resmi atas nama kecamatan ini, dengan Anda sebagai admin pelaksana.",
                                      )
                                    )
                                      changeImpersonation(p.id);
                                  }}
                                >
                                  Masuk sebagai kecamatan
                                </button>
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
                            </TableCell>
                          </TableRow>
                        )}
                        aria-label="Akun kecamatan"
                        className="table"
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell component="th">Kecamatan</TableCell>
                            <TableCell component="th">Nama pengguna</TableCell>
                            <TableCell component="th">Status</TableCell>
                            <TableCell component="th">Tindakan</TableCell>
                          </TableRow>
                        </TableHead>
                      </DataTable>
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
                              <dt>No. peserta</dt>
                              <dd>
                                {participantNumber(
                                  selection.person.participant_number,
                                  category(selection.session.category_id),
                                )}
                              </dd>
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
                            <Receipt
                              result={drawResult}
                              person={data.people.find(
                                (p) => p.id === drawResult.person_id,
                              )}
                            />
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
                  {admin ? (
                    <ActivityLog active={page === "logs"} revision={rawData!} />
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
              "participant-schedule": "Atur sesi",
              person: modal.person ? "Edit peserta" : "Tambah peserta",
              detail: "Detail peserta",
              "delete-person": "Hapus peserta",
              "delete-history": modal.result
                ? "Hapus histori undian"
                : "Hapus seluruh histori undian",
              package: modal.package ? "Edit maqro" : "Tambah maqro",
              cancel: "Batalkan hasil undian",
              account: "Pengaturan akun",
              "district-account": modal.id
                ? "Edit akun kecamatan"
                : "Tambah akun kecamatan",
              password: "Ubah kata sandi",
              reset: "Reset kata sandi akun kecamatan",
              "toggle-account": "Ubah status akun",
              "open-sessions": allSessionsOpen
                ? "Tutup semua sesi"
                : "Buka semua sesi",
              receipt: "Bukti hasil undian",
            }[modal.kind] || "Konfirmasi"
          }
          close={close}
          busy={busy}
        >
          {errorBox}
          {modal.kind === "participant-schedule" && admin ? (
            <SessionScheduleForm
              people={
                modal.person
                  ? [modal.person]
                  : data.people.filter((p) => selectedPeople.includes(p.id))
              }
              busy={busy}
              onSave={(values) => {
                void act(
                  "participant-session",
                  values,
                  "Pengaturan sesi disimpan.",
                );
              }}
            />
          ) : null}
          {modal.kind === "delete-history" && admin ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void act(
                  "delete-history",
                  {
                    ids: modal.result
                      ? [modal.result.id]
                      : data.results.map((r) => r.id),
                  },
                  "Histori undian dihapus.",
                );
              }}
            >
              <p>
                {modal.result ? (
                  <>
                    Hapus hasil undian <strong>{modal.result.name}</strong>{" "}
                    untuk cabang <strong>{modal.result.category}</strong>,
                    materi <strong>{modal.result.surah}</strong> (
                    {modal.result.verses})?
                  </>
                ) : (
                  <>
                    Hapus seluruh{" "}
                    <strong>{data.results.length} hasil undian</strong> dari
                    semua peserta dan cabang, termasuk hasil yang dibatalkan?
                    Filter daftar peserta tidak membatasi penghapusan ini.
                  </>
                )}
              </p>
              <p className="notice">
                Histori dan bukti hasil dihapus permanen. Peserta tetap
                tersimpan dan dapat mengundi kembali jika sesinya dibuka. Paket
                maqro dapat digunakan kembali. Catatan aktivitas penghapusan
                tetap disimpan.
              </p>
              <label className="checkline">
                <input type="checkbox" required disabled={busy} /> Saya memahami
                bahwa histori yang dihapus tidak dapat dikembalikan.
              </label>
              <div className="dialog-actions actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={close}
                >
                  Batal
                </button>
                <button
                  className="btn danger"
                  disabled={busy || !data.results.length}
                >
                  {busy ? "Menghapus…" : "Hapus permanen"}
                </button>
              </div>
            </form>
          ) : null}
          {modal.kind === "delete-person" && modal.person && admin ? (
            <>
              <p>
                Hapus peserta <strong>{modal.person.name}</strong> dari
                kecamatan <strong>{modal.person.district}</strong>?
              </p>
              <p className="hint">
                Data peserta dan seluruh riwayat undiannya, termasuk hasil yang
                dibatalkan, akan dihapus permanen dan tidak dapat dikembalikan.
              </p>
              <div className="actions dialog-actions">
                <button className="btn" disabled={busy} onClick={close}>
                  Batal
                </button>
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      "delete-person",
                      { id: modal.person!.id },
                      "Data peserta dan riwayat undiannya dihapus.",
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
              <p className="hint">
                Isi nomor urut saja, misalnya 01. Kode cabang ditambahkan
                otomatis, misalnya TQ.A-01 untuk Tilawah Anak.
              </p>
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
                {allSessionsOpen
                  ? `Tutup semua ${data?.sessions.length} sesi? Peserta tidak dapat mengundi sampai sesi dibuka kembali.`
                  : `Buka ${readySessions.length} sesi yang sudah memiliki paket maqro? Setiap cabang memiliki satu sesi undian.`}
              </p>
              {!allSessionsOpen && blockedSessions.length ? (
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
                  disabled={busy || (!allSessionsOpen && !readySessions.length)}
                  onClick={() => void toggleAllSessions()}
                >
                  {allSessionsOpen ? "Tutup semua sesi" : "Buka sesi yang siap"}
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
                    participant_number: text(f, "participant_number"),
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
              <ParticipantEntryFields
                key={modal.person?.id || "new"}
                person={modal.person}
                categories={data.categories}
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
                  ["No. peserta", personNumbers(modal.person)],
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
                  { ...Object.fromEntries(f), id: modal.package?.id },
                  modal.package ? "Maqro diperbarui." : "Maqro ditambahkan.",
                );
              }}
            >
              <p className="hint">
                Masukkan paket resmi yang telah ditetapkan panitia. Semua kolom
                wajib diisi.
              </p>
              <Field label="Cabang" name="category_id">
                <select
                  name="category_id"
                  id="category_id"
                  required
                  defaultValue={modal.package?.category_id}
                  disabled={Boolean(
                    modal.package &&
                    data.results.some(
                      (r) => r.package_id === modal.package?.id,
                    ),
                  )}
                >
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {modal.package ? (
                <>
                  <input
                    type="hidden"
                    name="category_id"
                    value={modal.package.category_id}
                    disabled={
                      !data.results.some(
                        (r) => r.package_id === modal.package?.id,
                      )
                    }
                  />
                  <p className="hint">
                    Perubahan berlaku untuk undian berikutnya. Hasil undian lama
                    tetap tersimpan. Cabang dikunci jika maqro sudah pernah
                    diundi.
                  </p>
                </>
              ) : null}
              <Field
                label="Surah / materi"
                name="surah"
                value={modal.package?.surah}
              />
              <Field
                label="Ayat / rentang materi"
                name="verses"
                value={modal.package?.verses}
              />
              <button
                type="button"
                className="btn"
                onClick={close}
                disabled={busy}
              >
                Batal
              </button>
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
                <strong>{modal.result.name}</strong> · {modal.result.surah} ·{" "}
                {modal.result.verses}
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
              <Receipt
                result={modal.result}
                person={data.people.find(
                  (p) => p.id === modal.result?.person_id,
                )}
              />
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
    <TableRow aria-busy={updating} className="session-table-row">
      <TableCell data-label="Cabang">
        <strong>{name}</strong>
      </TableCell>
      <TableCell data-label="Paket">{count} paket</TableCell>
      <TableCell data-label="Status">
        <Badge>{s.open ? "Dibuka" : "Ditutup"}</Badge>
      </TableCell>
      <TableCell data-label="Tindakan">
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
      </TableCell>
    </TableRow>
  );
}
