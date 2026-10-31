import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { prepareChat, SENSEI_SCOPE } from "@/lib/chat-context";
import { pakaiKuota, responsKuota } from "@/lib/kuota";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  let input: ReturnType<typeof prepareChat>;
  try {
    input = prepareChat(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "Format pesan tidak valid." : error instanceof Error ? error.message : "Pesan tidak valid." }, { status: 400 });
  }
  const kuota = await pakaiKuota("chat");
  if (!kuota.ok) return responsKuota("chat", kuota);
  if (!input.question) return NextResponse.json({ success: true, reply: "Pilih soal yang mau dibahas dulu ya." });

  try {
    const messages: Anthropic.MessageParam[] = [
      ...input.history.map(m => ({ role: m.role, content: m.text })),
      { role: "user", content: JSON.stringify({ materi_soal: { judul: input.title, ...input.question }, pertanyaan: input.message }) },
    ];

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 280,
      system: SENSEI_SCOPE,
      messages,
    });

    const rawReply = response.content[0].type === "text" ? response.content[0].text : "Maaf, gagal membalas.";

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
