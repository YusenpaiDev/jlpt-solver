/**
 * Batas Free vs Pro — SATU sumber buat server (kuota.ts) dan semua layar
 * yang nyebut angkanya: Pro aktif, /langganan, jatah habis, /langganan/berhenti,
 * Pengaturan. File ini sengaja gak import apa pun dari server, biar aman
 * di-bundle ke browser.
 *
 * Batas Free = janji di halaman harga. Batas Pro = rem biaya, bukan jualan.
 * Angka Pro DIPILIH DARI BIAYA, bukan dari rasa lega:
 *   furigana  Haiku, tapi max_tokens 4.000 dan sering dipanggil → diam-diam
 *             mahal kalau dibiarin di 500/hari.
 *   chat      max_tokens 280, paling murah per panggilan.
 *
 * Kalau salah satu angka di sini diubah, ubah juga daftar fitur & tabel
 * banding di src/app/premium/page.tsx — halaman itu nyebut angkanya terang
 * terangan, dan janji yang gak cocok sama kode itu yang bikin repot.
 */
export const BATAS = {
  chat:              { free: 5,  pro: 50  },
  furigana:          { free: 20, pro: 100 },
  "tugas-generate":  { free: 5,  pro: 30  },
} as const;

export type Fitur = keyof typeof BATAS;

export const NAMA_FITUR: Record<Fitur, string> = {
  chat: "Chat AI",
  furigana: "Furigana",
  "tugas-generate": "Lembar tugas AI",
};

/** Ditegakkan di DB lewat policy "saved_words: cap free" (kuota-free.sql). */
export const KOSAKATA_FREE = 50;

export const adalahFitur = (f: unknown): f is Fitur =>
  typeof f === "string" && f in BATAS;

/**
 * Kuota dihitung per tanggal WIB (lihat migrasi kuota-wib.sql), jadi reset
 * jam 00:00 WIB. Balikin ISO dengan offset +07:00 — bentuk yang dijanjiin
 * kontrak 429.
 */
export function resetBerikutnya(sekarang = new Date()): string {
  const wib = new Date(sekarang.getTime() + 7 * 3_600_000);
  const besok = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + 1));
  const y = besok.getUTCFullYear();
  const m = String(besok.getUTCMonth() + 1).padStart(2, "0");
  const d = String(besok.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00+07:00`;
}
