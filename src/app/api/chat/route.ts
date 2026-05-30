import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { message, context, history } = await req.json();

    const systemPrompt = context
      ? `Kamu Sensei JLPT, guru bahasa Jepang yang santai. Lagi diskusi sesi latihan ini:

Judul: ${context.title}
Soal-soal:
${context.questions
  .map((q: { question: string; correct: string; explanation: string }, i: number) =>
    `${i + 1}. ${q.question}\n   Jawaban benar: ${q.correct}\n   Penjelasan: ${q.explanation}`
  )
  .join("\n\n")}

ATURAN JAWABAN — wajib diikuti:
- SINGKAT. Maksimal 2-3 kalimat. Jangan bertele-tele.
- JANGAN pakai markdown (gak ada **bold**, bullet list, heading "Breakdown:", dll).
- JANGAN pecah per kata kayak "**ちゃんとした** = rapi, **格好** = ...". User minta arti, kasih arti — jangan kuliahin.
- Tone santai, kayak ngobrol sama temen. Pakai "kamu", bukan "Anda".
- Boleh kasih 1 contoh kalimat Jepang KALAU bener-bener perlu, tapi default jangan.
- Bahasa Indonesia.`
      : `Kamu Sensei JLPT, guru bahasa Jepang yang santai. Jawab Bahasa Indonesia.

ATURAN: singkat (2-3 kalimat), jangan pakai markdown, jangan pecah per kata, tone ngobrol santai pakai "kamu".`;

    const messages: Anthropic.MessageParam[] = [
      ...(history || []).map((m: { role: string; text: string }) => ({
        role: m.role === "user" ? "user" : "assistant" as "user" | "assistant",
        content: m.text,
      })),
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "Maaf, gagal membalas.";
    return NextResponse.json({ success: true, reply });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      { error: "Gagal mengirim pesan. Coba lagi." },
      { status: 500 }
    );
  }
}
