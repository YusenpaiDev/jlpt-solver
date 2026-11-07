/* Sesi JLPT: Minggu pertama Juli dan Desember. Tanggal resmi diumumkan
   jlpt.jp tiap tahun; aturan Minggu pertama ini yang dipakai selama ini.

   exam_date di user_metadata disimpan sebagai tanggal lengkap YYYY-MM-DD.
   Akun lama dari onboarding masih punya "YYYY-MM"; rapikanTanggalUjian()
   meluruskannya ke tanggal ujian di bulan itu. */

export interface SesiUjian { label: string; iso: string; hari: number; }

const pad = (n: number) => String(n).padStart(2, "0");
const isoLokal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Minggu pertama di bulan itu (bulan 1–12), YYYY-MM-DD. */
export function mingguPertama(tahun: number, bulan: number): string {
  const d = new Date(tahun, bulan - 1, 1);
  d.setDate(1 + ((7 - d.getDay()) % 7));
  return isoLokal(d);
}

/** "Desember 2026" dari YYYY-MM-DD. */
export function labelSesi(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long" })} ${y}`;
}

/** Selisih hari kalender dari `sekarang` ke tanggal YYYY-MM-DD (lokal). */
export function hariMenuju(iso: string, sekarang: Date): number {
  const [y, m, d] = iso.split("-").map(Number);
  const tujuan = new Date(y, m - 1, d, 12);
  const dari = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate(), 12);
  return Math.round((tujuan.getTime() - dari.getTime()) / 86_400_000);
}

/** `n` sesi berikutnya, termasuk sesi yang jatuh hari ini. */
export function daftarSesiUjian(sekarang: Date, n = 4): SesiUjian[] {
  const out: SesiUjian[] = [];
  for (let y = sekarang.getFullYear(); out.length < n; y++) {
    for (const m of [7, 12]) {
      const iso = mingguPertama(y, m);
      const hari = hariMenuju(iso, sekarang);
      if (hari >= 0 && out.length < n) out.push({ label: labelSesi(iso), iso, hari });
    }
  }
  return out;
}

/** exam_date apa pun → YYYY-MM-DD, atau null kalau kosong / "none" / ngawur. */
export function rapikanTanggalUjian(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const bulan = /^(\d{4})-(\d{2})$/.exec(x);
  if (bulan) {
    const m = Number(bulan[2]);
    return m >= 1 && m <= 12 ? mingguPertama(Number(bulan[1]), m) : null;
  }
  const lengkap = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
  if (!lengkap) return null;
  const [y, m, d] = [Number(lengkap[1]), Number(lengkap[2]), Number(lengkap[3])];
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d ? x : null;
}
