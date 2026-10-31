import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { apakahAdmin } from "@/lib/admin/hitung";

/**
 * Hapus akun permanen (Pengaturan → Danger Zone). Cuma buat diri sendiri:
 * user harus login dan ngetik ulang email akunnya.
 *
 * Hampir semua tabel ikut kehapus lewat FK `on delete cascade` dari
 * auth.users/profiles (sessions, saved_words, progres, aktivitas, ai_usage,
 * transaksi, …). `catatan` dibikin di luar repo — gak dijamin cascade, jadi
 * dihapus duluan. Foto profil di storage juga dihapus manual.
 *
 * Akun admin DITOLAK: bank_soal (bank soal bersama) nempel ke sesi akun owner
 * lewat cascade — kalau akunnya kehapus, bank soal semua orang ikut hilang.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Login dulu." }, { status: 401 });

  const body = await req.json().catch(() => null) as { konfirmasi?: unknown } | null;
  const konfirmasi = typeof body?.konfirmasi === "string" ? body.konfirmasi.trim().toLowerCase() : "";
  if (konfirmasi !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Email konfirmasi gak cocok." }, { status: 400 });
  }
  if (apakahAdmin(user.email, process.env.ADMIN_EMAILS)) {
    return NextResponse.json({ error: "Akun admin gak bisa dihapus dari sini — bank soal bersama nempel ke akun ini." }, { status: 403 });
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SECRET_KEY!.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: catatanErr } = await admin.from("catatan").delete().eq("user_id", user.id);
  if (catatanErr) {
    console.error("[akun/hapus] catatan:", catatanErr.message);
    return NextResponse.json({ error: "Gagal menghapus data. Coba lagi atau email kami." }, { status: 500 });
  }

  const { data: foto } = await admin.storage.from("avatars").list(user.id);
  if (foto?.length) await admin.storage.from("avatars").remove(foto.map(f => `${user.id}/${f.name}`));

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[akun/hapus] deleteUser:", error.message);
    return NextResponse.json({ error: "Gagal menghapus akun. Coba lagi atau email kami." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
