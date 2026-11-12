/* Satu baris alasan per langkah misi (HANDOFF-alur-belajar §3), biar user
   paham sistemnya dari pemakaian. Murni — dites di tests/alasan-misi.test.mjs. */

/* Tanggal YYYY-MM-DD (UTC). Ditulis ulang di sini, bukan import dari
   kurikulum.ts — tes node gak bisa resolve import relatif tanpa ekstensi. */
const keHari = (t: string) => { const [y, m, d] = t.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };
const tambahHari = (t: string, n: number) => new Date((keHari(t) + n) * 86_400_000).toISOString().slice(0, 10);
const selisihHari = (dari: string, ke: string) => keHari(ke) - keHari(dari);

/* ── Langkah 1: ulang ── */

export function alasanTempo(n: number, hariPertama: boolean): string {
  if (hariPertama) return "Mulai besok, kata yang mulai lupa muncul di sini.";
  return n > 0 ? "Mulai lupa · jatuh tempo hari ini" : "Belum ada yang mulai lupa hari ini";
}

export interface ItemTempo { kunci: string; status: string; tahap: number; jatuh_tempo: string }

/** Detail "Kenapa 14 ini?": 3 teratas (paling lama nunggak) + sisanya. Jadwal 1·3·7·21·60, salah → 1 hari. */
export function detailTempo(item: ItemTempo[], hariIni: string, interval: number[], tampil = 3): { baris: [string, string][]; sisa: number } {
  const urut = [...item].sort((a, b) => a.jatuh_tempo.localeCompare(b.jatuh_tempo));
  const baris = urut.slice(0, tampil).map((x): [string, string] => {
    if (x.tahap <= 0) {
      const lalu = selisihHari(tambahHari(x.jatuh_tempo, -1), hariIni);
      return [x.kunci, `Salah ${lalu <= 1 ? "kemarin" : `${lalu} hari lalu`} · balik ke 1 hari`];
    }
    const jarak = interval[Math.min(x.tahap, interval.length) - 1];
    if (x.status === "hafal" || x.status === "dikuasai") return [x.kunci, `${x.status === "hafal" ? "Hafal" : "Dikuasai"} · cek lagi di hari ke-${jarak}`];
    const benar = selisihHari(tambahHari(x.jatuh_tempo, -jarak), hariIni);
    return [x.kunci, `Terakhir benar ${benar <= 0 ? "hari ini" : `${benar} hari lalu`} · jadwal ulang hari ke-${jarak}`];
  });
  return { baris, sisa: Math.max(0, item.length - baris.length) };
}

/** Misi versi Rencana Belajar (tanpa kurikulum): langkah 1 = yang sering salah. */
export function alasanSalah(kata: number, pola: number): string {
  if (kata + pola === 0) return "Semua lagi aman · gak ada yang sering salah";
  const isi = [kata ? `${kata} kata` : "", pola ? `${pola} pola` : ""].filter(Boolean).join(" & ");
  return `Sering salah · ${isi} salah ≥ 2×`;
}

/* ── Langkah 2: materi baru ── */

/** Hari ke-n dari 7 (Senin = 1). */
export const hariKe = (hariIni: string) => ((new Date(`${hariIni}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

export function alasanMateri(k: { label: string; hariIni: string; mulaiPenempatan: boolean; hariPertama: boolean }): string {
  if (k.hariPertama) return `${k.label} · ${k.mulaiPenempatan ? "titik mulai dari tes penempatanmu" : "mulai dari awal"}`;
  return `${k.label} · hari ke-${hariKe(k.hariIni)} dari 7`;
}

/* ── Langkah 3: latihan ──
   Latihan langkah 3 di app selalu soal 文法 (Latihan Kilat), jadi alasannya
   cuma nyebut bagian yang beneran dilatih; "paling dekat minimum" / "paling
   rendah" cuma dipakai kalau emang bener begitu. */

export interface BagianSkor { k: string; nilai: number; min: number }

export function alasanLatihan(x: {
  /** jenis soal yang baru naik tingkat (prioritas) */
  naik?: { jenis: string; t: number } | null;
  /** perkiraan skor udah bisa dihitung: semua bagian + bagian yang memuat 文法 */
  perkiraan?: { bagian: BagianSkor[]; dilatih: string } | null;
  /** akurasi 30 hari per kategori ({a: dijawab, c: benar}) */
  perCat?: Record<string, { a: number; c: number }>;
  /** kategori yang dilatih langkah ini */
  kategori: string;
  /** kurikulum (ada tingkat T1–T3) atau misi biasa */
  bertingkat: boolean;
  /** misi pertama kurikulum: semua mulai dari T1 */
  pertama?: boolean;
}): string {
  if (x.bertingkat && x.pertama) return "Mulai dari T1. Naik sendiri kalau benar ≥ 80%.";
  if (x.naik) return `${x.naik.jenis} baru naik ke T${x.naik.t}`;
  if (x.perkiraan) {
    const b = x.perkiraan.bagian.find(y => y.k === x.perkiraan!.dilatih);
    if (b) {
      const jarak = (y: BagianSkor) => y.nilai - y.min;
      const terdekat = x.perkiraan.bagian.every(y => jarak(b) <= jarak(y));
      return `${b.k} ${terdekat ? "paling dekat nilai minimum" : "dilatih biar makin aman"} · perkiraan ${b.nilai}, min ${b.min}`;
    }
  }
  const akurasi = (k: string) => { const v = x.perCat?.[k]; return v && v.a >= 10 ? v.c / v.a : null; };
  const a = akurasi(x.kategori);
  const v = x.perCat?.[x.kategori];
  if (a != null && v) {
    const lain = Object.keys(x.perCat ?? {}).map(akurasi).filter((y): y is number => y != null);
    const terendah = lain.every(y => a <= y);
    return `${x.kategori} akurasinya ${terendah ? "paling rendah · " : ""}${Math.round(a * 100)}% dari ${v.a} jawaban`;
  }
  return x.bertingkat ? "Mulai dari T1. Naik sendiri kalau benar ≥ 80%." : "Pola yang udah dihafal dipakai langsung di soal";
}
