/* Soal "Latihan Kilat" di Beranda: satu soal isian pola per hari, diambil
   dari contoh kalimat deck Bunpou level target. Ganti tiap hari, sama
   sepanjang hari (seed = level + tanggal). Murni — dites di tests/kilat-harian.test.mjs. */

export interface PolaHarian {
  id?: string;
  pattern: string;
  meaning: string;
  functionGroup?: string;
  confusableWith?: string[];
  examples?: { jp: string; highlight: string; id: string }[];
}

export interface SoalHarian {
  /** kalimat dipotong di bagian kosong: [sebelum, sesudah] */
  kalimat: [string, string];
  opsi: string[];
  benar: number;
  pola: string;
  arti: string;
  terjemah: string;
}

function acak(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Potongan pola yang layak jadi isian: ada di kalimat (sekali), pendek. */
const isian = (e: { jp: string; highlight: string }) =>
  e.highlight.length >= 1 && e.highlight.length <= 8 && e.jp.indexOf(e.highlight) >= 0 && e.jp.indexOf(e.highlight) === e.jp.lastIndexOf(e.highlight);

export function soalHarian(pola: PolaHarian[], tanggal: string, level: string): SoalHarian | null {
  const calon = pola.flatMap(p => (p.examples ?? []).filter(isian).map(e => ({ p, e })));
  if (calon.length < 4) return null;
  const r = acak(hash(`${level}:${tanggal}`));
  const { p, e } = calon[Math.floor(r() * calon.length)];
  const benar = e.highlight;

  /* Pengecoh dari kelompok fungsi LAIN dan bukan pola mirip — pola mirip /
     sekelompok sering sinonim (ようだ/らしい/みたい), jadi bisa dua-duanya bener
     di soal tanpa konteks. Gak boleh sama / saling memuat jawaban. */
  const potongan = (q: PolaHarian) => (q.examples ?? []).find(isian)?.highlight;
  const mirip = new Set(p.confusableWith ?? []);
  const lain = [...pola].sort(() => r() - 0.5)
    .filter(q => q !== p && !mirip.has(q.id ?? "") && !(q.confusableWith ?? []).includes(p.id ?? "") && (!p.functionGroup || q.functionGroup !== p.functionGroup));
  const pengecoh: string[] = [];
  for (const q of lain) {
    const h = potongan(q);
    if (!h || pengecoh.includes(h) || h.includes(benar) || benar.includes(h)) continue;
    pengecoh.push(h);
    if (pengecoh.length === 3) break;
  }
  if (pengecoh.length < 3) return null;

  const opsi = [benar, ...pengecoh].sort(() => r() - 0.5);
  const i = e.jp.indexOf(benar);
  return {
    kalimat: [e.jp.slice(0, i), e.jp.slice(i + benar.length)],
    opsi, benar: opsi.indexOf(benar),
    pola: p.pattern, arti: p.meaning, terjemah: e.id,
  };
}
