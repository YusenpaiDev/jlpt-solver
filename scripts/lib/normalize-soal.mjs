/**
 * Normalisasi JSON soal → bentuk yang disimpan di `sessions.ai_result`.
 *
 * Dipakai bareng sama import-json.mjs (nulis pertama kali) dan
 * sync-bank-supabase.mjs (nimpa sesi yang udah ada). Wajib satu sumber:
 * kalau dua-duanya punya salinan sendiri, hasilnya bisa beda pelan-pelan dan
 * sinkron malah bikin data lama-baru campur aduk.
 */

const MONDAI_NAME = {
  1: "課題理解", 2: "ポイント理解", 3: "概要理解", 4: "即時応答", 5: "統合理解",
};

export function normalizeTranscript(t) {
  if (!Array.isArray(t)) return null;
  const out = t.map(line => {
    if (line && typeof line === "object") {
      return {
        sp: line.sp ?? line["話者"] ?? "",
        jp: line.jp ?? line["日本語"] ?? "",
        id: line.id ?? line["訳"] ?? "",
      };
    }
    return { sp: "", jp: String(line), id: "" };
  });
  return out.length ? out : null;
}

/* Choukai ber-key Jepang (試験/年月/問題/質問) → format standar app.
   Future-proof: kalau nanti ada 質問文/スクリプト/解説, ikut ke-ambil. */
export function convertChoukaiRaw(raw) {
  const shiken = raw["試験"] ?? "N2";
  const nengetsu = raw["年月"] ?? "";
  const questions = [];
  for (const m of (raw["問題"] ?? [])) {
    const num = m["問題番号"];
    const shiji = m["指示"] ?? "";
    const script = normalizeTranscript(m["スクリプト"] ?? m["台本"] ?? m["本文"]);
    const cat = "聴解-" + (MONDAI_NAME[num] ?? "");
    for (const q of (m["質問"] ?? [])) {
      const qText = q["質問文"] ?? q["問い"] ?? "";
      questions.push({
        mondai: num,
        category: cat,
        prompt: shiji,
        question: qText || `問題${num}（${q["番号"]}）`,
        options: (q["選択肢"] ?? []).map((o, i) => `${i + 1}. ${o}`),
        correct: String(q["正解"] ?? "1"),
        explanation: q["解説"] ?? `Jawaban benar: pilihan ${q["正解"]}.`,
        transcript: normalizeTranscript(q["スクリプト"] ?? q["台本"]) ?? script,
        audio: null,
        image: typeof q["image"] === "number" || typeof q["image"] === "string" ? q["image"] : null,
      });
    }
  }
  return {
    title: raw.title || `JLPT ${shiken} ${nengetsu} 聴解`.trim(),
    section: "choukai",
    vocabulary: [],
    questions,
  };
}

/* Pastikan field yang dipake app ada, fill default kalau missing. */
export function normalizeResult(raw, fallbackTitle) {
  // Auto-convert format choukai ber-key Jepang sebelum normalisasi standar.
  if (Array.isArray(raw["問題"]) && !Array.isArray(raw.questions)) {
    raw = convertChoukaiRaw(raw);
  }
  const title = (raw.title || fallbackTitle || "Soal JLPT").toString();
  const section = raw.section ?? null;
  const vocabulary = Array.isArray(raw.vocabulary) ? raw.vocabulary.map(v => ({
    word: v.word ?? v.kanji ?? "",
    reading: v.reading ?? "",
    meaning: v.meaning ?? "",
    example: v.example ?? "",
    jlpt_level: v.jlpt_level ?? v.level ?? null,
  })).filter(v => v.word) : [];

  const questions = Array.isArray(raw.questions) ? raw.questions.map(q => ({
    question: q.question ?? "",
    options: Array.isArray(q.options) ? q.options : [],
    correct: String(q.correct ?? q.correct_ans ?? "1"),
    explanation: q.explanation ?? "",
    why_wrong: q.why_wrong ?? "",
    grammar_points: Array.isArray(q.grammar_points) ? q.grammar_points : [],
    tip: q.tip ?? "",
    category: q.category ?? "AI",
    passage: q.passage ?? null,
    // choukai-specific (null-able, kept verbatim so player can read them from ai_result)
    audio: q.audio ?? null,
    image: q.image ?? null,
    mondai: typeof q.mondai === "number" ? q.mondai : null,
    transcript: Array.isArray(q.transcript) ? q.transcript : null,
    prompt: q.prompt ?? null,
  })).filter(q => q.question && q.options.length > 0) : [];

  // `kind: "materi"` → sesi hasil import = bank soal/materi, bukan log latihan.
  // Halaman /materi nge-list ini; /riwayat-soal nyembunyiin yg belum dikerjain.
  return { title, section, vocabulary, questions, kind: "materi" };
}

/* Auto-detect kategori session: choukai kalau ada 聴解-* questions atau section=choukai */
export function detectCategory(result, fallback) {
  if (result.section === "choukai") return "聴解";
  if (result.questions.some(q => typeof q.category === "string" && q.category.startsWith("聴解"))) return "聴解";
  return fallback;
}
