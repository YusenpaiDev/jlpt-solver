"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight, Shuffle, Loader2 } from "lucide-react";

interface SavedWord {
  id: string;
  kanji: string;
  reading: string | null;
  meaning: string;
  level: string | null;
}

const ACCENTS = [
  "#4a7abf","#8b5abf","#5ea87a","#e07b4a","#c05abf",
  "#6b9cda","#a67bd4","#4a9abf","#bbc6e2","#3a9a7a",
];
const accentFor = (idx: number) => ACCENTS[idx % ACCENTS.length];

export default function KamusFlashCard() {
  const [words,  setWords]  = useState<SavedWord[]>([]);
  const [order,  setOrder]  = useState<number[]>([]);
  const [idx,    setIdx]    = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // Paginasi (Supabase cap 1000/query) — ambil SEMUA kotoba buat flash.
        const ws: SavedWord[] = [];
        for (let from = 0; ; from += 1000) {
          const { data } = await supabase
            .from("saved_words")
            .select("id, kanji, reading, meaning, level")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .range(from, from + 999);
          const batch = (data ?? []) as SavedWord[];
          ws.push(...batch);
          if (batch.length < 1000) break;
        }
        if (ws.length > 0) {
          setWords(ws);
          setOrder(ws.map((_, i) => i));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shuffle = () => {
    setOrder(prev => [...prev].sort(() => Math.random() - 0.5));
    setIdx(0);
    setFlipped(false);
  };

  const prev = () => { setIdx(i => Math.max(0, i - 1)); setFlipped(false); };
  const next = () => { setIdx(i => Math.min(order.length - 1, i + 1)); setFlipped(false); };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <Loader2 className="size-5 text-[#4a5a7a] animate-spin" />
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="w-full rounded-2xl p-5 text-center"
        style={{ background: "#101b30", border: "1px solid rgba(107,156,218,0.1)" }}>
        <p className="text-sm text-[#4a5a7a]">Belum ada kata di kamus.</p>
        <p className="text-xs text-[#2a354b] mt-1">Analisis soal dulu biar kosakata otomatis tersimpan!</p>
      </div>
    );
  }

  const word    = words[order[idx]];
  const accent  = accentFor(order[idx]);
  const wordLen = word.kanji.length;
  const frontSz = wordLen <= 2 ? "5rem" : wordLen <= 4 ? "4rem" : wordLen <= 7 ? "2.8rem" : "1.8rem";
  const backSz  = wordLen <= 2 ? "3.5rem" : wordLen <= 4 ? "2.8rem" : wordLen <= 7 ? "2rem" : "1.5rem";

  return (
    <div className="w-full flex flex-col gap-3">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
          {idx + 1} / {order.length} · KAMUS KAMU
        </span>
        <button onClick={shuffle}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all hover:brightness-110"
          style={{ background: "rgba(74,122,191,0.12)", color: "#6b9cda", fontFamily: "var(--font-space)" }}>
          <Shuffle className="size-3" /> ACAK
        </button>
      </div>

      {/* 3D flip card */}
      <div style={{ perspective: "1200px" }}>
        <div
          onClick={() => setFlipped(f => !f)}
          className="relative w-full cursor-pointer"
          style={{
            height: "clamp(220px, 35vh, 320px)",
            transformStyle: "preserve-3d",
            transition: "transform 0.55s cubic-bezier(0.4,0.2,0.2,1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}>

          {/* Front — kanji only */}
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-4 p-6"
            style={{
              background: "#101b30",
              border: `1px solid ${accent}30`,
              boxShadow: `0 0 50px ${accent}18`,
              backfaceVisibility: "hidden",
            }}>
            <div className="absolute inset-0 opacity-10 rounded-2xl"
              style={{ background: `radial-gradient(circle at center,${accent},transparent 65%)` }} />
            {word.level && (
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold relative"
                style={{ background: `${accent}20`, color: accent, fontFamily: "var(--font-space)" }}>
                JLPT {word.level}
              </span>
            )}
            <span className="relative font-black leading-tight text-center"
              style={{ fontSize: frontSz, color: accent, fontFamily: "var(--font-jakarta)", textShadow: `0 0 40px ${accent}70` }}>
              {word.kanji}
            </span>
            <p className="text-[10px] text-[#2a354b] relative" style={{ fontFamily: "var(--font-space)" }}>
              KETUK UNTUK LIHAT JAWABAN
            </p>
          </div>

          {/* Back — reading + meaning */}
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-4 p-6"
            style={{
              background: "#101b30",
              border: `1px solid ${accent}30`,
              boxShadow: `0 0 50px ${accent}18`,
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}>
            <div className="absolute inset-0 opacity-10 rounded-2xl"
              style={{ background: `radial-gradient(circle at center,${accent},transparent 65%)` }} />
            <span className="relative font-black leading-tight text-center"
              style={{ fontSize: backSz, color: accent, fontFamily: "var(--font-jakarta)" }}>
              {word.kanji}
            </span>
            {word.reading && (
              <p className="relative text-lg text-[#8a9bbf] text-center" style={{ fontFamily: "var(--font-jakarta)" }}>
                {word.reading}
              </p>
            )}
            <div className="relative w-full px-4 py-3 rounded-xl text-center"
              style={{ background: "rgba(8,16,36,0.6)" }}>
              <p className="text-base text-[#d7e2ff] font-semibold leading-snug" style={{ fontFamily: "var(--font-manrope)" }}>
                {word.meaning}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button onClick={prev} disabled={idx === 0}
          className="size-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 hover:brightness-110"
          style={{ background: "#101b30" }}>
          <ChevronLeft className="size-5 text-[#6b9cda]" />
        </button>
        <button onClick={() => setFlipped(f => !f)}
          className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
          style={{ background: "rgba(74,122,191,0.15)", color: "#6b9cda", fontFamily: "var(--font-space)" }}>
          {flipped ? "SEMBUNYIKAN" : "LIHAT JAWABAN"}
        </button>
        <button onClick={next} disabled={idx === order.length - 1}
          className="size-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 hover:brightness-110"
          style={{ background: "#101b30" }}>
          <ChevronRight className="size-5 text-[#6b9cda]" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 justify-center flex-wrap">
        {order.slice(Math.max(0, idx - 5), idx + 6).map((_, i) => {
          const absIdx = Math.max(0, idx - 5) + i;
          return (
            <div key={absIdx} className="rounded-full transition-all"
              style={{
                width: absIdx === idx ? "18px" : "5px",
                height: "5px",
                background: absIdx === idx ? accent : "rgba(74,122,191,0.2)",
              }} />
          );
        })}
      </div>
    </div>
  );
}
