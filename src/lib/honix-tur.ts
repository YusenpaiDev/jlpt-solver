import type { HonixPose } from "./honix-pose";

/**
 * Tur Honix — cara pakai Sensei JLPT (spec 2026-10-09-honix-tur-design).
 * Sorot ikon menu navigasi satu per satu; file ini cuma data + keputusan
 * jadwal (murni, dites di tests/honix-tur.test.mjs). UI di HonixTur.tsx.
 */

/** Disimpan di profiles.honix_settings.tur. */
export interface TurState {
  /** ISO — terakhir tur selesai/dilewati atau tawaran dijawab. null = belum pernah. */
  terakhir: string | null;
  /** Tawaran bulanan nyala? */
  ingatkan: boolean;
  /** Tur per halaman yang udah dilihat: id → ISO. */
  halaman: Record<string, string>;
}

export const TUR_AWAL: TurState = { terakhir: null, ingatkan: true, halaman: {} };
export const HARI_TAWAR = 30;

export function rapikanTur(x: unknown): TurState {
  if (!x || typeof x !== "object") return TUR_AWAL;
  const o = x as Record<string, unknown>;
  const halaman: Record<string, string> = {};
  if (o.halaman && typeof o.halaman === "object") {
    for (const [k, v] of Object.entries(o.halaman)) if (typeof v === "string") halaman[k] = v;
  }
  return {
    terakhir: typeof o.terakhir === "string" ? o.terakhir : null,
    ingatkan: typeof o.ingatkan === "boolean" ? o.ingatkan : true,
    halaman,
  };
}

/** "tur" = putar otomatis, "tawar" = tanya di pojok, null = diam. */
export function keputusanTur(tur: TurState, kini: Date): "tur" | "tawar" | null {
  const lalu = tur.terakhir ? Date.parse(tur.terakhir) : NaN;
  if (Number.isNaN(lalu)) return "tur";
  if (!tur.ingatkan) return null;
  return kini.getTime() - lalu >= HARI_TAWAR * 86_400_000 ? "tawar" : null;
}

/** Tur halaman muncul otomatis sekali — tapi baru setelah tur menu beres,
    biar dua tur gak tabrakan di kunjungan pertama. */
export function keputusanTurHalaman(tur: TurState, id: string): boolean {
  if (!tur.terakhir || Number.isNaN(Date.parse(tur.terakhir))) return false;
  return !tur.halaman[id];
}

export interface LangkahTur {
  /** Nilai `data-tur` di item nav; null = balon di tengah layar. */
  target: string | null;
  pose: HonixPose;
  judul: string;
  isi: string;
}

const AWAL: LangkahTur = { target: null, pose: "senang", judul: "Hai, aku Honix!", isi: "Aku ajak keliling sebentar, cuma ±1 menit." };
const AKHIR: LangkahTur = { target: null, pose: "lulus", judul: "Siap!", isi: "Mulai dari Latihan Kilat?" };

const INTI: LangkahTur[] = [
  { target: "beranda", pose: "tunjuk", judul: "Beranda", isi: "Pusat harimu: target, streak, dan lanjut latihan." },
  { target: "materi", pose: "baca", judul: "Materi", isi: "Kotoba, Bunpou, Bank Soal 過去問, dan Choukai per level." },
  { target: "lembar-tugas", pose: "tunjuk", judul: "Lembar Tugas", isi: "Bikin set soal latihan dari materi pilihanmu." },
  { target: "kamus", pose: "tunjuk", judul: "Kamus", isi: "Simpan kata, terus hafalin pakai FLASH." },
];

export const LANGKAH_DESKTOP: LangkahTur[] = [
  AWAL, ...INTI,
  { target: "catatan", pose: "baca", judul: "Catatan", isi: "Tulis poin penting biar gampang diulang." },
  { target: "progres", pose: "terbang", judul: "Progres", isi: "Akurasi, kategori terlemah, dan riwayat latihanmu." },
  { target: "pengaturan", pose: "tunjuk", judul: "Pengaturan", isi: "Tur ini bisa kamu putar lagi di sini kapan aja." },
  AKHIR,
];

