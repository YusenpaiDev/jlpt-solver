import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { filterSoal, type RawSoal } from "@/lib/soal-validate";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* Schema ini dikirim ke API lewat output_config.format, jadi bentuk JSON-nya
   dijamin server (gak perlu lagi ngupas ```json dan doa semoga JSON.parse lolos).
   Yang gak bisa dijamin schema — 4 opsi unik, tepat 1 correct, bahasa penjelasan —
   dicek belakangan lewat filterSoal(). */
const SOAL_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          no: { type: "string" },
          category: { type: "string", enum: ["語彙", "文法", "文字", "読解"] },
          difficulty: { type: "string", enum: ["mudah", "sedang", "sulit"] },
          question: { type: "string" },
          context: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                correct: { type: "boolean" },
              },
              required: ["text", "correct"],
              additionalProperties: false,
            },
          },
          explanation: {
            type: "object",
            properties: {
              correct: { type: "string" },
              wrong: { type: "string" },
              grammar: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    term: { type: "string" },
                    meaning: { type: "string" },
                  },
                  required: ["term", "meaning"],
                  additionalProperties: false,
                },
              },
              tips: { type: "string" },
            },
            required: ["correct", "wrong", "grammar", "tips"],
            additionalProperties: false,
          },
        },
        required: [
          "no", "category", "difficulty", "question",
          "context", "options", "explanation",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

function buildPrompt(
  level: string,
  categoryLabel: string,
  count: number,
  avoid: string[],
): string {
  const hindari = avoid.length
    ? `\nSOAL YANG SUDAH ADA (jangan diulang, bikin yang beda):\n${avoid.map(q => `- ${q}`).join("\n")}\n`
    : "";

  return `Kamu adalah guru JLPT yang sangat ahli dalam membuat soal latihan autentik.

Buat ${count} soal latihan JLPT level ${level}, kategori ${categoryLabel}.
${hindari}
ATURAN SOAL:
- Soal harus menyerupai format JLPT asli
- Kesulitan bervariasi: mudah (1–2 soal), sedang (mayoritas), sulit (1–2 soal)
- Setiap soal punya TEPAT 4 pilihan jawaban
- Pilihan jawaban berupa kata/frasa Jepang (huruf Jepang, bukan terjemahan)
- Untuk soal 読解: sertakan konteks/teks pendek di field "context"
- Untuk soal lain: biarkan "context" kosong (string kosong "")

ATURAN PILIHAN JAWABAN (paling sering dilanggar — perhatikan baik-baik):
- 4 pilihan WAJIB berbeda satu sama lain. DILARANG KERAS ada dua pilihan yang
  teksnya sama atau cuma beda spasi/tanda baca. Contoh SALAH:
  A「をして」 B「をしている」 C「をしている」 D「してしまう」 — B dan C kembar.
- TEPAT SATU pilihan yang "correct": true. Tiga sisanya "correct": false.
- Pengecoh harus benar-benar salah secara tata bahasa/makna, bukan variasi
  penulisan dari jawaban benar.

ATURAN BAHASA:
- Field "correct", "wrong", dan "tips" WAJIB seluruhnya dalam Bahasa Indonesia
- DILARANG menulis penjelasan dalam bahasa Jepang. Kalimat penjelasan yang
  seluruhnya berhuruf Jepang dianggap soal GAGAL dan dibuang.
- Untuk menyebut kata Jepang di penjelasan: tulis kata Jepangnya, lalu langsung
  beri artinya dalam kurung. Contoh: 装置（そうち）(perangkat)
- Penjelasan harus cocok dengan jawaban yang kamu tandai "correct": true

SEBELUM MENJAWAB, periksa ulang tiap soal: 4 pilihan unik? tepat 1 yang correct?
penjelasan Bahasa Indonesia? Perbaiki dulu kalau ada yang meleset.`;
}

async function generateBatch(
  level: string,
  categoryLabel: string,
  count: number,
  avoid: string[],
): Promise<RawSoal[]> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    // ~500 token per soal + ruang konteks 読解; 16k aman buat non-streaming.
    max_tokens: Math.min(16000, 2000 + count * 500),
    output_config: { format: { type: "json_schema", schema: SOAL_SCHEMA } },
    messages: [{ role: "user", content: buildPrompt(level, categoryLabel, count, avoid) }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  if (!text.trim()) return [];

  const parsed = JSON.parse(text) as { questions?: RawSoal[] };
  return Array.isArray(parsed.questions) ? parsed.questions : [];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const level = String(body.level ?? "N3");
    const category = String(body.category ?? "全");
    const count = Math.min(30, Math.max(1, Number(body.count) || 10));

    const categoryLabel =
      category === "全"  ? "campuran (語彙, 文法, 文字, 読解) — variasikan kategorinya"
      : category === "語彙" ? "kosakata (語彙/goi)"
      : category === "文法" ? "tata bahasa (文法/bunpou)"
      : category === "文字" ? "kanji & huruf (文字/moji)"
      : "membaca (読解/dokkai)";

    const accepted: RawSoal[] = [];
    const seen = new Set<string>();
    let rejectedTotal = 0;

    // Ronde 1 minta jumlah penuh; ronde berikutnya cuma nambal yang dibuang.
    // Dibatasi 3 ronde biar gak muter kalau modelnya lagi ngaco terus.
    for (let round = 0; round < 3 && accepted.length < count; round++) {
      const missing = count - accepted.length;
      const batch = await generateBatch(
        level,
        categoryLabel,
        missing,
        accepted.map(q => (q.question ?? "").trim()).filter(Boolean),
      );

      const { valid, rejected } = filterSoal(batch, seen);
      rejectedTotal += rejected.length;

      if (rejected.length > 0) {
        console.warn(
          `[tugas/generate] ronde ${round + 1}: ${rejected.length} soal ditolak`,
          rejected.map(r => `${r.reasons.join(", ")} — ${r.question.slice(0, 40)}`),
        );
      }

      accepted.push(...valid.slice(0, missing));
    }

    if (accepted.length === 0) {
      return NextResponse.json(
        { error: "Soal yang dibuat AI gak lolos pemeriksaan. Coba lagi." },
        { status: 502 },
      );
    }

    // Nomor soal dirapikan di sini — hasil gabungan beberapa ronde bisa acak.
    const questions = accepted.map((q, i) => ({ ...q, no: `問${i + 1}` }));

    return NextResponse.json({
      success: true,
      data: { questions },
      meta: { requested: count, delivered: questions.length, rejected: rejectedTotal },
    });
  } catch (err) {
    console.error("Generate tugas error:", err);
    return NextResponse.json({ error: "Gagal membuat soal. Coba lagi." }, { status: 500 });
  }
}
