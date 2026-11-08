/* Contekan strategi ujian per level + kartu teknik per jenis soal
   (handoff Rencana Belajar §6–7). Angka resmi dari jlpt.jp — cek ulang
   sebelum tiap sesi ujian. Yang ditandai PLACEHOLDER belum final. */

export type Level = "N1" | "N2" | "N3" | "N4" | "N5";
export type Bagian = "moji" | "goi" | "bunpou" | "dokkai" | "choukai";

export const NAMA_BAGIAN: Record<Bagian, string> = { moji: "文字", goi: "語彙", bunpou: "文法", dokkai: "読解", choukai: "聴解" };

export interface BagianSkor { k: string; s: string; max: number; min: number }
export interface BlokWaktu { k: string; m: number; c: Bagian; saran?: [string, number][] }
export interface StrategiLevel { lulus: number; aman: number; skor: BagianSkor[]; waktu: BlokWaktu[] }

/** PLACEHOLDER: target aman = nilai lulus + 15. */
export const BANTALAN_AMAN = 15;

const S3: BagianSkor[] = [
  { k: "言語知識", s: "文字・語彙・文法", max: 60, min: 19 },
  { k: "読解", s: "Membaca", max: 60, min: 19 },
  { k: "聴解", s: "Mendengar", max: 60, min: 19 },
];
const S2: BagianSkor[] = [
  { k: "言語知識・読解", s: "文字・語彙・文法・読解", max: 120, min: 38 },
  { k: "聴解", s: "Mendengar", max: 60, min: 19 },
];

const lv = (lulus: number, skor: BagianSkor[], waktu: BlokWaktu[]): StrategiLevel => ({ lulus, aman: lulus + BANTALAN_AMAN, skor, waktu });

/* "saran" = pembagian di dalam bagian gabungan (PLACEHOLDER). */
export const STRATEGI: Record<Level, StrategiLevel> = {
  N1: lv(100, S3, [{ k: "言語知識・読解", m: 110, c: "bunpou", saran: [["文字・語彙", 15], ["文法", 15], ["読解", 75], ["Cek ulang", 5]] }, { k: "聴解", m: 55, c: "choukai" }]),
  N2: lv(90, S3, [{ k: "言語知識・読解", m: 105, c: "bunpou", saran: [["文字・語彙", 14], ["文法", 16], ["読解", 70], ["Cek ulang", 5]] }, { k: "聴解", m: 50, c: "choukai" }]),
  N3: lv(95, S3, [{ k: "文字・語彙", m: 30, c: "moji" }, { k: "文法・読解", m: 70, c: "dokkai", saran: [["文法", 20], ["読解", 45], ["Cek ulang", 5]] }, { k: "聴解", m: 40, c: "choukai" }]),
  N4: lv(90, S2, [{ k: "文字・語彙", m: 25, c: "moji" }, { k: "文法・読解", m: 55, c: "dokkai", saran: [["文法", 20], ["読解", 30], ["Cek ulang", 5]] }, { k: "聴解", m: 35, c: "choukai" }]),
  N5: lv(80, S2, [{ k: "文字・語彙", m: 20, c: "moji" }, { k: "文法・読解", m: 40, c: "dokkai", saran: [["文法", 15], ["読解", 22], ["Cek ulang", 3]] }, { k: "聴解", m: 30, c: "choukai" }]),
};

export function strategiUntuk(level: string): StrategiLevel {
  return STRATEGI[(level in STRATEGI ? level : "N3") as Level];
}

export type JenisSoal = "kanji" | "bunpou" | "narabe" | "joho" | "naiyo" | "sokuji";
export interface Teknik { id: JenisSoal; sec: Bagian; t: string; i: string; tips: string[] }

export const TEKNIK: Teknik[] = [
  { id: "kanji", sec: "moji", t: "漢字読み", i: "Cara baca kanji", tips: ["Baca dalam hati, cek bunyi ゛ (dakuten) dan bunyi panjang (う / ー).", "Pilihan yang bunyinya mirip biasanya jebakan. Bandingin satu per satu.", "Gak yakin? Pilih, tandai, lanjut. Maks 30 detik per soal."] },
  { id: "bunpou", sec: "bunpou", t: "文法形式の判断", i: "Pilih bentuk tata bahasa", tips: ["Lihat kata tepat sebelum dan sesudah kurung. Bentuknya (辞書形, て形, ない形) sering langsung nyoret 2 pilihan.", "Baca ulang kalimat utuh pakai jawabanmu.", "Pola mirip? Ingat pembedanya, bukan artinya."] },
  { id: "narabe", sec: "bunpou", t: "文の組み立て", i: "Susun kalimat (★)", tips: ["Susun keempat kepingan dulu, baru cari posisi ★.", "Mulai dari pasangan yang pasti nyambung, mis. partikel + kata kerja.", "Tulis urutannya di kertas soal biar gak ketuker."] },
  { id: "joho", sec: "dokkai", t: "情報検索", i: "Cari informasi", tips: ["Baca pertanyaannya dulu, baru cari di teks atau tabel.", "Gak perlu baca semua. Cari kata kunci: tanggal, harga, syarat.", "Perhatikan catatan kecil (※). Jawabannya sering di situ."] },
  { id: "naiyo", sec: "dokkai", t: "内容理解", i: "Pahami isi bacaan", tips: ["Baca pertanyaan dulu biar tahu yang dicari.", "Jawaban biasanya parafrase, bukan kata yang sama persis dengan teks.", "Pendapat penulis sering ada di paragraf terakhir."] },
  { id: "sokuji", sec: "choukai", t: "即時応答", i: "Respons cepat", tips: ["Jawab begitu audio selesai. Soal berikutnya gak nunggu.", "Dengerin nadanya: nanya, nawarin, atau minta maaf.", "Ketinggalan? Tebak, lalu siap buat soal berikutnya."] },
];

/** Daftar jenis soal yang kartunya disembunyikan, dari user_metadata (bisa rusak / kosong). */
export function rapikanDisembunyikan(x: unknown): JenisSoal[] {
  if (!Array.isArray(x)) return [];
  const ada = new Set<string>(TEKNIK.map(t => t.id));
  return [...new Set(x.filter((v): v is JenisSoal => typeof v === "string" && ada.has(v)))];
}

export function aturDisembunyikan(daftar: JenisSoal[], jenis: JenisSoal, sembunyi: boolean): JenisSoal[] {
  const tanpa = daftar.filter(j => j !== jenis);
  return sembunyi ? [...tanpa, jenis] : tanpa;
}
