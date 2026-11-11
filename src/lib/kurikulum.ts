/* Aturan kurikulum 26 minggu (HANDOFF-kurikulum §2, §5–12). Murni, tanpa
   Supabase. Angka aturan masuk lewat parameter `a` (isinya ATURAN di
   kurikulum-config.ts) biar tetap satu sumber PLACEHOLDER. */

import type { Aturan } from "./kurikulum-config";

export const JUMLAH_UNIT = 26;

export type Grup = "文字・語彙" | "文法" | "読解";
/** 11 jenis soal (tanpa 聴解). */
export const JENIS_SOAL: { k: string; g: Grup }[] = [
  { k: "漢字読み", g: "文字・語彙" }, { k: "表記", g: "文字・語彙" }, { k: "文脈規定", g: "文字・語彙" },
  { k: "言い換え類義", g: "文字・語彙" }, { k: "用法", g: "文字・語彙" },
  { k: "文法形式の判断", g: "文法" }, { k: "文の組み立て", g: "文法" }, { k: "文章の文法", g: "文法" },
  { k: "短文", g: "読解" }, { k: "中文・長文", g: "読解" }, { k: "情報検索", g: "読解" },
];

/* ── Tanggal (string YYYY-MM-DD, hitungan UTC biar gak geser zona waktu) ── */
const keHari = (t: string) => { const [y, m, d] = t.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };
const dariHari = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
export const tambahHari = (t: string, n: number) => dariHari(keHari(t) + n);
export const selisihHari = (dari: string, ke: string) => keHari(ke) - keHari(dari);
/** Senin di minggu tanggal itu. */
export function seninDari(t: string): string {
  const hari = keHari(t);
  const dow = (new Date(hari * 86_400_000).getUTCDay() + 6) % 7; // Senin = 0
  return dariHari(hari - dow);
}

/* ── Unit ── */
export interface Unit { u: number; kata: string[]; pola: string[]; jenis: [string, string] }

/** Ambil bergiliran dari tiap kelompok biar satu unit gak isinya satu baris kana doang. */
function giliran<T>(item: T[], grup: (x: T) => string): T[] {
  const per = new Map<string, T[]>();
  for (const x of item) { const g = grup(x); (per.get(g) ?? per.set(g, []).get(g)!).push(x); }
  const antre = [...per.values()];
  const out: T[] = [];
  for (let i = 0; out.length < item.length; i++) for (const a of antre) if (i < a.length) out.push(a[i]);
  return out;
}

/** Materi level dibagi rata ke 26 unit (±81 kata + 4 pola di N3) + 2 jenis soal fokus. */
export function susunUnit(
  kata: { word: string; group: string }[],
  pola: { pattern: string; functionGroup: string }[],
  n = JUMLAH_UNIT,
): Unit[] {
  const k = giliran(kata, w => w.group).map(w => w.word);
  const p = giliran(pola, x => x.functionGroup).map(x => x.pattern);
  const potong = <T,>(xs: T[], i: number) => xs.slice(Math.floor((i * xs.length) / n), Math.floor(((i + 1) * xs.length) / n));
  return Array.from({ length: n }, (_, i) => ({
    u: i + 1, kata: potong(k, i), pola: potong(p, i),
    jenis: [JENIS_SOAL[(2 * i) % 11].k, JENIS_SOAL[(2 * i + 1) % 11].k],
  }));
}

/* ── Posisi minggu ── */
export interface KurikulumUser { level: string; tanggal_mulai: string; unit_mulai: number; tanggal_ujian: string | null }

/** Unit yang lagi jalan (unit_mulai + minggu sejak mulai). > 26 = masa cadangan. */
export function unitSekarang(k: KurikulumUser, hariIni: string): number {
  const minggu = Math.floor(Math.max(0, selisihHari(seninDari(k.tanggal_mulai), hariIni)) / 7);
  return k.unit_mulai + minggu;
}

/** Senin–Minggu tiap unit; null kalau dilewati lewat tes penempatan. */
export function tanggalUnit(k: KurikulumUser, u: number): [string, string] | null {
  if (u < k.unit_mulai) return null;
  const a = tambahHari(seninDari(k.tanggal_mulai), (u - k.unit_mulai) * 7);
  return [a, tambahHari(a, 6)];
}

export const mingguKeUjian = (hariIni: string, ujian: string | null) =>
  ujian ? Math.max(0, Math.ceil(selisihHari(hariIni, ujian) / 7)) : null;

/* ── Status item & SRS ── */
export type StatusItem = "baru" | "belajar" | "hafal" | "dikuasai";
export interface Srs { status: StatusItem; tahap: number; jatuh_tempo: string | null }

