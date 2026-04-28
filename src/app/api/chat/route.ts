import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { message, context, history } = await req.json();

    const systemPrompt = context
      ? `Kamu adalah Sensei JLPT, guru bahasa Jepang yang ramah dan sabar.
Kamu sedang mendiskusikan sesi latihan berikut bersama pelajar:

Judul: ${context.title}
Soal-soal:
${context.questions
  .map((q: { question: string; correct: string; explanation: string }, i: number) =>
    `${i + 1}. ${q.question}\n   Jawaban benar: ${q.correct}\n   Penjelasan: ${q.explanation}`
  )
  .join("\n\n")}

Jawab pertanyaan pelajar dengan jelas dalam Bahasa Indonesia. Boleh tambahkan contoh kalimat Jepang jika membantu. Jangan terlalu panjang.`
      : "Kamu adalah Sensei JLPT, guru bahasa Jepang yang ramah. Jawab dalam Bahasa Indonesia.";

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
