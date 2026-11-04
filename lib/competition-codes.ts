// Source: NOMOR PESERTA MTQ.xlsx, rows 4–24.
const competitions: [string, string[]][] = [
  ["TQ.T", ["Tartil", "Tartil Al-Qur'an"]],
  ["TQ.A", ["Tilawah Anak", "Tilawah Anak-Anak"]],
  ["TQ.R", ["Tilawah Remaja"]],
  ["TQ.D", ["Tilawah Dewasa"]],
  ["Q.ML.R", ["Qiro'at Murottal Remaja", "Qira'at Murattal Remaja"]],
  ["Q.ML.D", ["Qiro'at Murottal Dewasa", "Qira'at Murattal Dewasa"]],
  ["Q.MD.R", ["Qiro'at Mujawwad Remaja", "Qira'at Mujawwad Remaja"]],
  ["Q.MD.D", ["Qiro'at Mujawwad Dewasa", "Qira'at Mujawwad Dewasa"]],
  ["HQ.1", ["Tahfidz 1 Juz", "1 Juz dan Tilawah"]],
  ["HQ.5", ["Tahfidz 5 Juz", "5 Juz dan Tilawah"]],
  ["HQ.10", ["Tahfidz 10 Juz", "10 Juz"]],
  ["HQ.20", ["Tahfidz 20 Juz", "20 Juz"]],
  ["HQ.30", ["Tahfidz 30 Juz", "30 Juz"]],
  ["FQ", ["Fahmil", "Fahmil Qur'an"]],
  ["SY.Q", ["Syarhil", "Syarhil Qur'an"]],
  ["KQ.N", ["Naskah", "Kaligrafi Naskah"]],
  ["KQ.H", ["Hiasan Mushaf", "Kaligrafi Hiasan Mushaf"]],
  ["KQ.D", ["Dekorasi", "Kaligrafi Dekorasi"]],
  ["KQ.K", ["Kontemporer", "Kaligrafi Kontemporer"]],
  ["KQ.DL", ["Kaligrafi Digital"]],
  ["MH", ["KTIQ (Makalah Hadits)"]],
];

const normalize = (name: string) =>
  name.toLocaleLowerCase("id").replace(/[^a-z0-9]/g, "");

const codes = new Map(
  competitions.flatMap(([code, names]) =>
    names.map((name) => [normalize(name), code] as const),
  ),
);

export function competitionCode(name: string): string | undefined {
  return codes.get(normalize(name));
}

export function participantNumber(
  number: string | null | undefined,
  category: string,
): string {
  const value = number?.trim();
  if (!value) return "—";
  const code = competitionCode(category);
  if (!code) return value;
  // Accept older values that already include an official competition code.
  const existingCode = competitions.find(([prefix]) =>
    value.toUpperCase().startsWith(`${prefix}-`),
  );
  const serial = existingCode ? value.slice(existingCode[0].length + 1) : value;
  return `${code}-${serial}`;
}