/** Jawaban benar naik satu tahap (jadwal 1·3·7·21·60 hari); salah → balik besok. */
export function lanjutSrs(prev: Srs | undefined, benar: boolean, hariIni: string, interval: number[]): Srs {
  if (!benar) return { status: "belajar", tahap: 0, jatuh_tempo: tambahHari(hariIni, 1) };
  const tahap = Math.min(interval.length, (prev?.tahap ?? 0) + 1);
  const status: StatusItem = tahap >= interval.length ? "dikuasai" : tahap >= 3 ? "hafal" : "belajar";
  return { status, tahap, jatuh_tempo: tambahHari(hariIni, interval[tahap - 1]) };
}

/** Item yang belum punya baris SRS: tebak dari progres latihan lama. */
export function statusDariProgres(p?: { benar: number; salah: number }): StatusItem {
  if (!p || p.benar + p.salah === 0) return "baru";
  return p.benar >= 2 && p.benar > p.salah ? "hafal" : "belajar";
}

export type Empat = [number, number, number, number]; // dikuasai, hafal, belajar, baru
const URUT: StatusItem[] = ["dikuasai", "hafal", "belajar", "baru"];
export function hitungStatus(item: string[], status: (x: string) => StatusItem): Empat {
  const n: Empat = [0, 0, 0, 0];
  for (const x of item) n[URUT.indexOf(status(x))]++;
  return n;
}
export const dimulai = (e: Empat) => e[0] + e[1] + e[2];

export type StatusUnit = "skip" | "done" | "part" | "cur" | "next";
export function statusUnit(u: number, unitMulai: number, cur: number, kata: Empat, pola: Empat): StatusUnit {
  if (u < unitMulai) return "skip";
  if (u === cur) return "cur";
  if (u > cur) return "next";
  return kata[3] + pola[3] === 0 ? "done" : "part";
}

/* ── Tingkat per jenis soal ── */
export interface EvalTingkat { tingkat: number; arah: -1 | 0 | 1; akurasi: number | null }

export function evaluasiTingkat(riwayat: boolean[], tingkat: number, a: Aturan["tingkat"]): EvalTingkat {
  const r = riwayat.slice(-a.jendela);
  const akurasi = r.length ? r.filter(Boolean).length / r.length : null;
  if (akurasi == null || r.length < a.jendela) return { tingkat, arah: 0, akurasi };
  if (akurasi >= a.naik && tingkat < 3) return { tingkat: tingkat + 1, arah: 1, akurasi };
  if (akurasi < a.turun && tingkat > 1) return { tingkat: tingkat - 1, arah: -1, akurasi };
  return { tingkat, arah: 0, akurasi };
}

/** Teks status di halaman Keterampilan (§7). */
export function labelTingkat(e: EvalTingkat, tingkatSekarang: number, a: Aturan["tingkat"]): [string, "up" | "dn" | ""] {
  if (e.arah > 0) return [`Naik ke T${e.tingkat} mulai besok`, "up"];
  if (e.arah < 0) return [`Balik ke T${e.tingkat} dulu, biar fondasinya kuat`, "dn"];
  if (e.akurasi == null) return ["Belum ada jawaban", ""];
  if (tingkatSekarang === 1 && e.akurasi < a.turun) return ["Udah di T1 · dapat latihan tambahan", "dn"];
  if (e.akurasi >= a.naik - 0.05 && tingkatSekarang < 3) return [`Hampir naik · butuh ${Math.round(a.naik * 100)}%`, ""];
  return [`Tetap di T${tingkatSekarang}`, ""];
}

/* ── Misi harian kurikulum (§9) ── */
/** Materi baru per hari = unit ÷ 7, dibulatkan ke atas. */
export const materiPerHari = (unit: Unit) => ({ kata: Math.ceil(unit.kata.length / 7), pola: Math.ceil(unit.pola.length / 7) });

/* ── Tes penempatan (§5) ── */
export interface JawabanPenempatan { grup: Grup; unit: number | null; benar: boolean }
export interface PosisiBagian { k: Grup; benar: number; total: number; minggu: number }

/** Per bagian: minggu tertinggi u yang akurasi soal unit ≤ u masih ≥ ambang.
    Titik mulai = bagian paling awal (yang ikut unit), biar gak ada yang bolong. */
export function nilaiPenempatan(j: JawabanPenempatan[], a: Aturan["penempatan"]): { posisi: PosisiBagian[]; unitMulai: number } {
  const grup: Grup[] = ["文字・語彙", "文法", "読解"];
  const posisi = grup.map(k => {
    const isi = j.filter(x => x.grup === k);
    const unitIsi = isi.filter(x => x.unit != null).sort((p, q) => p.unit! - q.unit!);
    let minggu = 0;
    for (const u of [...new Set(unitIsi.map(x => x.unit!))]) {
      const sampai = unitIsi.filter(x => x.unit! <= u);
      if (sampai.filter(x => x.benar).length / sampai.length >= a.ambang) minggu = u; else break;
    }
    return { k, benar: isi.filter(x => x.benar).length, total: isi.length, minggu };
  });
  const ikut = posisi.filter(p => j.some(x => x.grup === p.k && x.unit != null));
  const awal = ikut.length ? Math.min(...ikut.map(p => p.minggu)) : 0;
  return { posisi, unitMulai: Math.min(JUMLAH_UNIT, awal + 1) };
}

