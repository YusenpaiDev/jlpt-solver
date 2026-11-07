import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { kirimEmailAdmin } from "@/lib/email-admin";
import { GANTI_PER_HARI, cekAlasan, isiEmailGantiTarget, levelValid } from "@/lib/ganti-target";

/* Catat alasan ganti level target + kabari admin. Dipanggil Pengaturan
   SEBELUM levelnya disimpan: kalau ini gagal, levelnya gak ikut berubah. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ pesan: "Masuk dulu." }, { status: 401 });

  const b = await req.json().catch(() => null) as { ke?: unknown; alasan?: unknown } | null;
  if (!b || !levelValid(b.ke)) return NextResponse.json({ pesan: "Level gak dikenal." }, { status: 400 });
  const cek = cekAlasan(b.alasan);
  if (!cek.ok) return NextResponse.json({ pesan: cek.pesan }, { status: 400 });

  const md = user.user_metadata ?? {};
  const dari = levelValid(md.target_level) ? md.target_level : null;
  if (dari === b.ke) return NextResponse.json({ pesan: "Levelnya sama dengan target sekarang." }, { status: 400 });

  const sehariLalu = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error: errHitung } = await supabase.from("ganti_target")
    .select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("dibuat", sehariLalu);
  if (errHitung) {
    console.error("[ganti-target] hitung:", errHitung.message);
    return NextResponse.json({ pesan: "Belum bisa disimpan. Coba lagi sebentar." }, { status: 500 });
  }
  if ((count ?? 0) >= GANTI_PER_HARI) {
    return NextResponse.json({ pesan: "Target sudah diganti 5 kali hari ini. Coba lagi besok." }, { status: 429 });
  }

  const { error } = await supabase.from("ganti_target")
    .insert({ user_id: user.id, dari, ke: b.ke, alasan: cek.alasan });
  if (error) {
    console.error("[ganti-target] simpan:", error.message);
    return NextResponse.json({ pesan: "Belum bisa disimpan. Coba lagi sebentar." }, { status: 500 });
  }

  const nama = typeof md.full_name === "string" ? md.full_name : typeof md.username === "string" ? md.username : null;
  const { subjek, teks } = isiEmailGantiTarget({ email: user.email ?? null, nama, dari, ke: b.ke, alasan: cek.alasan });
  await kirimEmailAdmin(subjek, teks);

  return new NextResponse(null, { status: 204 });
}
