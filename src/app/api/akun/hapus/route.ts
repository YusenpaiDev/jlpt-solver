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

  /* Foto profil (bucket avatars/<user id>/…). Wajib bersih sebelum akun login
     dihapus — sesudahnya gak ada lagi yang bisa minta foto itu dihapus.
     Dihapus per 100 sampai folder kosong (batas putaran biar gak muter terus). */
  const avatars = admin.storage.from("avatars");
  for (let putaran = 0; putaran < 20; putaran++) {
    const { data: foto, error: eList } = await avatars.list(user.id, { limit: 100 });
    if (eList) {
      if (/bucket not found/i.test(eList.message)) break; // bucket-nya gak ada = gak ada foto
      console.error("[akun/hapus] avatars list:", eList.message);
      return NextResponse.json({ pesan: "Foto profilmu belum kehapus, akunmu belum dihapus. Coba lagi sebentar." }, { status: 500 });
    }
    if (!foto?.length) break;
    const { error: eHapus } = await avatars.remove(foto.map(f => `${user.id}/${f.name}`));
    if (eHapus) {
      console.error("[akun/hapus] avatars remove:", eHapus.message);
      return NextResponse.json({ pesan: "Foto profilmu belum kehapus, akunmu belum dihapus. Coba lagi sebentar." }, { status: 500 });
    }
  }

  const { error: errAuth } = await admin.auth.admin.deleteUser(user.id);
  if (errAuth) {
    console.error("[akun/hapus] auth:", errAuth.message);
    return NextResponse.json({ pesan: "Datamu udah kehapus, tapi akun login-nya gagal dihapus. Coba lagi sebentar." }, { status: 500 });
  }
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
