/** Pro dan trial aktif tidak memiliki kuota harian.
 * `free` hanya untuk membaca respons kuota dari versi aplikasi lama.
 * null berarti tanpa batas; jangan ganti dengan angka besar atau Infinity.
 */
export const BATAS = {
  chat: { free: 5, pro: null },
  furigana: { free: 20, pro: null },
  "tugas-generate": { free: 5, pro: null },
} as const;

export const TRIAL_HARI = 7;
export function statusAkses(dibuat: string | null | undefined, isPro: boolean, kini = Date.now()) {
  const mulai = dibuat ? Date.parse(dibuat) : NaN;
  const selesai = mulai + TRIAL_HARI * 86_400_000;
  const trialUntil = Number.isFinite(selesai) ? new Date(selesai).toISOString() : null;
  const trialAktif = Number.isFinite(mulai) && mulai <= kini && kini < selesai;
  const status = isPro ? "pro" : trialAktif ? "trial" : "expired";
  return { status, boleh: isPro || trialAktif, trialUntil } as const;
}

export type Fitur = keyof typeof BATAS;

export const NAMA_FITUR: Record<Fitur, string> = {
  chat: "Chat AI",
  furigana: "Furigana",
  "tugas-generate": "Lembar tugas AI",
};

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
