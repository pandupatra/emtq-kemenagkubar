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
    round: { type: "string", default: "Penyisihan" },
  },
});
if (!["Penyisihan", "Final"].includes(values.round))
  throw new Error("Pilih --round Penyisihan atau Final.");
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
if (values.round === "Final") {
  const keyOf = (p) => JSON.stringify([p.category_id, p.surah, p.verses]);
  const planned = [
    ...new Map(
      expanded.map((p) => {
        const row = {
          category_id: categoryIds.get(p.category),
          surah: p.surah,
          verses: p.verses,
        };
        return [keyOf(row), row];
      }),
    ).values(),
  ];
  async function readFinalPackages() {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db
        .from("final_packages")
        .select("id,category_id,surah,verses")
        .order("id")
        .range(offset, offset + 499);
      if (error)
        throw new Error(
          `Bank maqro Final belum dapat dimuat (${error.code}). Pastikan migrasi Final sudah diterapkan.`,
        );
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }
  const before = await readFinalPackages();
  const existing = new Set(before.map(keyOf));
  const pending = planned
    .filter((p) => !existing.has(keyOf(p)))
    .map((p) => {
      const hex = createHash("sha256")
        .update("maqro-final-v1:" + keyOf(p))
        .digest("hex");
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
      if (before.some((row) => row.id === id && keyOf(row) !== keyOf(p)))
        throw new Error(
          "ID paket Final berbenturan dengan data lain. Impor dibatalkan.",
        );
      return { id, ...p };
    });
  const summary = {
    round: "Final",
    target: "final_packages",
    packages: planned.length,
    pending: pending.length,
    skipped: planned.length - pending.length,
    categories: Object.fromEntries(
      [...new Set(expanded.map((p) => p.category))].map((name) => [
        name,
        planned.filter((p) => p.category_id === categoryIds.get(name)).length,
      ]),
    ),
  };
  if (values["dry-run"]) {
    console.log(
      JSON.stringify({ ...summary, dryRun: true, noWrites: true }, null, 2),
    );
    process.exit(0);
  }
  let added = [];
  if (pending.length) {
    const { data, error } = await db
      .from("final_packages")
      .upsert(pending, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`Impor maqro Final gagal (${error.code}).`);
    added = data;
  }
  const after = await readFinalPackages();
  if (planned.some((p) => !after.some((row) => keyOf(row) === keyOf(p))))
    throw new Error(
      "Verifikasi impor Final belum lengkap. Periksa bank maqro sebelum mengulangi.",
    );
  if (
    before.some(
      (p) => !after.some((row) => row.id === p.id && keyOf(row) === keyOf(p)),
    )
  )
    throw new Error(
      "Data lama berubah saat impor. Periksa perubahan bersamaan di bank maqro Final.",
    );
  console.log(
    JSON.stringify(
      { ...summary, added: added.length, verified: planned.length },
      null,
      2,
    ),
  );
  process.exit(0);
}
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
  throw new Error("Jalankan seluruh migrasi Supabase sebelum seed paket.");
const { data: added, error } = await db
  .from("packages")
  .upsert(rows, { onConflict: "seed_key", ignoreDuplicates: true })
  .select("id");
if (error)
  throw new Error(
    `Seed paket gagal (${error.code}). Tidak ada batch yang disimpan.`,
  );
console.log(
  JSON.stringify(
    {
      added: added.length,
      skipped: rows.length - added.length,
      example: input.example,
    },
    null,
    2,
  ),
);
