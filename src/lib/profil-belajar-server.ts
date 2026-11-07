import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { susunProfilBelajar, type ProfilBelajar } from "@/lib/profil-belajar";
import { hariMenuju, rapikanTanggalUjian } from "@/lib/sesi-ujian";

const HARI = 86_400_000;
const tanggalWIB = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

/**
 * Ambil bahan profil belajar pakai sesi user sendiri (RLS: cuma barisnya).
 * Satu bagian gagal dibaca → bagian itu kosong, Sensei tetap jalan.
 */
export async function ambilProfilBelajar(supabase: SupabaseClient, user: User): Promise<ProfilBelajar> {
  const sekarang = new Date();
  const sejak30 = new Date(sekarang.getTime() - 30 * HARI).toISOString();
  const sejak7 = tanggalWIB(new Date(sekarang.getTime() - 6 * HARI));

  const [sesi, kotoba, bunpou, streak, waktu] = await Promise.all([
    supabase.from("sessions").select("stats:ai_result->stats").eq("user_id", user.id)
      .gte("created_at", sejak30).order("created_at", { ascending: false }).limit(300),
    supabase.from("kotoba_progress").select("word, benar, salah").eq("user_id", user.id)
      .gte("salah", 2).order("salah", { ascending: false }).limit(30),
    supabase.from("bunpou_progress").select("pattern, benar, salah").eq("user_id", user.id)
      .gte("salah", 2).order("salah", { ascending: false }).limit(30),
    supabase.rpc("streak_saya", { p_hari_ini: tanggalWIB(sekarang) }),
    supabase.from("waktu_belajar").select("detik").eq("user_id", user.id).gte("tanggal", sejak7),
  ]);

  const baris = Array.isArray(streak.data) ? streak.data[0] : streak.data;
  const md = user.user_metadata ?? {};
  const tglUjian = rapikanTanggalUjian(md.exam_date);
  return susunProfilBelajar({
    targetLevel: md.target_level,
    ujian: tglUjian ? { tanggal: tglUjian, sisa_hari: hariMenuju(tglUjian, sekarang) } : null,
    sesi: ((sesi.data ?? []) as { stats: unknown }[]).map(r => (r.stats ?? null) as BahanSesi),
    kotoba: kotoba.data ?? [],
    bunpou: bunpou.data ?? [],
    streak: typeof baris?.sekarang === "number" ? baris.sekarang : null,
    detik7Hari: ((waktu.data ?? []) as { detik: number }[]).reduce((n, r) => n + (r.detik ?? 0), 0),
  });
}

type BahanSesi = { perCat?: Record<string, { a?: number; c?: number }> } | null;
