/* Status belajar per kata / pola — satu sumber buat /materi, /materi/kotoba,
   /materi/bunpou. Datanya dari kotoba_progress & bunpou_progress (benar/salah). */

export type Status = "known" | "seen" | "wrong" | "new";
export interface Hitungan { benar: number; salah: number }

/** Kotoba: lebih sering salah → wrong; benar ≥2 & unggul → known; sisanya seen.
    Sengaja butuh 2× benar buat "dikuasai" — sekali bener bisa cuma nebak. */
export function statusKata(p?: Hitungan): Status {
  if (!p || p.benar + p.salah === 0) return "new";
  if (p.salah > p.benar) return "wrong";
  if (p.benar >= 2 && p.benar > p.salah) return "known";
  return "seen";
}

/** Bunpou: salah ≥2 & lebih sering salah → wrong; benar ≥3 & unggul → known. */
export function statusPola(p?: Hitungan): Status {
  if (!p || p.benar + p.salah === 0) return "new";
  if (p.salah >= 2 && p.salah > p.benar) return "wrong";
  if (p.benar >= 3 && p.benar > p.salah) return "known";
  return "seen";
}

/** [dikuasai, pernah muncul, sering salah, baru] — urutan bar & legenda. */
export type Empat = [number, number, number, number];
const URUT: Status[] = ["known", "seen", "wrong", "new"];

export function hitungEmpat<T>(item: T[], status: (x: T) => Status): Empat {
  const n: Empat = [0, 0, 0, 0];
  for (const x of item) n[URUT.indexOf(status(x))]++;
  return n;
}

/** "x% dimulai" = (dikuasai + pernah muncul) / total. */
export function persenDimulai(e: Empat): number {
  const t = e[0] + e[1] + e[2] + e[3];
  return t ? Math.round(((e[0] + e[1]) / t) * 100) : 0;
}

/** "Persen dikuasai" = dikuasai / total. */
export function persenDikuasai(e: Empat): number {
  const t = e[0] + e[1] + e[2] + e[3];
  return t ? Math.round((e[0] / t) * 100) : 0;
}

/* Nama kelompok Kotoba. Deck dikelompokkan per baris kana (あ行 …) + beberapa
   unit tema (N2). Yang gak dikenal = tampil apa adanya. */
const TEMA: Record<string, { jp: string; id: string }> = {
  "動詞": { jp: "動詞", id: "Kata kerja dasar" },
  "副詞": { jp: "副詞", id: "Kata keterangan" },
  "接続詞": { jp: "接続", id: "Kata sambung" },
  "H-22 JLPT": { jp: "擬音", id: "Giongo & giseigo" },
  "Gabungan 2 kata kerja 合う": { jp: "合う", id: "Gabungan 2 kata kerja" },
  "Unit 6": { jp: "移動", id: "Pergerakan" },
  "Unit 7": { jp: "生活", id: "Kehidupan sehari-hari" },
  "Unit 8": { jp: "仕事", id: "Pekerjaan" },
  "Unit 9": { jp: "感情", id: "Perasaan & sifat" },
  "Unit 11": { jp: "社会", id: "Masyarakat" },
  "Unit 12": { jp: "抽象", id: "Konsep abstrak" },
  "その他": { jp: "他", id: "Lainnya" },
};

export function namaKelompokKata(grup: string): { jp: string; id: string } {
  const t = TEMA[grup];
  if (t) return t;
  const baris = grup.match(/^(.)行$/);
  if (baris) return { jp: grup, id: `Kata berawalan ${baris[1]}` };
  return { jp: grup.slice(0, 2), id: grup };
}
