/* Tulis data kurikulum (tabel di supabase/migrations/20261111-kurikulum.sql).
   Semua no-op selama flag fiturnya belum nyala, biar gak nembak tabel yang
   mungkin belum ada di database. */

import { createClient } from "@/lib/supabase/client";
import { tanggalLokal } from "@/lib/aktivitas";
import { ATURAN, fiturLive } from "@/lib/kurikulum-config";
import { evaluasiTingkat, lanjutSrs, seninDari, tambahHari, type EvalTingkat, type PosisiBagian, type Srs } from "@/lib/kurikulum";

async function pengguna() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, uid: user.id } : null;
}

/** Mulai (atau mulai ulang) kurikulum dari unit tertentu — hasil tes penempatan / "Lewati". */
export async function mulaiKurikulum(level: string, unitMulai: number, tanggalUjian: string | null, penempatan?: { posisi: PosisiBagian[]; kata: number; pola: number }) {
  const u = await pengguna();
  if (!u) throw new Error("Belum login");
  const { error } = await u.supabase.from("kurikulum_user").upsert({
    user_id: u.uid, level, tanggal_mulai: seninDari(tanggalLokal()), unit_mulai: unitMulai, jumlah_unit: 26,
    tanggal_ujian: tanggalUjian, penempatan: penempatan ? { tanggal: tanggalLokal(), ...penempatan } : null,
    diperbarui: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Item unit yang dilewati lewat tes penempatan langsung ditandai dikuasai (tetap muncul sesekali). */
export async function tandaiDikuasai(level: string, item: { jenis: "kata" | "pola"; kunci: string }[]) {
  const u = await pengguna();
  if (!u || !item.length) return;
  const hariIni = tanggalLokal();
  const baris = item.map(x => ({
    user_id: u.uid, jenis: x.jenis, kunci: x.kunci, level, status: "dikuasai", tahap: ATURAN.srsInterval.length,
    jatuh_tempo: tambahHari(hariIni, ATURAN.srsInterval[ATURAN.srsInterval.length - 1]), diperbarui: new Date().toISOString(),
  }));
  for (let i = 0; i < baris.length; i += 500) {
    await u.supabase.from("item_status").upsert(baris.slice(i, i + 500), { onConflict: "user_id,jenis,kunci", ignoreDuplicates: true });
  }
}

/** Satu jawaban kata / pola → jadwal ulang berikutnya (1·3·7·21·60 hari). */
export async function catatItem(jenis: "kata" | "pola", kunci: string, level: string, benar: boolean): Promise<void> {
  if (!fiturLive("kurikulum")) return;
  try {
    const u = await pengguna();
    if (!u) return;
    const { data } = await u.supabase.from("item_status").select("status, tahap, jatuh_tempo")
      .eq("user_id", u.uid).eq("jenis", jenis).eq("kunci", kunci).maybeSingle();
    const next = lanjutSrs((data as Srs | null) ?? undefined, benar, tanggalLokal(), ATURAN.srsInterval);
    await u.supabase.from("item_status").upsert({
      user_id: u.uid, jenis, kunci, level, ...next, diperbarui: new Date().toISOString(),
    }, { onConflict: "user_id,jenis,kunci" });
  } catch { /* nyusul di jawaban berikutnya */ }
}

/** Satu jawaban per jenis soal → 20 jawaban terakhir → naik/turun tingkat mulai besok. */
export async function catatJenis(jenis: string, benar: boolean): Promise<EvalTingkat | null> {
  if (!fiturLive("kurikulum")) return null;
  try {
    const u = await pengguna();
    if (!u) return null;
    const { data } = await u.supabase.from("tingkat_jenis_soal").select("tingkat, riwayat").eq("user_id", u.uid).eq("jenis", jenis).maybeSingle();
    const riwayat = [...((data?.riwayat as boolean[] | null) ?? []), benar].slice(-ATURAN.tingkat.jendela);
    const e = evaluasiTingkat(riwayat, data?.tingkat ?? 1, ATURAN.tingkat);
    await u.supabase.from("tingkat_jenis_soal").upsert({
      user_id: u.uid, jenis, tingkat: e.tingkat,
      /* Ganti tingkat = mulai ngumpulin 20 jawaban baru di tingkat itu. */
      riwayat: e.arah === 0 ? riwayat : [],
      berlaku_mulai: e.arah === 0 ? undefined : tambahHari(tanggalLokal(), 1),
      diperbarui: new Date().toISOString(),
    }, { onConflict: "user_id,jenis" });
    return e;
  } catch { return null; }
}

export async function simpanUlangan(minggu: string, unit: number, h: { benar: number; total: number; perBagian: Record<string, { benar: number; total: number }> }, lupa: { jenis: string; kunci: string; arti: string; baca?: string }[]) {
  const u = await pengguna();
  if (!u) throw new Error("Belum login");
  const { error } = await u.supabase.from("ulangan").upsert({
    user_id: u.uid, minggu, unit, benar: h.benar, total: h.total, per_bagian: h.perBagian, item_lupa: lupa,
  }, { onConflict: "user_id,minggu" });
  if (error) throw error;
}

export type AlasanLapor = "kunci_salah" | "dua_benar" | "bahasa_aneh" | "lainnya";
export async function kirimLaporan(soalId: string, alasan: AlasanLapor, catatan: string) {
  const u = await pengguna();
  if (!u) throw new Error("Belum login");
  const { error } = await u.supabase.from("laporan_soal").insert({ soal_id: soalId.slice(0, 80), alasan, catatan: catatan.trim().slice(0, 1000) || null });
  if (error) throw error;
}

/* ── Simulasi bulanan ── */
export interface BarisSimulasi { n: number; tanggal: string; sesi: string[]; skor: { k: string; nilai: number; max: number }[] | null; menit: Record<string, number> | null }

export async function simpanSimulasi(b: BarisSimulasi) {
  const u = await pengguna();
  if (!u) throw new Error("Belum login");
  const { error } = await u.supabase.from("simulasi").upsert({ user_id: u.uid, ...b }, { onConflict: "user_id,n" });
  if (error) throw error;
}

/** Kata / pola yang jatuh tempo hari ini (buat langkah "Ulang yang jatuh tempo"). */
export async function jatuhTempo(jenis: "kata" | "pola", level: string): Promise<Set<string>> {
  if (!fiturLive("kurikulum")) return new Set();
  const u = await pengguna();
  if (!u) return new Set();
  const { data } = await u.supabase.from("item_status").select("kunci")
    .eq("user_id", u.uid).eq("jenis", jenis).eq("level", level).lte("jatuh_tempo", tanggalLokal());
  return new Set((data ?? []).map(r => r.kunci as string));
}
