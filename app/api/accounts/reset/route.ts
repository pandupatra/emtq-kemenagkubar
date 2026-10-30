import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
const schema = z.object({
  id: z.uuid(),
  password: z.string().min(12).max(128),
});
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !secret)
    return NextResponse.json(
      {
        error: "Reset kata sandi belum tersedia. Hubungi pengelola aplikasi.",
      },
      { status: 503 },
    );
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token)
      return NextResponse.json(
        { error: "Silakan masuk kembali." },
        { status: 401 },
      );
    const scoped = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error,
    } = await scoped.auth.getUser(token);
    if (error || !user)
      return NextResponse.json(
        { error: "Sesi tidak berlaku. Silakan masuk kembali." },
        { status: 401 },
      );
    const { data: profile } = await scoped
      .from("profiles")
      .select("role,active")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin" || !profile.active)
      return NextResponse.json(
        { error: "Tindakan hanya untuk panitia." },
        { status: 403 },
      );
    const body = schema.safeParse(await request.json());
    if (!body.success)
      return NextResponse.json(
        { error: "Pilih akun dan isi kata sandi 12 sampai 128 karakter." },
        { status: 400 },
      );
    const { data: target } = await scoped
      .from("profiles")
      .select("id,username")
      .eq("id", body.data.id)
      .eq("role", "district")
      .single();
    if (!target)
      return NextResponse.json(
        { error: "Akun kecamatan tidak ditemukan." },
        { status: 404 },
      );
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: ae } = await admin.auth.admin.updateUserById(target.id, {
      password: body.data.password,
    });
    if (ae)
      return NextResponse.json(
        {
          error:
            "Kata sandi belum dapat diperbarui. Coba lagi. Jika tetap gagal, hubungi pengelola aplikasi.",
        },
        { status: 400 },
      );
    const { error: le } = await admin.from("logs").insert({
      actor: user.id,
      message: `Kata sandi akun direset oleh panitia: ${target.username}`,
    });
    if (le)
      return NextResponse.json(
        {
          error:
            "Kata sandi diperbarui, tetapi catatan aktivitas gagal disimpan. Hubungi pengelola aplikasi.",
        },
        { status: 500 },
      );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Permintaan belum dapat diproses. Coba lagi. Jika tetap gagal, hubungi pengelola aplikasi.",
      },
      { status: 400 },
    );
  }
}
