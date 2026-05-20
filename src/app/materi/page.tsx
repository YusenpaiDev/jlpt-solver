"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, BottomNav } from "@/components/Sidebar";
import AppHeader from "@/components/AppHeader";
import { BookOpen, Type, Sparkles, ArrowUpRight, Lock } from "lucide-react";

interface MateriCard {
  label: string;
  kanji: string;
  sub: string;
  desc: string;
  accent: string;
  href: string | null;
  count?: number;
  comingSoon?: boolean;
}

export default function MateriHub() {
  const [kotobaCount, setKotobaCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("saved_words")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setKotobaCount(count ?? 0);
    })();
  }, []);

  const cards: MateriCard[] = [
    {
      label: "Kotoba",
      kanji: "語",
      sub: "KOSAKATA",
      desc: "Kamus kotoba kamu — flashcard, album, import, & quiz cepat.",
      accent: "#5ea87a",
      href: "/kamus",
      count: kotobaCount ?? undefined,
    },
    {
      label: "Bunpou",
      kanji: "文",
      sub: "TATA BAHASA",
      desc: "Grammar JLPT terstruktur per level — pola, contoh, latihan.",
      accent: "#a67bd4",
      href: null,
      comingSoon: true,
    },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[#d7e2ff]"
      style={{ fontFamily: "var(--font-manrope)" }}>

      <AppHeader activeHref="/materi" />

      <div className="flex flex-1 min-h-0">
        <Sidebar activeHref="/materi" />

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-10 pb-24 lg:pb-10 relative">

          {/* ambient */}
          <div className="pointer-events-none absolute top-0 right-0 w-[500px] h-[400px] opacity-[0.06] blur-[100px]"
            style={{ background: "radial-gradient(circle,#a67bd4,transparent 70%)" }} />

          <div className="relative max-w-5xl mx-auto flex flex-col gap-8">

            {/* Header */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[#5ea87a] shadow-[0_0_8px_#5ea87a]" />
                <span className="text-[10px] font-bold tracking-widest text-[#5ea87a]"
                  style={{ fontFamily: "var(--font-space)" }}>
                  MATERI BELAJAR · JLPT
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight"
                style={{ fontFamily: "var(--font-jakarta)" }}>
                <span className="text-[#d7e2ff]">Pilih materi</span>{" "}
                <span className="shimmer-text">buat dipelajari.</span>
              </h1>
              <p className="text-sm text-[#8a9bbf] max-w-xl leading-relaxed mt-1">
                Semua materi belajar JLPT kamu — dari kotoba sampai bunpou — terkumpul di sini. Tinggal pilih, langsung mulai.
              </p>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              {cards.map((c) => {
                const CardContent = (
                  <>
                    <div className="absolute inset-0 opacity-[0.07] transition-opacity group-hover:opacity-[0.12]"
                      style={{ background: `radial-gradient(circle at top right,${c.accent},transparent 65%)` }} />

                    <div className="relative flex items-start gap-4">
                      <div className="size-16 md:size-20 rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden"
                        style={{ background: `${c.accent}18`, boxShadow: `0 0 28px ${c.accent}25` }}>
                        <div className="absolute inset-0"
                          style={{ background: `radial-gradient(circle,${c.accent}30,transparent 70%)` }} />
                        <span className="relative font-black leading-none select-none"
                          style={{ fontSize: "2.5rem", color: c.accent, fontFamily: "var(--font-jakarta)", textShadow: `0 0 30px ${c.accent}80` }}>
                          {c.kanji}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold tracking-widest"
                            style={{ color: c.accent, fontFamily: "var(--font-space)" }}>
                            {c.sub}
                          </p>
                          {c.comingSoon && (
                            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: "rgba(166,123,212,0.15)", color: "#a67bd4", fontFamily: "var(--font-space)" }}>
                              <Lock className="size-2.5" /> COMING SOON
                            </span>
                          )}
                        </div>
                        <p className="text-2xl md:text-3xl font-extrabold text-[#d7e2ff] leading-none"
                          style={{ fontFamily: "var(--font-jakarta)" }}>
                          {c.label}
                        </p>
                        {c.count !== undefined && (
                          <p className="text-[11px] text-[#8a9bbf] mt-0.5"
                            style={{ fontFamily: "var(--font-space)" }}>
                            {c.count} KATA TERSIMPAN
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="relative text-sm text-[#8a9bbf] leading-relaxed mt-5">
                      {c.desc}
                    </p>

                    <div className="relative flex items-center gap-1 text-[11px] font-bold mt-5"
                      style={{ color: c.comingSoon ? "#4a5a7a" : c.accent, fontFamily: "var(--font-space)" }}>
                      {c.comingSoon ? "BELUM TERSEDIA" : "BUKA"} <ArrowUpRight className="size-3.5" />
                    </div>
                  </>
                );

                const baseStyle = {
                  background: "rgba(16,27,48,0.65)",
                  border: `1px solid ${c.accent}25`,
                  boxShadow: `0 0 30px ${c.accent}0d, inset 0 1px 0 rgba(255,255,255,0.04)`,
                };

                if (c.href) {
                  return (
                    <a key={c.label} href={c.href}
                      className="group flex flex-col gap-3 p-6 rounded-2xl backdrop-blur-md relative overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.99]"
                      style={baseStyle}>
                      {CardContent}
                    </a>
                  );
                }
                return (
                  <div key={c.label}
                    className="flex flex-col gap-3 p-6 rounded-2xl backdrop-blur-md relative overflow-hidden opacity-70 cursor-not-allowed"
                    style={baseStyle}>
                    {CardContent}
                  </div>
                );
              })}
            </div>

            {/* Soon footer */}
            <div className="rounded-2xl p-5 flex items-start gap-3 backdrop-blur-md"
              style={{ background: "rgba(16,27,48,0.5)", border: "1px solid rgba(107,156,218,0.12)" }}>
              <div className="size-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(107,156,218,0.15)" }}>
                <Sparkles className="size-4 text-[#6b9cda]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#d7e2ff] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>
                  Lebih banyak akan datang
                </p>
                <p className="text-xs text-[#8a9bbf] leading-relaxed">
                  Kanji, Choukai (listening), Dokkai (reading) lagi disiapin. Mau materi spesifik duluan? Bilang aja.
                </p>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(94,168,122,0.12)" }}>
                  <BookOpen className="size-4 text-[#5ea87a]" />
                </div>
                <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(166,123,212,0.12)" }}>
                  <Type className="size-4 text-[#a67bd4]" />
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      <BottomNav activeHref="/materi" />
    </div>
  );
}
