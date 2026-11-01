/* Bahan katalog Bank Soal — dipakai scripts/sinkron-katalog.mjs, dites di
   tests/katalog.test.mjs. Sumbernya sesi materi di akun owner, yang ikut
   nyimpen progres pribadi owner; itu semua WAJIB dibuang sebelum jadi
   salinan user lain. */

/* Field per-user di ai_result: jawaban + coretan (user_progress), ringkasan
   Statistik (stats). Per soal: tanda review. */
export function bersihkanAiResult(ai) {
  const sisa = { ...(ai ?? {}) };
  delete sisa.user_progress;
  delete sisa.stats;
  const questions = Array.isArray(sisa.questions)
    ? sisa.questions.map(q => {
        if (!q || typeof q !== "object") return q;
        const isi = { ...q };
        delete isi.needs_review;
        return isi;
      })
    : [];
  return { ...sisa, questions, kind: "materi" };
}

/* Satu baris katalog per judul. Judul dobel di akun owner → ambil yang paling
   baru dibuat, sisanya dilaporin. */
export function barisKatalog(sesi) {
  const perJudul = new Map();
  const dobel = [];
  for (const s of [...sesi].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    if (perJudul.has(s.title)) { dobel.push(s.title); continue; }
    const ai = bersihkanAiResult(s.ai_result);
    perJudul.set(s.title, {
      level: s.level,
      category: s.category ?? null,
      title: s.title,
      section: ai.section ?? null,
      total: ai.questions.length,
      ready: ai.ready !== false,
      ai_result: ai,
    });
  }
  return { baris: [...perJudul.values()], dobel: [...new Set(dobel)] };
}
