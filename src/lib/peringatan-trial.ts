/* Aturan peringatan masa percobaan — dipisah dari peringatan.ts biar bisa dites
   tanpa React & Supabase (tests/peringatan-trial.test.mjs). */

/** Sisa trial segini (jam) ke bawah → peringatannya naik jadi genting. */
const TRIAL_GENTING_JAM = 48;

export interface AksesTrial { status: "trial" | "pro" | "expired"; trialUntil: string | null }

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
  if (akses?.status !== "trial" || !akses.trialUntil) return null;
  const sisaMs = Date.parse(akses.trialUntil) - sekarang.getTime();
  if (!(sisaMs > 0)) return null;
  const sisaJam = Math.ceil(sisaMs / 3_600_000);
  const sisaHari = Math.ceil(sisaMs / 86_400_000);
  const genting = sisaJam <= TRIAL_GENTING_JAM;
  const sampai = new Date(akses.trialUntil).toLocaleDateString("id-ID",
    { weekday: "long", day: "numeric", month: "long" });
  return {
    id: genting ? "trial-mau-habis" : "trial-aktif",
    tingkat: genting ? "genting" : "ingat",
    ikon: "⏳",
    judul: sisaJam <= 24
      ? `Masa percobaan habis ${sisaJam} jam lagi`
      : `Masa percobaan tinggal ${sisaHari} hari`,
    pesan: `Bank Soal, Choukai, Bunpou, Kotoba, dan Sensei AI kebuka penuh sampai ${sampai}. `
      + "Setelah itu, buat lanjut belajar perlu berlangganan Pro — progresmu tetap tersimpan.",
    aksi: { label: "Lihat paket Pro", href: "/premium" },
  };
}
