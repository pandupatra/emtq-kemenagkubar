"use client";
import { useId, useRef, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/id";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type { Person } from "@/lib/types";

dayjs.extend(utc);
dayjs.extend(timezone);
const sessionTimezone = "Asia/Makassar";

export default function SessionScheduleForm({
  people,
  busy,
  onSave,
}: {
  people: Person[];
  busy: boolean;
  onSave: (values: Record<string, unknown>) => void;
}) {
  const first = people[0];
  const same = people.every(
    (p) =>
      p.session_starts_at === first?.session_starts_at &&
      p.session_ends_at === first?.session_ends_at &&
      p.session_open === first?.session_open,
  );
  const [scheduled, setScheduled] = useState(
    same && !!first?.session_starts_at,
  );
  const [error, setError] = useState("");
  const manualStatusId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [start, setStart] = useState<Dayjs | null>(() =>
    same && first?.session_starts_at
      ? dayjs(first.session_starts_at).tz(sessionTimezone)
      : null,
  );
  const [end, setEnd] = useState<Dayjs | null>(() =>
    same && first?.session_ends_at
      ? dayjs(first.session_ends_at).tz(sessionTimezone)
      : null,
  );
  const [startInvalid, setStartInvalid] = useState(false);
  const [endInvalid, setEndInvalid] = useState(false);
  // Keep picker portals inside the native dialog's top layer.
  const pickerContainer = () =>
    formRef.current?.closest("dialog") ?? document.body;
  const rangeInvalid =
    !!start?.isValid() && !!end?.isValid() && !end.isAfter(start);
  return (
    <form
      ref={formRef}
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (
          scheduled &&
          (!start?.isValid() ||
            !end?.isValid() ||
            startInvalid ||
            endInvalid ||
            rangeInvalid)
        ) {
          setError(
            "Isi tanggal dan jam yang valid. Waktu selesai harus sesudah waktu mulai.",
          );
          return;
        }
        onSave({
          ids: people.map((p) => p.id),
          open: form.get("open") === "true",
          session_starts_at: scheduled
            ? start!.second(0).millisecond(0).toISOString()
            : null,
          session_ends_at: scheduled
            ? end!.second(0).millisecond(0).toISOString()
            : null,
        });
      }}
    >
      <p>
        {people.length === 1
          ? first.name
          : `Pengaturan diterapkan kepada ${people.length} peserta terpilih.`}
      </p>
      {!same ? (
        <p>
          Pengaturan sesi peserta terpilih berbeda-beda. Pilih pengaturan baru
          untuk seluruh peserta terpilih.
        </p>
      ) : null}
      <label className="checkline">
        <input
          type="checkbox"
          checked={scheduled}
          disabled={busy}
          onChange={(event) => setScheduled(event.target.checked)}
        />{" "}
        Jadwalkan sesi
      </label>
      {scheduled ? (
        <LocalizationProvider
          dateAdapter={AdapterDayjs}
          adapterLocale="id"
          localeText={{
            cancelButtonLabel: "Batal",
            okButtonLabel: "Pilih",
            clearButtonLabel: "Hapus",
            todayButtonLabel: "Hari ini",
            nextStepButtonLabel: "Berikutnya",
            dateTimePickerToolbarTitle: "Pilih tanggal dan jam",
            previousMonth: "Bulan sebelumnya",
            nextMonth: "Bulan berikutnya",
            dateTableLabel: "Tanggal",
            timeTableLabel: "Jam",
            year: "Tahun",
            month: "Bulan",
            day: "Tanggal",
            calendarViewSwitchingButtonAriaLabel: (view) =>
              view === "year" ? "Pilih tanggal" : "Pilih tahun",
            selectViewText: (view) =>
              view === "hours" ? "Pilih jam" : "Pilih menit",
            hoursClockNumberText: (hours) => `${hours} jam`,
            minutesClockNumberText: (minutes) => `${minutes} menit`,
            hours: "Jam",
            minutes: "Menit",
            seconds: "Detik",
            openDatePickerDialogue: (value) =>
              value
                ? `Ubah tanggal dan jam, ${value}`
                : "Pilih tanggal dan jam",
          }}
        >
          <div className="session-date-fields">
            <DateTimePicker
              label="Mulai"
              value={start}
              onChange={(value) => {
                setStart(value);
                setError("");
              }}
              onError={(value) => setStartInvalid(value !== null)}
              timezone={sessionTimezone}
              format="DD/MM/YYYY HH:mm"
              ampm={false}
              disabled={busy}
              desktopModeMediaQuery="@media (min-width: 768px) and (pointer: fine)"
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  helperText: startInvalid
                    ? "Tanggal atau jam tidak valid."
                    : "Waktu pembukaan · WITA",
                },
                popper: {
                  container: pickerContainer,
                  popperOptions: {
                    strategy: "fixed",
                    modifiers: [
                      {
                        name: "preventOverflow",
                        options: { altAxis: true, padding: 12 },
                      },
                    ],
                  },
                },
                dialog: { container: pickerContainer },
                desktopPaper: { className: "session-picker-paper" },
                mobilePaper: { className: "session-picker-paper" },
              }}
            />
            <DateTimePicker
              label="Selesai"
              value={end}
              onChange={(value) => {
                setEnd(value);
                setError("");
              }}
              onError={(value) => setEndInvalid(value !== null)}
              minDateTime={
                start?.isValid() ? start.add(1, "minute") : undefined
              }
              timezone={sessionTimezone}
              format="DD/MM/YYYY HH:mm"
              ampm={false}
              disabled={busy}
              desktopModeMediaQuery="@media (min-width: 768px) and (pointer: fine)"
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  error: endInvalid || rangeInvalid,
                  helperText:
                    endInvalid || rangeInvalid
                      ? "Waktu selesai harus sesudah waktu mulai."
                      : "Waktu penutupan · WITA",
                },
                popper: {
                  container: pickerContainer,
                  popperOptions: {
                    strategy: "fixed",
                    modifiers: [
                      {
                        name: "preventOverflow",
                        options: { altAxis: true, padding: 12 },
                      },
                    ],
                  },
                },
                dialog: { container: pickerContainer },
                desktopPaper: { className: "session-picker-paper" },
                mobilePaper: { className: "session-picker-paper" },
              }}
            />
          </div>
          <p>Semua waktu menggunakan WITA. Sesi cabang juga harus dibuka.</p>
        </LocalizationProvider>
      ) : (
        <div className="field">
          <label htmlFor={manualStatusId}>Status sesi</label>
          <select
            id={manualStatusId}
            name="open"
            required
            disabled={busy}
            defaultValue={
              same && !first?.session_starts_at
                ? String(first?.session_open !== false)
                : ""
            }
          >
            <option value="" disabled>
              Pilih status sesi
            </option>
            <option value="true">Dibuka</option>
            <option value="false">Ditutup</option>
          </select>
        </div>
      )}
      {!scheduled && first?.session_starts_at ? (
        <p>
          Setelah disimpan, jadwal dihapus dan sesi mengikuti status manual yang
          dipilih.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <button className="btn primary" disabled={busy || !people.length}>
        Simpan pengaturan
      </button>
    </form>
  );
}
