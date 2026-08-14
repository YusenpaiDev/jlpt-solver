import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* Ambil soal Lembar Tugas dari bank soal JLPT asli — gratis, gak nembak API.
   Bandingin sama /api/tugas/generate yang bikin soal baru pakai Claude tiap
   klik; itu sekarang cuma cadangan buat level yang banknya masih kosong. */

/** Bentuk baris bank_soal apa adanya dari database. */
interface BarisBank {
  id: string;
  level: string;
  category: string;
  question: string;
  options: string[];        // ["1. の", "2. のこと", ...]
  correct: string;          // "3" — 1-indeks
  explanation: string | null;
  why_wrong: string | null;
  grammar_points: { jp?: string; reading?: string; id?: string }[] | null;
  tip: string | null;
  passage: string | null;
}

/** Buang penomoran depan — Lembar Tugas nomorin sendiri lewat badge A/B/C/D,
    jadi "1. の" bakal kebaca "A 1. の" kalau dibiarin. */
function bersihkanOpsi(teks: string): string {
  return String(teks).replace(/^\s*[1-4１-４][．.、:：)）]?\s*/u, "").trim();
}

/** Bentuk bank → bentuk yang dipahami Lembar Tugas.

    Bank  : options ["1. の", ...] + correct "3"
    Tugas : options [{ text, correct: boolean }] */
function keBentukTugas(b: BarisBank, urutan: number) {
  const kunci = parseInt(b.correct, 10);

  return {
    id: urutan + 1,
    no: `問${urutan + 1}`,
    category: b.category,
    question: b.question,
    context: b.passage ?? "",
    options: (b.options ?? []).map((teks, i) => ({
      text: bersihkanOpsi(teks),
      correct: i + 1 === kunci,
    })),
    explanation: {
      correct: b.explanation ?? "",
      wrong: b.why_wrong ?? "",
      // grammar_points bank: { jp, reading, id } → Lembar Tugas: { term, meaning }
      grammar: (b.grammar_points ?? []).map(g => ({
        term: [g.jp, g.reading && g.reading !== g.jp ? `（${g.reading}）` : ""].filter(Boolean).join(""),
        meaning: g.id ?? "",
      })).filter(g => g.term),
      tips: b.tip ?? "",
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const { level, category, count } = await req.json();

    const lv = String(level ?? "N3");
    const jumlah = Math.min(30, Math.max(1, Number(count) || 10));
    // "全" di UI berarti campuran — dikirim null biar SQL-nya gak nyaring kategori.
    const kategori = category && category !== "全" ? String(category) : null;

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Login dulu buat ambil soal." }, { status: 401 });
    }

    // Pengacakan dikerjain database (order by random()), bukan di sini —
    // narik ribuan baris cuma buat diacak di Node itu yang mau dihindari.
    const { data, error } = await supabase.rpc("ambil_soal_acak", {
      p_level: lv,
      p_kategori: kategori,
      p_jumlah: jumlah,
    });

    if (error) {
      console.error("Bank soal error:", error);
      return NextResponse.json({ error: "Gagal ngambil soal dari bank." }, { status: 500 });
    }

    const baris = (data ?? []) as BarisBank[];

    if (baris.length === 0) {
      const label = kategori ? `${lv} ${kategori}` : lv;
      return NextResponse.json(
        { error: `Bank soal ${label} masih kosong. Coba level atau kategori lain.` },
        { status: 404 },
      );
    }

    const questions = baris.map(keBentukTugas);

    return NextResponse.json({
      success: true,
      data: { questions },
      meta: { requested: jumlah, delivered: questions.length, sumber: "bank" },
    });
  } catch (err) {
    console.error("Bank soal error:", err);
    return NextResponse.json({ error: "Gagal ngambil soal. Coba lagi." }, { status: 500 });
  }
}
