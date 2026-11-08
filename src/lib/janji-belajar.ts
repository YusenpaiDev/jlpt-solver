/* "Janji di awal": kekejar gak sama waktu yang ada (handoff Rencana Belajar §5).
   SEMUA ANGKA DI SINI PLACEHOLDER: kebutuhan jam per level, faktor bolong 0.85,
   ambang 1.0 / 0.7. Ganti di sini aja kalau angka final udah ada. */

export type Penilaian = "ok" | "mepet" | "gak";

/** PLACEHOLDER: kebutuhan jam belajar di app per level. */
export const KEBUTUHAN_JAM: Record<string, number> = { N5: 40, N4: 60, N3: 90, N2: 130, N1: 180 };
/** PLACEHOLDER: asumsi bolong 15%. */
export const FAKTOR_BOLONG = 0.85;
export const AMBANG_KEKEJAR = 1.0;
export const AMBANG_MEPET = 0.7;

/** Tiga pace di onboarding. */
export const PACE = [
  { m: 10, e: "🌱", t: "Santai" },
  { m: 20, e: "🔥", t: "Rutin" },
  { m: 40, e: "⚡", t: "Serius" },
] as const;

export const LABEL: Record<Penilaian, [string, string]> = {
  ok: ["Kekejar", "Asal rutin, kamu siap sebelum ujian."],
  mepet: ["Mepet", "Bisa, tapi gak boleh sering bolong."],
  gak: ["Belum kekejar", "Mending dibenerin sekarang daripada kaget nanti."],
};

/** null = belum ada tanggal ujian (atau udah lewat) → "Belum bisa dihitung". */
export function penilaianJanji(level: string, sisaHari: number | null, menitPerHari: number) {
  if (sisaHari === null || sisaHari < 0) return null;
  const butuh = KEBUTUHAN_JAM[level] ?? KEBUTUHAN_JAM.N3;
  const jam = (sisaHari * menitPerHari / 60) * FAKTOR_BOLONG;
  const rasio = jam / butuh;
  const v: Penilaian = rasio >= AMBANG_KEKEJAR ? "ok" : rasio >= AMBANG_MEPET ? "mepet" : "gak";
  return { v, butuh, punya: Math.round(jam) };
}

/** Pace onboarding berikutnya yang lebih tinggi dari sekarang, atau null kalau udah paling tinggi. */
export function paceBerikut(menit: number) {
  return PACE.find(p => p.m > menit) ?? null;
}
