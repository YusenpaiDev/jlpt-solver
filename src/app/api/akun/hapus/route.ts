import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { klienAdmin } from "@/lib/supabase/admin";
import { TABEL_AKUN, cocokKonfirmasi, tabelGakAda } from "@/lib/akun-data";

/* Hapus akun permanen (Pengaturan → Danger Zone): semua data milik user,
   foto profil, lalu akun login-nya. Tabel inti dihapus satu-satu (gak ngandelin
   FK cascade yang skemanya gak ada di repo); kalau ada yang gagal, akun login
   GAK dihapus biar bisa diulang. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ pesan: "Masuk dulu." }, { status: 401 });
  const b = await req.json().catch(() => null) as { konfirmasi?: unknown } | null;
  if (!cocokKonfirmasi("hapus", b?.konfirmasi)) return NextResponse.json({ pesan: "Ketik HAPUS buat lanjut." }, { status: 400 });

  const admin = klienAdmin();
  const gagal: string[] = [];
  for (const t of TABEL_AKUN) {
    const { error } = await admin.from(t).delete().eq("user_id", user.id);
    if (error && !tabelGakAda(error)) { console.error(`[akun/hapus] ${t}:`, error.message); gagal.push(t); }
  }
  const { error: errProfil } = await admin.from("profiles").delete().eq("id", user.id);
  if (errProfil && !tabelGakAda(errProfil)) { console.error("[akun/hapus] profiles:", errProfil.message); gagal.push("profiles"); }
  if (gagal.length) return NextResponse.json({ pesan: "Sebagian data belum kehapus, akunmu belum dihapus. Coba lagi sebentar." }, { status: 500 });

  /* Foto profil (bucket avatars/<user id>/…). Gagal di sini gak nahan penghapusan akun. */
  const { data: foto } = await admin.storage.from("avatars").list(user.id);
  if (foto?.length) await admin.storage.from("avatars").remove(foto.map(f => `${user.id}/${f.name}`));

  const { error: errAuth } = await admin.auth.admin.deleteUser(user.id);
  if (errAuth) {
    console.error("[akun/hapus] auth:", errAuth.message);
    return NextResponse.json({ pesan: "Datamu udah kehapus, tapi akun login-nya gagal dihapus. Coba lagi sebentar." }, { status: 500 });
  }
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