/* ── Ulangan mingguan (§10) ── */
export interface HasilUlangan { benar: number; total: number; perBagian: Record<string, { benar: number; total: number }> }
export function nilaiUlangan(j: { bagian: string; benar: boolean }[]): HasilUlangan {
  const perBagian: HasilUlangan["perBagian"] = {};
  for (const x of j) { const b = (perBagian[x.bagian] ??= { benar: 0, total: 0 }); b.total++; if (x.benar) b.benar++; }
  return { benar: j.filter(x => x.benar).length, total: j.length, perBagian };
}

/* ── Perkiraan skor (§11) ── */
export interface SkorBagian { k: string; s: string; max: number; min: number }
export interface Perkiraan {
  siap: boolean; jawaban: number; kurang: number;
  bagian: { k: string; s: string; max: number; min: number; nilai: number; jawaban: number; aman: boolean; akurat: boolean }[];
  total: number; maks: number; lulus: number; diatasLulus: boolean;
}

/** perCat (文字/語彙/文法/読解/聴解 → {a, c}) dari 30 hari terakhir → skor per bagian resmi. */
export function perkiraanSkor(
  perCat: Record<string, { a: number; c: number }>,
  skor: SkorBagian[], lulus: number, a: Aturan["perkiraan"],
): Perkiraan {
  const isi = (k: string): string[] => {
    if (k === "言語知識") return ["文字", "語彙", "文法"];
    if (k === "言語知識・読解") return ["文字", "語彙", "文法", "読解"];
    return [k];
  };
  const bagian = skor.map(s => {
    const cats = isi(s.k);
    const n = cats.reduce((t, c) => t + (perCat[c]?.a ?? 0), 0);
    const b = cats.reduce((t, c) => t + (perCat[c]?.c ?? 0), 0);
    const nilai = n ? Math.round((b / n) * s.max) : 0;
    return { ...s, nilai, jawaban: n, aman: nilai >= s.min, akurat: n >= a.akurat };
  });
  const jawaban = bagian.reduce((t, b) => t + b.jawaban, 0);
  const siap = jawaban >= a.minTotal && bagian.every(b => b.jawaban >= a.minBagian);
  const total = bagian.reduce((t, b) => t + b.nilai, 0);
  return {
    siap, jawaban, kurang: Math.max(0, a.minTotal - jawaban), bagian, total,
    maks: skor.reduce((t, s) => t + s.max, 0), lulus,
    diatasLulus: total >= lulus && bagian.every(b => b.aman),
  };
}

/** Gabung perCat banyak sesi, cuma yang aktif dalam n hari sampai `hariIni` (buat tren per minggu juga). */
export function gabungPerCat(
  sesi: { stats?: { perCat?: Record<string, { a?: number; c?: number }>; last_practiced_at?: string } | null; created_at: string }[],
  hariIni: string, hari: number,
): Record<string, { a: number; c: number }> {
  const batas = tambahHari(hariIni, -hari);
  const out: Record<string, { a: number; c: number }> = {};
  for (const s of sesi) {
    const t = (s.stats?.last_practiced_at ?? s.created_at).slice(0, 10);
    if (t < batas || t > hariIni) continue;
    for (const [k, v] of Object.entries(s.stats?.perCat ?? {})) {
      const o = (out[k] ??= { a: 0, c: 0 });
      o.a += Math.max(0, v.a ?? 0); o.c += Math.max(0, v.c ?? 0);
    }
  }
  return out;
}

/* ── Simulasi bulanan (§12) ── */
/** Sabtu terakhir tiap bulan dari mulai sampai ujian + satu lagi 2 minggu sebelum ujian. */
export function jadwalSimulasi(mulai: string, ujian: string | null): string[] {
  if (!ujian) return [];
  const out: string[] = [];
  let [y, m] = mulai.split("-").map(Number);
  const batas = tambahHari(ujian, -14);
  for (let i = 0; i < 24; i++) {
    const akhir = new Date(Date.UTC(y, m, 0)); // hari terakhir bulan m
    const sabtu = new Date(akhir.getTime() - ((akhir.getUTCDay() + 1) % 7) * 86_400_000).toISOString().slice(0, 10);
    if (sabtu >= batas) break;
    if (sabtu >= mulai) out.push(sabtu);
    m++; if (m > 12) { m = 1; y++; }
  }
  if (batas >= mulai) out.push(batas);
  return out;
}

/** Tempo: menit dipakai vs target → teks (§12). */
export function tempo(menit: number | null, target: number, audio = false): { teks: string; cls: "ok" | "warn" | "" } {
  if (audio) return { teks: "Ikut audio", cls: "" };
  if (menit == null) return { teks: "Belum kecatat", cls: "" };
  const lewat = menit - target;
  return lewat > 0 ? { teks: `Lewat ${lewat} menit`, cls: "warn" } : { teks: `Lebih cepat ${-lewat} menit`, cls: "ok" };
}
