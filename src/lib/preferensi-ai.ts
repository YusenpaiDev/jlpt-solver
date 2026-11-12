/* Preferensi Sensei AI (Pengaturan → Preferensi AI). Disimpan di
   user_metadata.ai_pref, dibaca /api/chat buat nambah instruksi ke system
   prompt. Murni — dites di tests/preferensi-ai.test.mjs. */

export interface PrefAi {
  /** singkat = langsung ke inti · lengkap = + penjelasan tata bahasa */
  gaya: "singkat" | "lengkap";
  /** tiap penjelasan dikasih contoh kalimat */
  contoh: boolean;
  /** furigana di jawaban: kanji di atas level target · semua kanji · mati */
  furigana: "atas" | "semua" | "mati";
}

export const PREF_AWAL: PrefAi = { gaya: "singkat", contoh: true, furigana: "atas" };

/** Apa pun dari metadata → preferensi yang valid (sisanya bawaan). */
export function rapikanPref(x: unknown): PrefAi {
  const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  return {
    gaya: o.gaya === "lengkap" ? "lengkap" : "singkat",
    contoh: typeof o.contoh === "boolean" ? o.contoh : PREF_AWAL.contoh,
    furigana: o.furigana === "semua" || o.furigana === "mati" ? o.furigana : "atas",
  };
}

/** Tambahan system prompt + batas token jawaban. */
export function instruksiPref(p: PrefAi, level: unknown): { teks: string; maksToken: number } {
  /* Level dari user_metadata (bisa diubah user sendiri) — cuma N1–N5 yang
     boleh masuk system prompt, sisanya dianggap gak ada. */
  const lv = typeof level === "string" && /^N[1-5]$/.test(level) ? level : null;
  const baris = [
    p.gaya === "lengkap"
      ? "Gaya jawaban: LENGKAP — jelasin poin tata bahasanya juga (pola, penyambungan, kenapa pilihan lain salah), tetap rapi & gak bertele-tele."
      : "Gaya jawaban: SINGKAT — langsung ke inti, 2–4 kalimat.",
    p.contoh
      ? "Kasih satu contoh kalimat pendek beserta artinya."
      : "Gak usah kasih contoh kalimat kecuali diminta.",
    p.furigana === "mati"
      ? "Jangan tulis cara baca kanji."
      : p.furigana === "semua"
        ? "Tulis cara baca (hiragana) dalam kurung setelah setiap kanji, mis. 勉強（べんきょう）."
        : `Tulis cara baca (hiragana) dalam kurung cuma buat kanji yang kira-kira di atas level ${lv ?? "user"}, mis. 影響（えいきょう）.`,
  ];
  return { teks: `Preferensi user:\n- ${baris.join("\n- ")}`, maksToken: p.gaya === "lengkap" ? 520 : 280 };
}
