import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error("Isi URL Supabase dan service role key di .env.local.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const raw = await readFile(new URL("../AKUN.md", import.meta.url), "utf8");
const accounts = [
  ...raw.matchAll(
    /(?:LPTQ KEC\. ([^\r\n]+)|PANITIA)\s+Username:\s*(\S+)\s+Password:\s*(\S+)/g,
  ),
];
if (accounts.length !== 15)
  throw new Error(
    "AKUN.md harus memuat panitia dan 14 kecamatan. Tidak ada perubahan dibuat.",
  );
for (const [, district, username, password] of accounts) {
  const { data: existing, error: lookup } = await db
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (lookup) throw new Error("Jalankan migrasi database terlebih dahulu.");
  if (existing) {
    console.log(`Lewati akun yang sudah ada: ${username}`);
    continue;
  }
  const email = `${username}@accounts.maqro.invalid`;
  let { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    if (
      !["email_exists", "email_conflict", "user_already_exists"].includes(
        error.code,
      )
    )
      throw new Error(
        `Pembuatan akun ${username} gagal: ${error.code || error.status}`,
      );
    let page = 1;
    while (!data?.user) {
      const { data: list, error: le } = await db.auth.admin.listUsers({
        page,
        perPage: 100,
      });
      if (le) throw le;
      const user = list.users.find((u) => u.email === email);
      if (user) {
        data = { user };
        break;
      }
      if (list.users.length < 100)
        throw new Error(`Akun ${username} perlu diperiksa di Supabase Auth.`);
      page++;
    }
  }
  const { error: pe } = await db.from("profiles").insert({
    id: data.user.id,
    username,
    district: district?.trim() || null,
    role: district ? "district" : "admin",
  });
  if (pe) throw new Error(`Profil ${username} gagal dibuat: ${pe.code}`);
  console.log(`Akun dibuat: ${username}`);
}
console.log("Selesai. Tidak ada kata sandi yang ditulis ke log.");
