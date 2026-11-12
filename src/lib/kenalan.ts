/* Kartu kenalan (HANDOFF-alur-belajar §4 C): penjelasan kecil yang muncul
   sekali, pas fiturnya pertama kepakai. Aturan murni di sini (dites di
   tests/kenalan.test.mjs); komponennya KartuKenalan.tsx.

   Data: kenalan_dilihat disimpan di profiles.honix_settings.tur.halaman
   dengan kunci `kenalan:{id}` (gak butuh kolom baru). Hitungan "udah dipakai
   n kali" cukup di localStorage — kalau hilang, paling kartunya muncul lagi. */

export type IdKenalan = "senin" | "simulasi" | "perkiraan" | "bebas_bank" | "bebas_tugas";

/** Kapan onboarding beres (localStorage, ms). */
export const KUNCI_OB_SELESAI = "honix:onboarding-selesai";
export const KUNCI_PAKAI = "honix:kenalan-pakai";
/** Gak muncul selama n ms pertama setelah onboarding. */
export const TAHAN_MS = 3000;
/** Fitur udah dipakai sebanyak ini tanpa kartunya ditutup → anggap udah paham. */
export const BATAS_PAKAI = 3;

export const kunciKenalan = (id: IdKenalan) => `kenalan:${id}`;

export function bolehKenalan(k: {
  /** fiturnya udah live */
  live: boolean;
  /** pernah ditutup (timestamp) */
  dilihat: string | undefined;
  /** berapa kali fitur ini kepakai SEBELUM kunjungan ini */
  pakai: number;
  turJalan: boolean;
  obSelesai: number | null;
  kini: number;
}): boolean {
  if (!k.live || k.dilihat || k.turJalan) return false;
  if (k.pakai >= BATAS_PAKAI) return false;
  if (k.obSelesai != null && k.kini - k.obSelesai < TAHAN_MS) return false;
  return true;
}

export const TEKS_KENALAN: Record<IdKenalan, [string, string]> = {
  senin: ["Pertama kali · Ulangan mingguan", "Tiap Senin ada ulangan **±10 menit**: materi & yang salah minggu lalu, ditanya ulang dalam bentuk baru. Hasilnya ngatur isi misi minggu ini. Dilewati juga gak apa-apa."],
  simulasi: ["Pertama kali · Simulasi bulanan", "Simulasi pakai **set latihan format JLPT** dari Bank Soal: susunan & waktunya kayak ujian, tapi waktunya cuma dicatat. Set yang kamu kerjain di sini ikut nyalain pos di Bank Soal."],
  perkiraan: ["Baru kebuka · Perkiraan skor", "Jawabanmu udah cukup (150), jadi Honix bisa ngira skormu **kalau ujiannya hari ini**. Ini perkiraan, bukan skor resmi. Makin banyak jawaban, makin akurat."],
  bebas_bank: ["Pertama kali · Latihan bebas", "Ini tempat latihan bebas. **Misi harianmu tetap jalan** di Beranda, dan semua yang kamu kerjain di sini tetap kecatat di progres."],
  bebas_tugas: ["Pertama kali · Latihan bebas", "Ini tempat latihan bebas. **Misi harianmu tetap jalan** di Beranda, dan semua yang kamu kerjain di sini tetap kecatat di progres."],
};
