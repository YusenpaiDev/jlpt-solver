/* Aturan pemberitahuan masa percobaan — lonceng/banner (peringatan.ts) dan
   popup Honix (HonixTurHost). Dipisah biar bisa dites tanpa React & Supabase
   (tests/peringatan-trial.test.mjs). */

import type { LangkahTur, TurState } from "./honix-tur";

/** Sisa trial segini (jam) ke bawah → peringatannya naik jadi genting. */
const TRIAL_GENTING_JAM = 48;

export interface AksesTrial { status: "trial" | "pro" | "expired"; trialUntil: string | null }

const FITUR = "Bank Soal, Choukai, Bunpou, Kotoba, dan Sensei AI";

const tanggalHabis = (iso: string) => new Date(iso).toLocaleDateString("id-ID",
  { weekday: "long", day: "numeric", month: "long" });

const sisaMs = (akses: AksesTrial | null | undefined, sekarang: Date) =>
  akses?.status === "trial" && akses.trialUntil ? Date.parse(akses.trialUntil) - sekarang.getTime() : NaN;

export interface PeringatanTrial {
  id: string;
  tingkat: "genting" | "ingat";
  ikon: string;
  judul: string;
  pesan: string;
  aksi: { label: string; href: string };
}

/** Orang harus tahu dari hari pertama kalau aksesnya cuma seminggu — bukan
    kaget di hari ke-8 pas semua halaman tiba-tiba dilempar ke /langganan. */
export function peringatanTrial(akses: AksesTrial | null | undefined, sekarang = new Date()): PeringatanTrial | null {
  const ms = sisaMs(akses, sekarang);
  if (!(ms > 0) || !akses?.trialUntil) return null;
  const sisaJam = Math.ceil(ms / 3_600_000);
  const sisaHari = Math.ceil(ms / 86_400_000);
  const genting = sisaJam <= TRIAL_GENTING_JAM;
  const sampai = tanggalHabis(akses.trialUntil);
  return {
    id: genting ? "trial-mau-habis" : "trial-aktif",
    tingkat: genting ? "genting" : "ingat",
    ikon: "⏳",
    judul: sisaJam <= 24
      ? `Masa percobaan habis ${sisaJam} jam lagi`
      : `Masa percobaan tinggal ${sisaHari} hari`,
    pesan: `${FITUR} kebuka penuh sampai ${sampai}. `
      + "Setelah itu, buat lanjut belajar perlu berlangganan Pro — progresmu tetap tersimpan.",
    aksi: { label: "Lihat paket Pro", href: "/premium" },
  };
}

/* ── Popup Honix ───────────────────────────────────────────────────────── */

/** Kunci di profiles.honix_settings.tur.halaman — popup "tinggal 2 hari" cukup
    sekali per akun, di perangkat mana pun. */
export const POPUP_TRIAL_HABIS = "popup-trial-habis";

/** Slide pembuka tur di kunjungan pertama, ganti "Hai, aku Honix!" biasa. */
export function langkahPembukaTrial(akses: AksesTrial | null | undefined, hari: number): LangkahTur | null {
  if (akses?.status !== "trial" || !akses.trialUntil) return null;
  return {
    target: null, pose: "senang", judul: `Kamu dapat ${hari} hari akses penuh!`,
    isi: `${FITUR} kebuka semua sampai ${tanggalHabis(akses.trialUntil)}. `
      + "Habis itu lanjut belajar pakai Pro ya. Sekarang aku ajak keliling sebentar, ±1 menit.",
  };
}

/** Sekali, pas sisa trial ≤ 48 jam. */
export function perluPopupTrial(akses: AksesTrial | null | undefined, tur: TurState, sekarang = new Date()): boolean {
  const ms = sisaMs(akses, sekarang);
  return ms > 0 && ms <= TRIAL_GENTING_JAM * 3_600_000 && !tur.halaman[POPUP_TRIAL_HABIS];
}

export function langkahPopupTrial(akses: AksesTrial, sekarang = new Date()): LangkahTur {
  const p = peringatanTrial(akses, sekarang);
  return {
    target: null, pose: "bangkit", judul: p?.judul ?? "Masa percobaan hampir habis",
    isi: `Setelah ${akses.trialUntil ? tanggalHabis(akses.trialUntil) : "itu"}, ${FITUR} kekunci. `
      + "Lanjut pakai Pro biar latihanmu gak putus — progresmu tetap tersimpan.",
  };
}
