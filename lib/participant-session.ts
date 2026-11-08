import type { Person } from "./types";

export function participantSessionOpen(p: Person, now = Date.now()) {
  if (p.session_starts_at || p.session_ends_at) {
    return (
      !!p.session_starts_at &&
      !!p.session_ends_at &&
      now >= Date.parse(p.session_starts_at) &&
      now < Date.parse(p.session_ends_at)
    );
  }
  return p.session_open !== false;
}

export function participantSessionLabel(p: Person, now = Date.now()) {
  const format = (value: string) =>
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value)) + " WITA";
  if (!p.session_starts_at)
    return p.session_open === false ? "Ditutup · Manual" : "Dibuka · Manual";
  if (now < Date.parse(p.session_starts_at))
    return "Terjadwal · " + format(p.session_starts_at);
  if (!participantSessionOpen(p, now)) return "Ditutup · Jadwal berakhir";
  return "Dibuka · Berakhir " + format(p.session_ends_at!);
}
