import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const { values } = parseArgs({
  options: {
    file: { type: "string", default: "supabase/seed-packages.example.json" },
    "allow-examples": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});
const item = z
  .object({
    category: z.string().trim().min(1).optional(),
    surah: z.string().trim().min(1).max(100),
    verses: z.string().trim().min(1).max(100),
  })
  .strict();
const schema = z
  .object({
    example: z.boolean(),
    source: z.string().optional(),
    categories: z.array(z.string().trim().min(1)).optional(),
    packages: z.array(item).min(1).max(1000),
  })
  .strict();
const input = schema.parse(
  JSON.parse(await readFile(resolve(values.file), "utf8")),
);
if (input.example && !values["allow-examples"] && !values["dry-run"])
  throw new Error(
    "Data ini adalah contoh, bukan materi resmi. Gunakan --allow-examples hanya untuk pengujian atau --file untuk paket resmi.",
  );
const expanded = input.packages.flatMap((p) =>
  p.category
    ? [p]
    : (input.categories || []).map((category) => ({ ...p, category })),
);
if (
  !expanded.length ||
  input.packages.some((p) => !p.category && !input.categories?.length)
)
  throw new Error(
    "Setiap paket harus memiliki kategori atau daftar categories.",
  );
if (input.example && expanded.some((p) => !p.surah.startsWith("[CONTOH]")))
  throw new Error("Materi contoh wajib diawali [CONTOH].");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error("Isi URL Supabase dan service role key di .env.local.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: categories, error: ce } = await db
  .from("categories")
  .select("id,name");
if (ce) throw new Error(`Kategori belum dapat dimuat: ${ce.code}`);
const categoryIds = new Map(categories.map((c) => [c.name, c.id]));
const unknown = [
  ...new Set(
    expanded.filter((p) => !categoryIds.has(p.category)).map((p) => p.category),
  ),
];
if (unknown.length)
  throw new Error(
    `Kategori tidak tersedia: ${unknown.join(", ")}. Tidak ada paket ditambahkan.`,
  );
const rows = [
  ...new Map(
    expanded.map((p) => {
      const row = {
        category_id: categoryIds.get(p.category),
        surah: p.surah,
        verses: p.verses,
        seed_key:
          "maqro-package-v1:" +
          createHash("sha256")
            .update(JSON.stringify([p.category, p.surah, p.verses]))
            .digest("hex"),
      };
      return [row.seed_key, row];
    }),
  ).values(),
];
if (values["dry-run"]) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        example: input.example,
        packages: rows.length,
        categories: new Set(rows.map((r) => r.category_id)).size,
        noWrites: true,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const { error: check } = await db.from("packages").select("seed_key").limit(1);
if (check)
  throw new Error(
    "Jalankan migrasi 202610300001_automatic_package_codes.sql sebelum seed paket.",
  );
const { data: added, error } = await db
  .from("packages")
  .upsert(rows, { onConflict: "seed_key", ignoreDuplicates: true })
  .select("id,code");
if (error)
  throw new Error(
    `Seed paket gagal (${error.code}). Tidak ada batch yang disimpan.`,
  );
if (added.some((p) => !/^MQ-\d{6,}$/.test(p.code)))
  throw new Error("Format kode paket tidak sesuai. Periksa migrasi database.");
console.log(
  JSON.stringify(
    {
      added: added.length,
      skipped: rows.length - added.length,
      example: input.example,
      codes: added.map((p) => p.code),
    },
    null,
    2,
  ),
);
