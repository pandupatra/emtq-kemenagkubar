import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

const fields = {
  username: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  district: z.string().trim().min(1).max(100),
};
const createSchema = z.object({
  ...fields,
  password: z.string().min(12).max(128),
});
const editSchema = z.object({ ...fields, id: z.uuid() });
const reply = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

async function save(request: Request, creating: boolean) {
  const {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    SUPABASE_SERVICE_ROLE_KEY: secret,
  } = process.env;
  if (!url || !key || !secret)
    return reply(
      "Pengelolaan akun belum tersedia. Hubungi pengelola aplikasi.",
      503,
    );
  try {
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return reply("Silakan masuk kembali.", 401);
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    const scoped = createClient(url, key, {
      ...options,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await scoped.auth.getUser(token);
    if (authError || !user)
      return reply("Sesi tidak berlaku. Silakan masuk kembali.", 401);
    const { data: actor } = await scoped
      .from("profiles")
      .select("role,active")
      .eq("id", user.id)
      .single();
    if (actor?.role !== "admin" || !actor.active)
      return reply("Tindakan hanya untuk panitia.", 403);
    const parsed = (creating ? createSchema : editSchema).safeParse(
      await request.json(),
    );
    if (!parsed.success)
      return reply(
        "Isi kecamatan dan nama pengguna (huruf kecil, angka, atau tanda hubung). Kata sandi awal minimal 12 karakter.",
        400,
      );
    const input = parsed.data;
    const admin = createClient(url, secret, options);
    const id = "id" in input ? input.id : undefined;
    const { data: target } = id
      ? await admin
          .from("profiles")
          .select("*")
          .eq("id", id)
          .eq("role", "district")
          .single()
      : { data: null };
    if (!creating && !target)
      return reply("Akun kecamatan tidak ditemukan.", 404);
    const { data: conflicts, error: conflictError } = await admin
      .from("profiles")
      .select("id,username,district");
    if (conflictError)
      return reply("Data akun belum dapat diperiksa. Coba lagi.", 503);
    if (
      conflicts?.some(
        (p) =>
          p.id !== id &&
          (p.username.toLowerCase() === input.username ||
            p.district?.trim().toLowerCase() === input.district.toLowerCase()),
      )
    )
      return reply("Nama pengguna atau kecamatan sudah memiliki akun.", 409);
    // Check the migration before changing Supabase Auth.
    const { error: migrationError } = await admin.rpc("save_district_account", {
      account_id: "00000000-0000-0000-0000-000000000000",
      account_username: "migration-check",
      account_district: "migration-check",
      actor_id: user.id,
      creating: false,
      previous_username: null,
    });
    if (migrationError?.code === "PGRST202")
      return reply(
        "Jalankan migrasi 202610300003_district_accounts.sql terlebih dahulu.",
        503,
      );
    if (
      !migrationError ||
      migrationError.message !== "Akun kecamatan tidak ditemukan."
    )
      return reply(
        "Pengelolaan akun belum siap. Hubungi pengelola aplikasi.",
        503,
      );
    let accountId = id;
    const email = `${input.username}@accounts.maqro.invalid`;
    const changingUsername = !creating && target.username !== input.username;
    if (creating) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: "password" in input ? input.password : undefined,
        email_confirm: true,
      });
      if (error || !data.user)
        return reply(
          "Akun belum dapat dibuat. Nama pengguna mungkin sudah dipakai.",
          409,
        );
      accountId = data.user.id;
    } else if (changingUsername) {
      const { error } = await admin.auth.admin.updateUserById(accountId!, {
        email,
        email_confirm: true,
      });
      if (error)
        return reply(
          "Nama pengguna belum dapat diperbarui. Nama tersebut mungkin sudah dipakai.",
          409,
        );
    }
    const { data: profile, error } = await admin
      .rpc("save_district_account", {
        account_id: accountId,
        account_username: input.username,
        account_district: input.district,
        actor_id: user.id,
        creating,
        previous_username: target?.username ?? null,
      })
      .single();
    if (error) {
      const { data: current } =
        !creating && changingUsername
          ? await admin
              .from("profiles")
              .select("username")
              .eq("id", accountId!)
              .single()
          : { data: null };
      if (!creating && changingUsername && !current)
        return reply(
          "Status akun belum dapat diperiksa. Hubungi pengelola aplikasi sebelum mengubah akun ini lagi.",
          500,
        );
      const rollback = creating
        ? await admin.auth.admin.deleteUser(accountId!)
        : changingUsername
          ? await admin.auth.admin.updateUserById(accountId!, {
              email: `${current!.username}@accounts.maqro.invalid`,
              email_confirm: true,
            })
          : { error: null };
      if (rollback.error)
        return reply(
          "Data akun belum sinkron. Hubungi pengelola aplikasi sebelum mengubah akun ini lagi.",
          500,
        );
      return reply(
        error.code === "23505"
          ? "Nama pengguna atau kecamatan sudah memiliki akun."
          : "Akun belum tersimpan. Muat ulang data akun lalu coba lagi.",
        409,
      );
    }
    return NextResponse.json({ profile });
  } catch {
    return reply("Permintaan belum dapat diproses. Coba lagi.", 400);
  }
}

export const POST = (request: Request) => save(request, true);
export const PATCH = (request: Request) => save(request, false);
