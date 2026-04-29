import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, level, category } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Gambar tidak ditemukan" }, { status: 400 });
    }

    const categoryLabel =
      category === "文法" ? "tata bahasa (文法/bunpou)"
      : category === "語彙" ? "kosakata (語彙/goi)"
      : category === "文字" ? "kanji & huruf (文字/moji)"
      : category === "読解" ? "membaca (読解/dokkai)"
      : "semua kategori (AI akan menentukan sendiri)";

    const prompt = `Kamu adalah Sensei JLPT, guru bahasa Jepang yang sangat ahli dalam membaca, menganalisis soal ujian JLPT, dan mengekstrak kosakata penting.

Foto ini berisi soal ujian JLPT level ${level}, kategori ${categoryLabel}.

TUGAS UTAMA:
Baca SELURUH teks dalam foto dengan sangat teliti. Ekstrak SEMUA soal yang ada persis seperti tertulis. Jangan buat soal baru, jangan kurangi.

Untuk setiap soal berikan analisis LENGKAP:
1. Teks soal PERSIS dari foto (dalam huruf Jepang)
2. Semua pilihan jawaban PERSIS dari foto → format "1. xxx", "2. xxx", "3. xxx", "4. xxx"
3. Jawaban benar ("1"/"2"/"3"/"4")
4. Penjelasan kenapa jawaban itu BENAR
5. Penjelasan kenapa pilihan LAIN salah (sebutkan per nomor)
6. Poin grammar/kosakata: kata kunci Jepang + arti Indonesia
7. Tips ujian singkat

BAHASA YANG WAJIB DIGUNAKAN:
- Field "explanation", "why_wrong", dan "tip" HARUS SELURUHNYA dalam Bahasa Indonesia.
- DILARANG KERAS menggunakan bahasa Jepang di dalam field explanation, why_wrong, dan tip.
- Jika ingin menyebut kata/frasa Jepang dalam penjelasan, tulis dulu kata Jepangnya lalu langsung beri artinya dalam kurung. Contoh: 「〜ないうちに」(sebelum sempat ~).
- Field "grammar_points[].id" juga harus dalam Bahasa Indonesia.

PENTING:
- Ekstrak SEMUA soal, jangan dibatasi jumlahnya
- Teks soal dan pilihan harus PERSIS dari foto
- Format "correct" isi angka: "1", "2", "3", atau "4"

EKSTRAK KOSAKATA:
Selain soal, ekstrak kosakata penting dari foto ke field "vocabulary" (maks 10 kata):
- "word": kata dalam kanji/hiragana persis dari foto
- "reading": furigana lengkap dalam hiragana
- "meaning": arti dalam Bahasa Indonesia
- "example": kalimat pendek dari foto yang mengandung kata ini (boleh kosong "")
- "jlpt_level": perkiraan level JLPT ("N1"/"N2"/"N3"/"N4"/"N5")
Hanya kata yang BENAR-BENAR muncul di foto. Jika tidak ada kosakata menarik, isi array kosong [].

Balas HANYA dengan JSON ini (tanpa markdown, tanpa komentar):
{
  "title": "judul singkat berdasarkan konten foto",
  "vocabulary": [
    {
      "word": "装置",
      "reading": "そうち",
      "meaning": "perangkat, alat",
      "example": "水をきれいにする装置です。",
      "jlpt_level": "N2"
    }
  ],
  "questions": [
    {
      "question": "teks soal persis dari foto",
      "options": ["1. ...", "2. ...", "3. ...", "4. ..."],
      "correct": "2",
      "explanation": "penjelasan kenapa benar — WAJIB Bahasa Indonesia",
      "why_wrong": "kenapa pilihan 1 salah: ... Kenapa pilihan 3 salah: ... — WAJIB Bahasa Indonesia",
      "grammar_points": [{"jp": "単語", "id": "arti dalam Bahasa Indonesia"}],
      "tip": "tips ujian — WAJIB Bahasa Indonesia"
    }
  ]
}`;

    const isPdf = mimeType === "application/pdf";

    const fileContent = isPdf
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: imageBase64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: (mimeType || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: imageBase64,
          },
        };

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            fileContent,
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(clean);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Analisis error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
