import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { level, category, count } = await req.json();

    const categoryLabel =
      category === "全"  ? "campuran (語彙, 文法, 文字, 読解) — variasikan kategorinya"
      : category === "語彙" ? "kosakata (語彙/goi)"
      : category === "文法" ? "tata bahasa (文法/bunpou)"
      : category === "文字" ? "kanji & huruf (文字/moji)"
      : "membaca (読解/dokkai)";

    const prompt = `Kamu adalah guru JLPT yang sangat ahli dalam membuat soal latihan autentik.

Buat ${count} soal latihan JLPT level ${level}, kategori ${categoryLabel}.

ATURAN SOAL:
- Soal harus menyerupai format JLPT asli
- Kesulitan bervariasi: mudah (1–2 soal), sedang (mayoritas), sulit (1–2 soal)
- Setiap soal punya tepat 4 pilihan jawaban
- Pilihan jawaban berupa kata/frasa Jepang (huruf Jepang, bukan terjemahan)
- Hanya 1 jawaban benar per soal
- Untuk soal 読解: sertakan konteks/teks pendek di field "context"
- Untuk soal lain: biarkan "context" kosong (string kosong "")

ATURAN BAHASA:
- Field "correct", "wrong", dan "tips" WAJIB seluruhnya dalam Bahasa Indonesia
- Untuk menyebut kata Jepang di penjelasan: tulis kata Jepangnya, lalu langsung beri artinya dalam kurung. Contoh: 装置（そうち）(perangkat)
- DILARANG menulis penjelasan dalam bahasa Jepang

Balas HANYA dengan JSON berikut (tanpa markdown, tanpa komentar):
{
  "questions": [
    {
      "no": "問1",
      "category": "語彙",
      "difficulty": "sedang",
      "question": "teks soal dalam huruf Jepang dengan （　） untuk bagian kosong",
      "context": "",
      "options": [
        {"text": "pilihan1", "correct": false},
        {"text": "pilihan2", "correct": true},
        {"text": "pilihan3", "correct": false},
        {"text": "pilihan4", "correct": false}
      ],
      "explanation": {
        "correct": "penjelasan kenapa jawaban ini benar — WAJIB Bahasa Indonesia",
        "wrong": "kenapa pilihan lain salah satu per satu — WAJIB Bahasa Indonesia",
        "grammar": [{"term": "単語", "meaning": "arti dalam Bahasa Indonesia"}],
        "tips": "tips ujian singkat — WAJIB Bahasa Indonesia"
      }
    }
  ]
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(clean);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("Generate tugas error:", err);
    return NextResponse.json({ error: "Gagal membuat soal. Coba lagi." }, { status: 500 });
  }
}
