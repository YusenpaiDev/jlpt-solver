/* Export data (Pengaturan → Privasi & Data): Kamus → CSV, Catatan → Markdown.
   Murni — dites di tests/ekspor-data.test.mjs. File dibikin di browser. */

export interface BarisKata { kanji: string; reading?: string | null; meaning?: string | null; level?: string | null; favorite?: boolean | null; created_at?: string | null }
export interface BarisCatatan { judul?: string | null; isi?: string | null; source?: string | null; created_at?: string | null }

/** Sel CSV: dikutip kalau ada koma/kutip/baris baru. Diawali =+-@ dikasih ' biar gak dieksekusi Excel. */
const sel = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function csvKamus(kata: BarisKata[]): string {
  const kepala = ["kanji", "cara_baca", "arti", "level", "favorit", "disimpan"];
  const baris = kata.map(k => [k.kanji, k.reading, k.meaning, k.level, k.favorite ? "ya" : "", k.created_at?.slice(0, 10)].map(sel).join(","));
  /* BOM biar Excel kebaca UTF-8 (kanji gak jadi kotak). */
  return "﻿" + [kepala.join(","), ...baris].join("\r\n") + "\r\n";
}

export function mdCatatan(catatan: BarisCatatan[], judulBerkas = "Catatan Honix"): string {
  const isi = catatan.map(c => {
    const kepala = `## ${c.judul?.trim() || "Tanpa judul"}`;
    const meta = [c.created_at ? c.created_at.slice(0, 10) : null, c.source ? `sumber: ${c.source}` : null].filter(Boolean).join(" · ");
    return [kepala, meta ? `_${meta}_` : null, "", (c.isi ?? "").trim()].filter(x => x !== null).join("\n");
  });
  return `# ${judulBerkas}\n\n${isi.join("\n\n---\n\n")}\n`;
}
