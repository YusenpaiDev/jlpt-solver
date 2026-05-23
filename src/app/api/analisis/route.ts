import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // 5 min — needed for large docx/PDF

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* Extract the JSON object block out of a wrapped response (markdown / prose). */
function extractJsonBlock(text: string): string {
  let s = text.trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  if (s.startsWith("{")) return s;
  // Fall back: grab everything between the first '{' and the last '}'.
  const start = s.indexOf("{");
  const end   = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return s;
}

/* Try to salvage truncated JSON by closing open structures at every depth */
function repairJson(raw: string): unknown | null {
  // Remove trailing comma and any unterminated string
  const s = raw.replace(/,\s*$/, "").replace(/"[^"]*$/, '"...');
  // Try closing at increasing depths
  const closings = ["}", "}]", "}]}", "]}", "}]}]", "}]}]}", "]}]}", "}]}]}]"];
  for (const tail of closings) {
    try { return JSON.parse(s + tail); } catch { /* keep trying */ }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, level, category, textContent } = await req.json();

    if (!imageBase64 && !textContent) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
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
6. Poin grammar/kosakata: kata kunci Jepang + furigana + arti Indonesia
7. Tips ujian singkat
8. Kategori soal: "文法"/"語彙"/"文字"/"読解"
9. Jika soal ini 読解: sertakan TEKS BACAAN LENGKAP di field "passage". Jika soal 読解 lanjutan yang bacaannya sama dengan soal sebelumnya, isi "passage" dengan null.

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
      "grammar_points": [{"jp": "単語", "reading": "たんご", "id": "arti dalam Bahasa Indonesia"}],
      "tip": "tips ujian — WAJIB Bahasa Indonesia",
      "category": "文法",
      "passage": null
    }
  ]
}`;

    const isDocx = !!textContent;
    const isPdf  = mimeType === "application/pdf";

    // Put the (identical-across-chunks) prompt FIRST and mark it for prompt
    // caching. Subsequent chunks of the same PDF re-use the cached prefix at
    // ~10% of base input cost. Cache TTL is 5 min — well over the time it
    // takes to process all chunks sequentially.
    const cachedPromptBlock = {
      type: "text" as const,
      text: prompt,
      cache_control: { type: "ephemeral" as const },
    };

    let contentBlocks: Anthropic.MessageParam["content"];

    if (isDocx) {
      contentBlocks = [
        cachedPromptBlock,
        { type: "text", text: `Berikut adalah isi dokumen Word yang berisi soal JLPT:\n\n${textContent}` },
      ];
    } else {
      const fileContent = isPdf
        ? {
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: imageBase64 },
          }
        : {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: (mimeType || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: imageBase64,
            },
          };
      contentBlocks = [cachedPromptBlock, fileContent];
    }

    // Sonnet-only: prioritize analysis quality over cost. Each PDF is already
    // auto-split into 2-page chunks on the frontend, so token usage stays
    // reasonable per request. Prompt caching cuts repeat-chunk input cost ~90%.
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 64000,
      messages: [{ role: "user", content: contentBlocks }],
    });
    const message    = await stream.finalMessage();
    const usage      = message.usage;
    console.info("Analisis tokens:", {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cache_write: usage.cache_creation_input_tokens ?? 0,
      cache_read: usage.cache_read_input_tokens ?? 0,
      fileType: isPdf ? "pdf" : isDocx ? "docx" : "image",
    });
    const stopReason = message.stop_reason ?? "unknown";
    const text       = message.content[0]?.type === "text" ? message.content[0].text : "";
    const clean      = extractJsonBlock(text);

    let parsed: unknown;
    try { parsed = JSON.parse(clean); }
    catch { parsed = repairJson(clean); }

    const modelUsed = "sonnet-4.6";

    if (!parsed) {
      // Log everything we can on the server so debugging is easy later.
      console.error("Analisis parse failed:", {
        modelUsed,
        stopReason,
        textLength: text.length,
        first300: text.slice(0, 300),
        last300: text.slice(-300),
        fileType: isPdf ? "pdf" : isDocx ? "docx" : "image",
      });

      // Surface a hint matched to the most likely cause.
      let hint = "Coba ulang sekali lagi atau pisah file jadi bagian lebih kecil.";
      if (stopReason === "max_tokens") {
        hint = isPdf
          ? "PDF terlalu padat — soal/teks-nya kebanyakan. Pisah jadi 5–10 halaman per file, terus upload terpisah."
          : "Isi soal kebanyakan untuk sekali analisis. Pisah jadi beberapa file.";
      } else if (stopReason === "refusal") {
        hint = "AI menolak menjawab konten ini. Cek file-nya nggak ada hal yang sensitif.";
      } else if (text.trim().length === 0) {
        hint = "AI nggak menghasilkan respons. Cek file rusak/kosong, lalu coba lagi.";
      }
      throw new Error(`Respons AI tidak bisa diproses (alasan: ${stopReason}). ${hint}`);
    }

    return NextResponse.json({ success: true, data: parsed, stopReason, modelUsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Analisis error:", msg);

    // Surface common Anthropic-side errors in plain Bahasa so the user knows what to do.
    let friendly = msg;
    const lower = msg.toLowerCase();
    if (lower.includes("credit balance") || lower.includes("billing")) {
      friendly = "Kredit Anthropic API udah habis. Top-up dulu di console.anthropic.com supaya analisis bisa lanjut.";
    } else if (lower.includes("rate limit") || lower.includes("429")) {
      friendly = "Lagi banyak request — kena rate limit. Tunggu 30 detik terus coba lagi.";
    } else if (lower.includes("overloaded") || lower.includes("529")) {
      friendly = "Server AI lagi overload. Coba lagi sebentar.";
    } else if (lower.includes("invalid api key") || lower.includes("authentication")) {
      friendly = "API key Anthropic invalid. Cek environment variable ANTHROPIC_API_KEY di Vercel.";
    }

    return NextResponse.json(
      { error: friendly },
      { status: 500 }
    );
  }
}