/** HP: Catatan, Progres, Pengaturan ada di sheet "Lainnya". */
export const LANGKAH_HP: LangkahTur[] = [
  AWAL, ...INTI,
  { target: "lainnya", pose: "tunjuk", judul: "Lainnya", isi: "Catatan, Progres, dan Pengaturan — tempat tur ini bisa diputar lagi." },
  AKHIR,
];

/** Bank Soal (/analisis-foto). Target = `data-tur` di halaman itu; yang gak
    kelihatan (panel kanan di bawah 1024px) dilewati otomatis. */
export const LANGKAH_BANKSOAL: LangkahTur[] = [
  { target: null, pose: "senang", judul: "Ruang latihan 過去問", isi: "Aku tunjukin alat-alatnya, ±1 menit." },
  { target: "bs-filter", pose: "tunjuk", judul: "Saring per bagian", isi: "全部 buat semua soal. 文字, 語彙, 文法, 読解 buat fokus satu bagian." },
  { target: "bs-furigana", pose: "baca", judul: "SOAL & OPSI", isi: "Nyalain furigana di teks soal, atau di keempat pilihan jawaban sekaligus." },
  { target: "bs-aksi", pose: "tunjuk", judul: "REVIEW & EDIT", isi: "Tandai soal buat diulang nanti. EDIT kalau ada teks soal yang salah." },
  { target: "bs-teks", pose: "tunjuk", judul: "Blok teksnya", isi: "Blok kata atau kalimat → Tanya Sensei, Simpan ke Kamus, Catat, atau Salin." },
  { target: "bs-jawaban", pose: "baca", judul: "Jawaban & pembahasan", isi: "Pilih jawaban dulu, baru buka. Di pembahasan ada Simpan ke Kamus per kosakata dan Simpan ke Catatan." },
  { target: "bs-panel-hp", pose: "tunjuk", judul: "Sensei, Kamus, Catatan", isi: "Ketuk tombol Sensei buat buka Sensei AI, Kamus, dan Catatan dari bawah layar." },
  { target: "bs-sensei", pose: "tunjuk", judul: "Sensei AI", isi: "Tanya apa aja soal ini — klik saran pertanyaan atau ketik sendiri." },
  { target: "bs-kamus", pose: "baca", judul: "Kamus", isi: "Ketik kata, cara baca & artinya dicariin otomatis, terus simpan." },
  { target: "bs-catatan", pose: "baca", judul: "Catatan", isi: "+ Baru buat catatan cepat. Catatan dari soal ngumpul di sini; buka semuanya di halaman Catatan." },
  { target: "bs-coret", pose: "tunjuk", judul: "Coret", isi: "Corat-coret di soal & bacaan, kayak di kertas ujian." },
  { target: "bs-sesi", pose: "terbang", judul: "Timer & Keluar", isi: "Timer bisa dimatiin. Progres tersimpan otomatis — keluar kapan aja." },
  { target: null, pose: "lulus", judul: "Selamat latihan!", isi: "Tur ini bisa diputar lagi lewat tombol ? di atas." },
];

/* Pemicu manual (Pengaturan, pratinjau dev, tombol ?) → host yang lagi kepasang. */
type Pemicu = "tur" | "tawar" | `halaman:${string}`;
const pendengar = new Set<(p: Pemicu) => void>();
export function dengarPemicuTur(f: (p: Pemicu) => void) {
  pendengar.add(f);
  return () => { pendengar.delete(f); };
}
export const mulaiTur = () => pendengar.forEach(f => f("tur"));
export const tawarkanTur = () => pendengar.forEach(f => f("tawar"));
export const mulaiTurHalaman = (id: string) => pendengar.forEach(f => f(`halaman:${id}`));
