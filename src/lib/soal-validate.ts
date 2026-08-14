/**
 * Gerbang mutu soal hasil AI.
 *
 * AI kadang meleset: bikin dua opsi yang teksnya sama persis, nandain dua
 * jawaban benar, atau nulis penjelasan pakai bahasa Jepang padahal diminta
 * Bahasa Indonesia. Semua itu lolos ke layar kalau gak dicegat di sini.
 *
 * Dipakai di /api/tugas/generate — soal yang gagal dibuang lalu digenerate ulang.
 */

export interface RawOption { text?: string; correct?: boolean }
export interface RawExplanation {
  correct?: string;
  wrong?: string;
  grammar?: { term?: string; meaning?: string }[];
  tips?: string;
}
export interface RawSoal {
  no?: string;
  category?: string;
  difficulty?: string;
  question?: string;
  context?: string;
  options?: RawOption[];
  explanation?: RawExplanation;
}

/** Normalisasi teks opsi buat ngebandingin: full-width → half-width, buang
 *  penomoran depan, spasi, dan tanda baca ekor. 「をしている」 vs 「を している。」
 *  harus kebaca sama. */
export function normalizeOption(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/^[1-4][．.、:：)）\s]*/u, "")
    .replace(/[\s　]+/gu, "")
    .replace(/[。、．,.]+$/u, "")
    .toLowerCase();
}

/* Deteksi penjelasan yang ditulis full bahasa Jepang — pelanggaran yang beneran
   kejadian (lihat 毎日、公園で運動 di screenshot).

   Dua ukuran yang lebih "pintar" udah dicoba dan dua-duanya salah tuduh:
     hitung kata latin ≥6  → nolak "雲 dibaca 'くも' (awan)" yang sebenarnya benar
     cek kata fungsi ID    → nolak "対抗心 = jiwa kompetisi" yang juga benar
   Yang beneran mbedain cuma satu: penjelasan Jepang total NOL huruf latin,
   sedangkan gaya Indonesia sepadat apa pun selalu nyisain beberapa. */
const MIN_HURUF_LATIN = 3;

function berbahasaIndonesia(s: string): boolean {
  return (s.match(/[A-Za-z]/g) ?? []).length >= MIN_HURUF_LATIN;
}

/** Cek satu soal. Balik array alasan gagal — kosong artinya lolos. */
export function checkSoal(q: RawSoal): string[] {
  const bad: string[] = [];

  const question = (q.question ?? "").trim();
  if (question.length < 4) bad.push("pertanyaan kosong/terlalu pendek");

  const opts = Array.isArray(q.options) ? q.options : [];
  if (opts.length !== 4) {
    bad.push(`jumlah opsi ${opts.length}, harus 4`);
  } else {
    const texts = opts.map(o => (o.text ?? "").trim());
    if (texts.some(t => t.length === 0)) bad.push("ada opsi kosong");

    const norm = texts.map(normalizeOption);
    if (new Set(norm).size !== norm.length) bad.push("ada opsi duplikat");

    const benar = opts.filter(o => o.correct === true).length;
    if (benar !== 1) bad.push(`jawaban benar ${benar}, harus tepat 1`);
  }

  const ex = q.explanation;
  if (!ex) {
    bad.push("penjelasan hilang");
  } else {
    const correct = (ex.correct ?? "").trim();
    const wrong = (ex.wrong ?? "").trim();
    const tips = (ex.tips ?? "").trim();
    if (!correct || !wrong || !tips) bad.push("penjelasan gak lengkap");
    // Prompt mewajibkan Bahasa Indonesia; tolak yang ditulis full bahasa Jepang.
    else if (!berbahasaIndonesia(`${correct} ${wrong} ${tips}`)) {
      bad.push("penjelasan bukan Bahasa Indonesia");
    }
  }

  return bad;
}

/** Saring sekumpulan soal: buang yang cacat sekaligus yang pertanyaannya kembar
 *  (`seen` dibawa lintas ronde supaya regenerate gak ngulang soal yang sama). */
export function filterSoal(
  list: RawSoal[],
  seen: Set<string> = new Set(),
): { valid: RawSoal[]; rejected: { question: string; reasons: string[] }[] } {
  const valid: RawSoal[] = [];
  const rejected: { question: string; reasons: string[] }[] = [];

  for (const q of list) {
    const question = (q.question ?? "").trim();
    const key = normalizeOption(question);

    if (key && seen.has(key)) {
      rejected.push({ question, reasons: ["soal kembar"] });
      continue;
    }

    const reasons = checkSoal(q);
    if (reasons.length > 0) {
      rejected.push({ question, reasons });
      continue;
    }

    seen.add(key);
    valid.push(q);
  }

  return { valid, rejected };
}
