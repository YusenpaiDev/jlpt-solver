/* Soal tes penempatan & ulangan mingguan, dirakit dari data Kotoba & Bunpou
   (bukan soal orisinal T1–T3 — itu nyusul). Murni & bisa diulang pakai seed. */

import type { Grup, Unit } from "./kurikulum";

export interface Kata { word: string; reading: string; meaning: string; group: string }
export interface Pola { id: string; pattern: string; meaning: string; functionGroup: string; examples: { jp: string; highlight: string }[]; confusableWith: string[] }
export interface SoalKatalog { question: string; options: string[]; correct: string; passage?: string | null }

export interface Soal {
  id: string;
  grup: Grup;
  /** jenis soal resmi (buat tingkat T1–T3); null = gak dihitung */
  jenis: string | null;
  /** bagian di hasil ulangan */
  bagian: "Kata" | "Pola" | "Jenis soal";
  /** unit asal (tes penempatan); null = gak ikut nentuin titik mulai */
  unit: number | null;
  /** item yang dijadwal ulang kalau dijawab */
  item?: { jenis: "kata" | "pola"; kunci: string; arti: string; baca?: string };
  tanya: string;
  bacaan?: string;
  opsi: string[];
  benar: number;
}

/** RNG kecil yang bisa diulang (mulberry32). */
export function acak(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function kocok<T>(xs: T[], r: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/* Kata imbuhan (長〜, 〜的) bukan kata utuh: gak dijadiin soal baca/tulis. */
const adaKanji = (s: string) => /[一-龯]/.test(s) && !/[〜～]/.test(s);

/** 3 pengecoh unik yang beda dari jawaban, diutamain yang mirip panjang/awalannya. */
function pengecoh(benar: string, kandidat: string[], r: () => number, mirip: (x: string) => number): string[] {
  const unik = [...new Set(kandidat.filter(x => x && x !== benar))];
  return kocok(unik, r).map(x => [x, mirip(x)] as const).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
}
function rakit(benar: string, salah: string[], r: () => number) {
  const opsi = kocok([benar, ...salah], r);
  return { opsi, benar: opsi.indexOf(benar) };
}

/** 漢字読み: baca kanjinya. Kata tanpa kanji → tebak arti (gak dihitung jenis soal). */
export function soalBaca(w: Kata, semua: Kata[], r: () => number, unit: number | null, bagian: Soal["bagian"] = "Kata"): Soal | null {
  const item = { jenis: "kata" as const, kunci: w.word, arti: w.meaning, baca: w.reading };
  if (adaKanji(w.word) && w.reading) {
    const salah = pengecoh(w.reading, semua.map(x => x.reading), r, x => (x[0] === w.reading[0] ? 2 : 0) + (Math.abs(x.length - w.reading.length) <= 1 ? 1 : 0));
    if (salah.length < 3) return null;
    return { id: `baca:${w.word}`, grup: "文字・語彙", jenis: "漢字読み", bagian, unit, item, tanya: `「${w.word}」の読み方は？`, ...rakit(w.reading, salah, r) };
  }
  const salah = pengecoh(w.meaning, semua.map(x => x.meaning), r, () => 0);
  if (salah.length < 3) return null;
  return { id: `arti:${w.word}`, grup: "文字・語彙", jenis: null, bagian, unit, item, tanya: `「${w.word}」の意味は？`, ...rakit(w.meaning, salah, r) };
}

/** 表記: dari cara baca, pilih tulisan kanjinya. */
export function soalTulis(w: Kata, semua: Kata[], r: () => number, unit: number | null, bagian: Soal["bagian"] = "Kata"): Soal | null {
  if (!adaKanji(w.word) || !w.reading) return null;
  const salah = pengecoh(w.word, semua.filter(x => adaKanji(x.word)).map(x => x.word), r, x => (x.length === w.word.length ? 2 : 0) + ([...x].some(c => w.word.includes(c)) ? 1 : 0));
  if (salah.length < 3) return null;
  return {
    id: `tulis:${w.word}`, grup: "文字・語彙", jenis: "表記", bagian, unit,
    item: { jenis: "kata", kunci: w.word, arti: w.meaning, baca: w.reading },
    tanya: `「${w.reading}」を漢字で書くと？`, ...rakit(w.word, salah, r),
  };
}

/** 文法形式の判断: isi titik-titik di contoh kalimat; pengecoh dari pola yang rawan ketuker. */
export function soalPola(p: Pola, semua: Pola[], r: () => number, unit: number | null, contoh = 0): Soal | null {
  const ex = p.examples[contoh] ?? p.examples[0];
  if (!ex?.jp || !ex.highlight || !ex.jp.includes(ex.highlight)) return null;
  const byId = new Map(semua.map(x => [x.id, x]));
  const mirip = new Set(p.confusableWith.map(id => byId.get(id)?.pattern).filter(Boolean));
  const grupDari = new Map(semua.map(x => [x.pattern, x.functionGroup]));
  const salah = pengecoh(p.pattern, semua.map(x => x.pattern), r, x => (mirip.has(x) ? 3 : 0) + (grupDari.get(x) === p.functionGroup ? 1 : 0));
  if (salah.length < 3) return null;
  return {
    id: `pola:${p.id}:${contoh}`, grup: "文法", jenis: "文法形式の判断", bagian: "Pola", unit,
    item: { jenis: "pola", kunci: p.pattern, arti: p.meaning },
    tanya: ex.jp.replace(ex.highlight, "（　　）"), ...rakit(p.pattern, salah, r),
  };
}

export function soalDariKatalog(q: SoalKatalog, i: number, r: () => number): Soal | null {
  const opsi = (q.options ?? []).filter(Boolean);
  if (opsi.length < 2 || !opsi.includes(q.correct)) return null;
  const urut = kocok(opsi, r);
  return { id: `dokkai:${i}`, grup: "読解", jenis: null, bagian: "Jenis soal", unit: null, tanya: q.question, bacaan: q.passage ?? undefined, opsi: urut, benar: urut.indexOf(q.correct) };
}

/** Item pertama yang berhasil jadi soal (berhenti di situ, gak ngerakit semuanya). */
function pertama<T>(xs: T[], f: (x: T) => Soal | null): Soal | null {
  for (const x of xs) { const s = f(x); if (s) return s; }
  return null;
}

/** Unit yang diambil sampelnya, nyebar rata dari 1 sampai 26. */
const sebar = (n: number, maks: number) => Array.from({ length: n }, (_, i) => Math.round(1 + (i * (maks - 1)) / Math.max(1, n - 1)));

/** Tes penempatan (§5): 文字・語彙 16 · 文法 12 · 読解 12 (読解 dari katalog Bank Soal). */
export function susunPenempatan(unit: Unit[], kata: Kata[], pola: Pola[], dokkai: SoalKatalog[], seed: number): Soal[] {
  const r = acak(seed);
  const perKata = new Map(kata.map(w => [w.word, w]));
  const perPola = new Map(pola.map(p => [p.pattern, p]));
  const out: Soal[] = [];
  /* Unit u dulu; kalau isinya gak bisa jadi soal, coba tetangga terdekat. */
  const dekat = (u: number) => [u, ...Array.from({ length: unit.length }, (_, i) => [u - i - 1, u + i + 1]).flat()].filter(x => x >= 1 && x <= unit.length);
  for (const u of sebar(8, unit.length)) {
    const calon = (x: number) => kocok(unit[x - 1].kata.map(k => perKata.get(k)).filter((w): w is Kata => Boolean(w)), r);
    const baca = pertama(dekat(u), x => pertama(calon(x), w => { const s = soalBaca(w, kata, r, x); return s?.jenis === "漢字読み" ? s : null; }));
    const tulis = pertama(dekat(u), x => pertama(calon(x).filter(w => w.word !== baca?.item?.kunci), w => soalTulis(w, kata, r, x)));
    if (baca) out.push(baca);
    if (tulis) out.push(tulis);
  }
  const polaDipakai = new Set<string>();
  for (const u of sebar(12, unit.length)) {
    const s = pertama(dekat(u), x => pertama(
      kocok(unit[x - 1].pola.filter(p => !polaDipakai.has(p)).map(p => perPola.get(p)).filter((p): p is Pola => Boolean(p)), r),
      p => soalPola(p, pola, r, x)));
    if (s) { out.push(s); polaDipakai.add(s.item!.kunci); }
  }
  dokkai.slice(0, 12).forEach((q, i) => { const s = soalDariKatalog(q, i, r); if (s) out.push(s); });
  return out;
}

/** Ulangan mingguan (§10): kata unit lalu → baca kanjinya, pola → contoh kalimat lain,
    "jenis soal" → tulis kanjinya. Item yang masih lupa didahuluin. */
export function susunUlangan(unit: Unit, kata: Kata[], pola: Pola[], lupa: string[], komposisi: { kata: number; pola: number; jenis: number }, seed: number): Soal[] {
  const r = acak(seed);
  const perKata = new Map(kata.map(w => [w.word, w]));
  const perPola = new Map(pola.map(p => [p.pattern, p]));
  const dulu = (xs: string[]) => [...xs.filter(x => lupa.includes(x)), ...kocok(xs.filter(x => !lupa.includes(x)), r)];
  const kataUnit = dulu(unit.kata).map(k => perKata.get(k)).filter((w): w is Kata => Boolean(w));
  const ambil = <T,>(xs: T[], n: number, f: (x: T) => Soal | null) => {
    const out: Soal[] = [];
    for (const x of xs) { if (out.length >= n) break; const s = f(x); if (s) out.push(s); }
    return out;
  };
  const bacaan = ambil(kataUnit, komposisi.kata, w => soalBaca(w, kata, r, unit.u));
  const dipakai = new Set(bacaan.map(s => s.item?.kunci));
  const tulis = ambil(kataUnit.filter(w => !dipakai.has(w.word)), komposisi.jenis, w => soalTulis(w, kata, r, unit.u, "Jenis soal"));
  const polaUnit = dulu(unit.pola).map(p => perPola.get(p)).filter((p): p is Pola => Boolean(p));
  const pol: Soal[] = [];
  for (let putaran = 0; pol.length < komposisi.pola && putaran < 3; putaran++) {
    for (const p of polaUnit) {
      if (pol.length >= komposisi.pola) break;
      const s = soalPola(p, pola, r, unit.u, putaran + 1);
      if (s && !pol.some(x => x.id === s.id)) pol.push(s);
    }
  }
  return [...bacaan, ...pol, ...tulis];
}
