"use client";

import { Sidebar, BottomNav } from "@/components/Sidebar";
import AppHeader from "@/components/AppHeader";
import { BookOpen, Type, Sparkles, ArrowUpRight, Lock, Upload, Clock, FileText, Headphones, ScrollText } from "lucide-react";

interface MateriCard {
  label: string;
  kanji: string;
  sub: string;
  desc: string;
  accent: string;
  href: string | null;
  comingSoon?: boolean;
}

export default function MateriHub() {
  const cards: MateriCard[] = [
    {
      label: "Kotoba",
      kanji: "語",
      sub: "KOSAKATA",
      desc: "Materi kosakata terstruktur per level. Lagi disiapin — kamu bakal bisa upload file kotoba sendiri.",
      accent: "#5ea87a",
      href: null,
      comingSoon: true,
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

  const upcomingMateri = [
    { kanji: "字", label: "Kanji",   sub: "Karakter & stroke",  accent: "#e07b4a", icon: Type },
    { kanji: "聴", label: "Choukai", sub: "Latihan listening",  accent: "#6b9cda", icon: Headphones },
    { kanji: "読", label: "Dokkai",  sub: "Reading comprehension", accent: "#c05abf", icon: ScrollText },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[#d7e2ff]"
      style={{ fontFamily: "var(--font-manrope)" }}>

      <AppHeader activeHref="/materi" />

      <div className="flex flex-1 min-h-0">
        <Sidebar activeHref="/materi" />

        {/* ── Main ── */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-10 pb-24 lg:pb-10 relative">

          {/* ambient */}
          <div className="pointer-events-none absolute top-0 right-0 w-[500px] h-[400px] opacity-[0.06] blur-[100px]"
            style={{ background: "radial-gradient(circle,#a67bd4,transparent 70%)" }} />

          <div className="relative flex flex-col gap-8 max-w-3xl">

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
                    className="group flex flex-col gap-3 p-6 rounded-2xl backdrop-blur-md relative overflow-hidden opacity-70 cursor-not-allowed"
                    style={baseStyle}>
                    {CardContent}
                  </div>
                );
              })}
            </div>

            {/* Info: upload your own */}
            <div className="rounded-2xl p-5 flex items-start gap-4 backdrop-blur-md relative overflow-hidden"
              style={{ background: "rgba(16,27,48,0.55)", border: "1px solid rgba(224,123,74,0.18)" }}>
              <div className="absolute inset-0 opacity-[0.08]"
                style={{ background: "radial-gradient(circle at top right,#e07b4a,transparent 60%)" }} />
              <div className="relative size-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(224,123,74,0.15)" }}>
                <Upload className="size-4 text-[#e07b4a]" />
              </div>
              <div className="relative flex-1 min-w-0">
                <p className="text-sm font-bold text-[#d7e2ff] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>
                  Mau pake materi kamu sendiri?
                </p>
                <p className="text-xs text-[#8a9bbf] leading-relaxed">
                  Nanti kamu bisa upload file kotoba lokal (txt/csv/pdf) ke sini, terus dijadiin materi belajar yang terstruktur — lengkap sama flashcard, album, dan latihan.
                </p>
              </div>
            </div>

          </div>
        </main>

        {/* ── Right Sidebar ── */}
        <aside
          className="w-[280px] shrink-0 hidden xl:flex flex-col py-6 px-4 overflow-y-auto backdrop-blur-xl"
          style={{
            background: "rgba(8,16,36,0.55)",
            borderLeft: "1px solid rgba(107,156,218,0.1)",
            boxShadow: "inset 1px 0 0 rgba(255,255,255,0.03)",
          }}
        >
          {/* Section: Upcoming materi */}
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>
              Materi mendatang
            </span>
            <span className="text-[10px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
              {upcomingMateri.length}
            </span>
          </div>
          <p className="text-[10px] text-[#4a5a7a] mb-4 flex items-center gap-1"
            style={{ fontFamily: "var(--font-space)" }}>
            <Clock className="size-2.5" />
            Lagi disiapin, sabar yaa
          </p>

          <div className="flex flex-col gap-2.5 mb-6">
            {upcomingMateri.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl backdrop-blur-md relative overflow-hidden opacity-75"
                  style={{ background: "rgba(16,27,48,0.6)", border: `1px solid ${m.accent}20` }}>
                  <div className="size-9 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden"
                    style={{ background: `${m.accent}18` }}>
                    <span className="relative font-black"
                      style={{ fontSize: "1.1rem", color: m.accent, fontFamily: "var(--font-jakarta)", textShadow: `0 0 16px ${m.accent}60` }}>
                      {m.kanji}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-[#d7e2ff]"
                        style={{ fontFamily: "var(--font-jakarta)" }}>{m.label}</p>
                      <Lock className="size-2.5 text-[#4a5a7a]" />
                    </div>
                    <p className="text-[10px] text-[#4a5a7a] truncate">{m.sub}</p>
                  </div>
                  <Icon className="size-3.5 shrink-0" style={{ color: m.accent, opacity: 0.5 }} />
                </div>
              );
            })}
          </div>

          {/* Section: Upload tip */}
          <div className="rounded-2xl p-4 backdrop-blur-md mb-6 relative overflow-hidden"
            style={{ background: "rgba(16,27,48,0.55)", border: "1px solid rgba(94,168,122,0.18)" }}>
            <div className="absolute inset-0 opacity-[0.08]"
              style={{ background: "radial-gradient(circle at top left,#5ea87a,transparent 65%)" }} />
            <div className="relative flex items-center gap-2 mb-2">
              <div className="size-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(94,168,122,0.15)" }}>
                <FileText className="size-3.5 text-[#5ea87a]" />
              </div>
              <p className="text-xs font-bold text-[#d7e2ff]" style={{ fontFamily: "var(--font-jakarta)" }}>
                Punya file materi?
              </p>
            </div>
            <p className="relative text-[11px] text-[#8a9bbf] leading-relaxed mb-3">
              Kalau punya kotoba dari buku/PDF/txt, taro di folder <span className="text-[#bbc6e2] font-mono">materi/</span> di project — nanti aku bantu bikin materi belajarnya.
            </p>
            <span className="relative text-[10px] font-bold text-[#5ea87a]"
              style={{ fontFamily: "var(--font-space)" }}>
              MASIH DRAFT
            </span>
          </div>

          {/* Section: Tip */}
          <div className="rounded-2xl p-4 backdrop-blur-md relative overflow-hidden"
            style={{ background: "rgba(16,27,48,0.55)", border: "1px solid rgba(107,156,218,0.12)" }}>
            <div className="absolute inset-0 opacity-[0.07]"
              style={{ background: "radial-gradient(circle at bottom right,#6b9cda,transparent 65%)" }} />
            <div className="relative flex items-center gap-2 mb-2">
              <Sparkles className="size-3.5 text-[#6b9cda]" />
              <p className="text-xs font-bold text-[#d7e2ff]" style={{ fontFamily: "var(--font-jakarta)" }}>
                Tips belajar
              </p>
            </div>
            <p className="relative text-[11px] text-[#8a9bbf] leading-relaxed">
              Konsisten 15 menit per hari jauh lebih efektif daripada belajar maraton 3 jam sekali sebulan. Pilih satu materi, gass tiap hari.
            </p>
          </div>

          {/* Spacer for bottom */}
          <div className="flex-1" />

          {/* Footer hint */}
          <div className="flex items-center justify-center gap-2 pt-4 opacity-50">
            <BookOpen className="size-3 text-[#4a5a7a]" />
            <span className="text-[9px] text-[#4a5a7a] tracking-widest font-bold"
              style={{ fontFamily: "var(--font-space)" }}>
              SENSEI · MATERI
            </span>
          </div>
        </aside>
      </div>

      <BottomNav activeHref="/materi" />
    </div>
  );
}
