import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { klienAdmin } from "@/lib/supabase/admin";
import { TABEL_PROGRES, cocokKonfirmasi, tabelGakAda } from "@/lib/akun-data";

/* Reset progres (Pengaturan → Danger Zone): hapus riwayat soal, streak,
   kalender cap, status kata & pola. Kamus, catatan, XP, langganan aman.
   Service role karena setelah masa percobaan habis RLS biasa nolak DELETE;
   tetap cuma baris milik user yang login. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ pesan: "Masuk dulu." }, { status: 401 });
  const b = await req.json().catch(() => null) as { konfirmasi?: unknown } | null;
  if (!cocokKonfirmasi("reset", b?.konfirmasi)) return NextResponse.json({ pesan: "Ketik RESET buat lanjut." }, { status: 400 });

  const admin = klienAdmin();
  const gagal: string[] = [];
  for (const t of TABEL_PROGRES) {
    const { error } = await admin.from(t).delete().eq("user_id", user.id);
    if (error && !tabelGakAda(error)) { console.error(`[akun/reset] ${t}:`, error.message); gagal.push(t); }
  }
  if (gagal.length) return NextResponse.json({ pesan: "Sebagian progres belum kehapus. Coba lagi sebentar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
