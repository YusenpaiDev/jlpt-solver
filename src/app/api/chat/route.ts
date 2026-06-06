import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { deepseek, DEEPSEEK_MODEL } from "@/lib/deepseek";

export async function POST(req: NextRequest) {
  try {
    const { message, context, history } = await req.json();

    const aturanKetat = `ATURAN JAWABAN — WAJIB DIIKUTI, tanpa kecuali:

1. PENDEK. Maksimal 1-2 kalimat. Jangan pernah lebih.
2. PLAIN TEXT doang. Dilarang KERAS pakai:
   - Tanda bintang ** atau __ (gak boleh bold)
   - Bullet list (- atau •)
   - Heading kayak "Breakdown:", "Penjelasan:", "Contoh:"
   - Tabel atau struktur formal
3. DILARANG pecah arti per kata. User minta arti kalimat → kasih arti kalimat doang. Gak usah jelasin "ちゃんとした = rapi, 格好 = penampilan, dst."
4. Bahasa Indonesia, santai, pakai "kamu".
5. Default: cuma kasih ARTI kalimat dalam 1 kalimat Indonesia. Selesai.
6. Boleh kasih konteks tambahan (1 kalimat) KALAU bener-bener perlu, tapi default jangan.

CONTOH JAWABAN YANG BENAR:
User: "卒業パーティーには、ちゃんとした格好で行ったほうがいいのかな maksud?"
Kamu: "Artinya 'Apa sebaiknya aku pergi ke pesta kelulusan dengan pakaian rapi ya?'. Nuansanya ragu-ragu, kayak nanya pendapat."

CONTOH JAWABAN YANG SALAH (jangan ditiru):
"Maksudnya: **'Apakah sebaiknya...'**. **Breakdown:** - **ちゃんとした** = rapi - **格好** = penampilan..."
↑ INI YANG DILARANG. Bertele-tele, pakai markdown, pecah-pecah per kata.`;

    const systemPrompt = context
      ? `Kamu Sensei JLPT, guru bahasa Jepang yang santai. Lagi diskusi sesi latihan ini:

Judul: ${context.title}
Soal-soal:
${context.questions
  .map((q: { question: string; correct: string; explanation: string }, i: number) =>
    `${i + 1}. ${q.question}\n   Jawaban benar: ${q.correct}\n   Penjelasan: ${q.explanation}`
  )
  .join("\n\n")}

${aturanKetat}`
      : `Kamu Sensei JLPT, guru bahasa Jepang yang santai.

${aturanKetat}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: { role: string; text: string }) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      })),
      { role: "user", content: message },
    ];

    const response = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 280,
      messages,
    });

    const rawReply = response.choices[0]?.message?.content ?? "Maaf, gagal membalas.";

    // Post-process: strip markdown kalau AI masih nyelipin (jaga-jaga prompt belum cukup)
    const reply = rawReply
      // Bold/italic: **text** atau __text__ atau *text* — keep teks-nya
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      // Bullet list di awal baris: - atau •
      .replace(/^\s*[-•]\s+/gm, "")
      // Heading kayak "Breakdown:", "Penjelasan:" di awal kalimat — biarin, susah strip tanpa false-positive
      .trim();

    return NextResponse.json({ success: true, reply });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      { error: "Gagal mengirim pesan. Coba lagi." },
      { status: 500 }
    );
  }
}
