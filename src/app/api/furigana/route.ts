import { NextRequest, NextResponse } from "next/server";
import { deepseek, DEEPSEEK_MODEL } from "@/lib/deepseek";

export async function POST(req: NextRequest) {
  try {
    const { word, withMeaning, passage } = await req.json();

    /* ── Passage mode: mark up every kanji word with its reading ── */
    if (passage?.trim()) {
      const response = await deepseek.chat.completions.create({
        model: DEEPSEEK_MODEL,
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Tambahkan furigana ke teks Jepang berikut. Untuk SETIAP kata yang mengandung kanji, bungkus dengan format [[KANJI|FURIGANA]]. Hiragana, katakana, tanda baca, dan angka biarkan apa adanya. JANGAN tambah komentar, JANGAN ubah teks lain.

Contoh input: "今日は学校に行きました。"
Contoh output: "[[今日|きょう]]は[[学校|がっこう]]に[[行|い]]きました。"

Teks:
${passage.trim()}

Balas HANYA teks dengan markup [[…|…]], tanpa apapun yang lain.`,
        }],
      });
      const marked = (response.choices[0]?.message?.content ?? "").trim();
      return NextResponse.json({ marked });
    }

    if (!word?.trim()) return NextResponse.json({ reading: "", meaning: "" });

    if (withMeaning) {
      const response = await deepseek.chat.completions.create({
        model: DEEPSEEK_MODEL,
        max_tokens: 128,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: `Untuk kata Jepang "${word.trim()}", balas HANYA dengan JSON ini (tanpa markdown):
{"reading":"hiragana","meaning":"arti singkat dalam Bahasa Indonesia"}
Contoh: {"reading":"かんじ","meaning":"aksara kanji"}`,
        }],
      });

      const text = (response.choices[0]?.message?.content ?? "{}").trim();
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json({ reading: parsed.reading ?? "", meaning: parsed.meaning ?? "" });
      } catch {
        return NextResponse.json({ reading: "", meaning: "" });
      }
    }

    const response = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 64,
      messages: [{
        role: "user",
        content: `Berikan HANYA furigana (hiragana) untuk kata Jepang ini: "${word.trim()}"
Balas HANYA dengan hiragana saja, tanpa penjelasan, tanpa tanda baca tambahan.
Contoh: input "漢字" → output "かんじ"`,
      }],
    });

    const reading = (response.choices[0]?.message?.content ?? "").trim();
    return NextResponse.json({ reading });
  } catch (err) {
    console.error("Furigana error:", err);
    return NextResponse.json({ error: "Gagal generate" }, { status: 500 });
  }
}
