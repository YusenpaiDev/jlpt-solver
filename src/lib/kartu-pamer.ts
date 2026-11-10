/* Isi kartu pamer (handoff Rencana Belajar §11). Murni: semua tanggal YYYY-MM-DD lokal user. */

const BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BLS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export interface BahanKartu {
  hariIni: string;
  waktu: { tanggal: string; detik: number }[];
  aktivitas: { tanggal: string }[];
  streak: number;
  level: string;
  /** "Desember 2026", atau null kalau belum milih sesi. */
  sesiLabel: string | null;
  /** Total perkiraan tiap tes mini yang udah selesai (null = belum lengkap). */
  tesTotal: (number | null)[];
  nama: string | null;
}

export interface IsiKartu {
  jam: number;
  menit: number;
  streak: number;
  target: string;
  tesTerbaik: number | null;
  bulanLabel: string;
  kosongDepan: number;
  jumlahHari: number;
  /** aktif[i] = tanggal i+1 bulan ini ada belajar. */
  aktif: boolean[];
  hariBulan: number;
  tanggalLabel: string;
  nama: string | null;
}

export function susunKartu(b: BahanKartu): IsiKartu {
  const [y, m, d] = b.hariIni.split("-").map(Number);
  const awalBulan = `${b.hariIni.slice(0, 8)}`;
  const menit = b.waktu.reduce((n, w) => n + Math.round(Math.max(0, w.detik) / 60), 0);
  const jumlahHari = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const kosongDepan = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const aktif = Array.from({ length: jumlahHari }, () => false);
  const tandai = (t: string) => {
    if (!t.startsWith(awalBulan)) return;
    const i = Number(t.slice(8, 10)) - 1;
    if (i >= 0 && i < jumlahHari) aktif[i] = true;
  };
  b.waktu.filter(w => w.detik >= 60).forEach(w => tandai(w.tanggal));
  b.aktivitas.forEach(a => tandai(a.tanggal));
  const skor = b.tesTotal.filter((x): x is number => typeof x === "number");
  const nama = b.nama?.trim() ?? "";
  return {
    jam: Math.floor(menit / 60),
    menit,
    streak: Math.max(0, b.streak),
    target: b.sesiLabel ? `${b.level} · ${b.sesiLabel}` : b.level,
    tesTerbaik: skor.length ? Math.max(...skor) : null,
    bulanLabel: `${BLN[m - 1]} ${y}`,
    kosongDepan,
    jumlahHari,
    aktif,
    hariBulan: aktif.filter(Boolean).length,
    tanggalLabel: `${d} ${BLS[m - 1]} ${y}`,
    // Email gak pernah masuk kartu, walau ke-isi di kolom nama.
    nama: nama && !nama.includes("@") ? nama.slice(0, 24) : null,
  };
}
