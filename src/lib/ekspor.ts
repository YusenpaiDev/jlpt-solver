/**
 * Ekspor data user (Pengaturan → Privasi & Data). Fungsi murni — dites di
 * tests/ekspor.test.mjs; yang ngambil data & mancing unduhan ada di halaman.
 */

export type BarisKotoba = {
  kanji: string; reading: string | null; meaning: string; level: string | null;
  example?: string | null; favorite?: boolean | null; created_at: string;
};
export type BarisCatatan = { judul: string | null; isi: string | null; created_at: string; updated_at?: string | null };

const KOLOM: (keyof BarisKotoba)[] = ["kanji", "reading", "meaning", "level", "example", "favorite", "created_at"];

/** RFC 4180: field yang ada koma/kutip/baris baru dibungkus kutip, kutip digandakan. */
function sel(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Diawali BOM biar Excel kebaca UTF-8 (kanji gak jadi kotak-kotak). */
export function kotobaKeCsv(baris: BarisKotoba[]): string {
  const isi = [KOLOM.join(","), ...baris.map(b => KOLOM.map(k => sel(b[k])).join(","))];
  return "﻿" + isi.join("\r\n") + "\r\n";
}

export function catatanKeMarkdown(baris: BarisCatatan[], dibuat = new Date()): string {
  const kepala = `# Catatan Sensei JLPT\n\nDiekspor ${dibuat.toISOString().slice(0, 10)} · ${baris.length} catatan\n`;
  const isi = baris.map(c =>
    `\n---\n\n## ${(c.judul || "Tanpa judul").replace(/\n/g, " ")}\n\n_${(c.updated_at || c.created_at).slice(0, 10)}_\n\n${(c.isi || "").trim()}\n`);
  return kepala + isi.join("");
}
