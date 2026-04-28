"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, BottomNav } from "@/components/Sidebar";
import {
  Bell, Upload, Camera,
  Clock, BookMarked, Flame,
  Target, TrendingUp, Sparkles,
  ArrowUpRight, ChevronDown, Loader2,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────── */
interface Session {
  id: string;
  level: string;
  category: string;
  title: string;
  total: number;
  score: number | null;
  created_at: string;
}

/* ─── Helpers ─────────────────────────────────────────────────── */
const categoryMeta: Record<string, { kanji: string; accent: string; from: string; to: string }> = {
  "文法": { kanji: "文", accent: "#4a7abf", from: "#0d2a50", to: "#071327" },
  "語彙": { kanji: "語", accent: "#8b5abf", from: "#1e0f3a", to: "#071327" },
  "文字": { kanji: "字", accent: "#3a9a7a", from: "#0a2a1e", to: "#071327" },
  "読解": { kanji: "読", accent: "#c0844a", from: "#2e1a06", to: "#071327" },
  "AI":   { kanji: "全", accent: "#4a9abf", from: "#072030", to: "#071327" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return "BARU SAJA";
  if (mins  < 60)  return `${mins} MENIT LALU`;
  if (hours < 24)  return `${hours} JAM LALU`;
  if (days  === 1) return "KEMARIN";
  return `${days} HARI LALU`;
}

/* ─── Page ────────────────────────────────────────────────────── */

export default function Home() {
  const [sessions,   setSessions]   = useState<Session[]>([]);
  const [streak,     setStreak]     = useState(0);
  const [totalSoal,  setTotalSoal]  = useState(0);
  const [avgScore,   setAvgScore]   = useState<number | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [profileRes, sessionRes] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("sessions").select("id,level,category,title,total,score,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      if (profileRes.data) setStreak(profileRes.data.streak ?? 0);

      const sess: Session[] = sessionRes.data ?? [];
      setSessions(sess.slice(0, 4));

      const total = sess.reduce((s, r) => s + (r.total ?? 0), 0);
      setTotalSoal(total);

      const scored = sess.filter(r => r.score != null && r.total);
      if (scored.length > 0) {
        const avg = scored.reduce((s, r) => s + r.score! / r.total, 0) / scored.length;
        setAvgScore(Math.round(avg * 100));
      }

      setLoading(false);
    }
    load();
  }, []);

  const statItems = [
    { icon: BookMarked, value: loading ? "—" : String(totalSoal), label: "Soal Dianalisis",   color: "#6b8cba" },
    { icon: Target,     value: loading ? "—" : avgScore != null ? `${avgScore}%` : "—", label: "Akurasi Rata-rata", color: "#5ea87a" },
    { icon: Flame,      value: loading ? "—" : String(streak),    label: "Hari Streak",        color: "#e07b4a" },
  ];

  return (
    <div
      className="flex flex-col h-screen overflow-hidden text-[#d7e2ff] bg-space"
      style={{ fontFamily: "var(--font-manrope)" }}
    >
      {/* ── Particle background ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="stars" />
        <div className="particle particle-1" />
        <div className="particle particle-2" />
        <div className="particle particle-3" />
        <div className="particle particle-4" />
      </div>
      {/* ── Top Header ── */}
      <header
        className="flex items-center justify-between px-4 md:px-6 py-3 shrink-0 border-b backdrop-blur-md"
        style={{ background: "rgba(3,9,26,0.6)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-4 md:gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div
              className="size-6 rounded-md flex items-center justify-center text-[10px] font-black text-[#071327]"
              style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)" }}
            >
              S
            </div>
            <span className="text-sm font-bold tracking-tight text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>
              Sensei JLPT
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-0.5">
            {["Materi", "Latihan", "Pro"].map((item, i) => (
              <button
                key={item}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  i === 0
                    ? "text-[#d7e2ff] font-medium"
                    : "text-[#8a9bbf] hover:text-[#d7e2ff] hover:bg-white/5"
                }`}
              >
                {item}
                {item === "Pro" && (
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-[#071327]"
                    style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", fontFamily: "var(--font-space)" }}>
                    NEW
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <a href="/premium"
            className="hidden sm:flex text-[11px] px-4 py-1.5 rounded-full font-medium border transition-colors hover:bg-white/5"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "#bbc6e2", fontFamily: "var(--font-space)" }}>
            Langganan
          </a>
          <button className="relative size-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
            <Bell className="size-4 text-[#8a9bbf]" />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-400 ring-2 ring-[#071327]" />
          </button>
          <div
            className="size-8 rounded-full flex items-center justify-center text-xs font-bold text-[#071327] ring-2 ring-[#2f4865]"
            style={{ background: "linear-gradient(135deg,#bbc6e2,#4a7abf)" }}
          >
            A
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left Sidebar ── */}
        <Sidebar activeHref="/" />

        {/* ── Main Content ── */}
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 md:px-10 py-5 md:py-8 pb-20 lg:pb-8 relative" style={{ background: "transparent" }}>

          {/* Ambient glow blobs */}
          <div
            className="pointer-events-none absolute top-0 left-1/4 w-[500px] h-[400px] opacity-[0.07] blur-[80px]"
            style={{ background: "radial-gradient(circle,#4a7abf,transparent 70%)" }}
          />
          <div
            className="pointer-events-none absolute top-20 right-0 w-[300px] h-[300px] opacity-[0.05] blur-[60px]"
            style={{ background: "radial-gradient(circle,#8b5abf,transparent 70%)" }}
          />

          {/* Decorative floating kanji */}
          <div
            className="animate-float3 pointer-events-none absolute right-10 top-4 text-[220px] font-black leading-none select-none"
            style={{
              color: "transparent",
              WebkitTextStroke: "1px rgba(107,156,218,0.07)",
              fontFamily: "var(--font-jakarta)",
            }}
          >
            解
          </div>

          {/* Floating small kanji decorations */}
          <div className="animate-float pointer-events-none absolute left-[55%] top-[12%] text-5xl font-black select-none opacity-[0.06]"
            style={{ color: "#6b9cda", fontFamily: "var(--font-jakarta)" }}>語</div>
          <div className="animate-float2 pointer-events-none absolute left-[72%] top-[40%] text-4xl font-black select-none opacity-[0.05]"
            style={{ color: "#a67bd4", fontFamily: "var(--font-jakarta)" }}>文</div>
          <div className="animate-float3 pointer-events-none absolute left-[40%] top-[65%] text-3xl font-black select-none opacity-[0.05]"
            style={{ color: "#5ea87a", fontFamily: "var(--font-jakarta)" }}>読</div>

          <div className="relative flex flex-col">
            {/* AI status badge */}
            <div className="flex items-center gap-2 mb-6 self-start">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium"
                style={{ background: "#101b30", color: "#8ab4e8", fontFamily: "var(--font-space)" }}
              >
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                AI ENGINE AKTIF
              </div>
              <span className="text-[10px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
                CONTENT STUDY SYSTEM
              </span>
            </div>

            {/* Level selector */}
            <div className="flex items-center gap-2 mb-4">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:brightness-110"
                style={{ background: "#2f4865", color: "#8ab4e8", fontFamily: "var(--font-space)" }}
              >
                JLPT N2 <ChevronDown className="size-3 opacity-60" />
              </button>
            </div>

            {/* Hero */}
            <h1
              className="text-[2.2rem] md:text-[3.8rem] font-extrabold leading-[1.05] tracking-tight mb-5 animate-fade-in"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              <span className="text-[#d7e2ff]">Taklukan JLPT</span>
              <br />
              <span className="shimmer-text">Dengan Presisi AI.</span>
            </h1>

            <p className="text-base text-[#8a9bbf] max-w-xl leading-relaxed mb-8">
              Unggah foto soal bahasa Jepangmu dan dapatkan penjelasan{" "}
              <span className="text-[#bbc6e2]">tata bahasa</span>,{" "}
              <span className="text-[#bbc6e2]">kanji</span>, dan{" "}
              <span className="text-[#bbc6e2]">kosakata</span> secara instan dari Sensei.
            </p>

            {/* Stats strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              {statItems.map(({ icon: Icon, value, label, color }) => (
                <div
                  key={label}
                  className="flex-1 flex items-center gap-3 px-5 py-3.5 rounded-xl backdrop-blur-md"
                  style={{
                    background: "rgba(16,27,48,0.6)",
                    border: `1px solid ${color}22`,
                    boxShadow: `0 0 20px ${color}0d, inset 0 1px 0 rgba(255,255,255,0.04)`,
                  }}
                >
                  <div className="size-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${color}18` }}>
                    <Icon className="size-4" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-[#d7e2ff] leading-none mb-0.5"
                      style={{ fontFamily: "var(--font-jakarta)" }}>
                      {value}
                    </p>
                    <p className="text-[11px] text-[#4a5a7a]"
                      style={{ fontFamily: "var(--font-space)" }}>
                      {label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ambil Foto */}
              <a
                href="/analisis-foto?mode=camera"
                className="group flex flex-col items-start gap-5 p-7 rounded-2xl transition-all hover:scale-[1.01] text-left relative overflow-hidden backdrop-blur-md"
                style={{
                  background: "rgba(16,27,48,0.65)",
                  border: "1px solid rgba(74,122,191,0.2)",
                  boxShadow: "0 0 30px rgba(74,122,191,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: "radial-gradient(circle at 30% 30%,rgba(74,122,191,0.18),transparent 70%)" }}
                />
                <div
                  className="animate-border-glow relative size-12 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#1a3a6f,#0f1a2e)" }}
                >
                  <Camera className="size-5 text-[#6b9cda]" />
                </div>
                <div className="relative">
                  <p className="font-bold text-[#d7e2ff] text-base mb-1.5"
                    style={{ fontFamily: "var(--font-jakarta)" }}>
                    Ambil Foto
                  </p>
                  <p className="text-xs text-[#4a5a7a] leading-relaxed">
                    Gunakan kamera untuk memindai soal langsung
                  </p>
                </div>
                <div className="relative flex items-center gap-1 text-[11px] text-[#4a7abf] font-semibold"
                  style={{ fontFamily: "var(--font-space)" }}>
                  BUKA KAMERA <ArrowUpRight className="size-3.5" />
                </div>
              </a>

              {/* Unggah Soal */}
              <a
                href="/analisis-foto?mode=upload"
                className="group flex flex-col items-start gap-5 p-7 rounded-2xl transition-all hover:scale-[1.01] text-left relative overflow-hidden backdrop-blur-md"
                style={{
                  background: "rgba(16,27,48,0.65)",
                  border: "1px solid rgba(139,90,191,0.2)",
                  boxShadow: "0 0 30px rgba(139,90,191,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: "radial-gradient(circle at 30% 30%,rgba(139,90,191,0.18),transparent 70%)" }}
                />
                <div
                  className="relative size-12 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#2a1a4f,#0f0a25)", boxShadow: "0 0 20px rgba(139,90,191,0.4)", animation: "border-glow 3s ease-in-out infinite 1.5s" }}
                >
                  <Upload className="size-5 text-[#a67bd4]" />
                </div>
                <div className="relative">
                  <p className="font-bold text-[#d7e2ff] text-base mb-1.5"
                    style={{ fontFamily: "var(--font-jakarta)" }}>
                    Unggah Soal
                  </p>
                  <p className="text-xs text-[#4a5a7a] leading-relaxed">
                    Pilih file gambar atau PDF dan penganalisanya
                  </p>
                </div>
                <div className="relative flex items-center gap-1 text-[11px] text-[#8b5abf] font-semibold"
                  style={{ fontFamily: "var(--font-space)" }}>
                  PILIH FILE <ArrowUpRight className="size-3.5" />
                </div>
              </a>
            </div>

            {/* Bottom note */}
            <p className="mt-6 text-[11px] text-[#4a5a7a] flex items-center gap-1.5">
              <TrendingUp className="size-3" />
              +92k Students Studying Today
            </p>

            {/* ── Kanji Hari Ini + Latihan Kilat ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">

              {/* Kanji Hari Ini */}
              <div
                className="rounded-2xl p-5 relative overflow-hidden flex flex-col gap-3 backdrop-blur-md"
                style={{
                  background: "rgba(16,27,48,0.65)",
                  border: "1px solid rgba(187,198,226,0.1)",
                  boxShadow: "0 0 24px rgba(107,140,186,0.07), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-[0.07]"
                  style={{ background: "radial-gradient(circle at top left,#bbc6e2,transparent 65%)" }}
                />
                <div className="relative flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#4a5a7a]"
                    style={{ fontFamily: "var(--font-space)" }}>
                    KANJI HARI INI
                  </span>
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "#2f4865", color: "#8ab4e8", fontFamily: "var(--font-space)" }}>
                    N2
                  </span>
                </div>

                <div className="relative flex items-center gap-4">
                  <div
                    className="size-16 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg,#1a2a3f,#0a1525)" }}
                  >
                    <span
                      className="text-4xl font-black text-[#d7e2ff]"
                      style={{ fontFamily: "var(--font-jakarta)", textShadow: "0 0 20px rgba(187,198,226,0.3)" }}
                    >
                      諦
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-[#d7e2ff]"
                      style={{ fontFamily: "var(--font-jakarta)" }}>
                      あきらめる
                    </p>
                    <p className="text-[11px] text-[#8a9bbf]">Menyerah · Putus asa</p>
                    <div className="flex gap-1 mt-0.5">
                      {["On: テイ", "Kun: あきら"].map((r) => (
                        <span
                          key={r}
                          className="text-[9px] px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(187,198,226,0.08)", color: "#8a9bbf", fontFamily: "var(--font-space)" }}>
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  className="relative rounded-xl p-3"
                  style={{ background: "rgba(187,198,226,0.04)", borderLeft: "2px solid rgba(107,140,186,0.4)" }}
                >
                  <p className="text-xs text-[#d7e2ff] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>
                    諦めずに続けてください。
                  </p>
                  <p className="text-[10px] text-[#8a9bbf]">Tolong teruslah tanpa menyerah.</p>
                </div>
              </div>

              {/* Latihan Kilat */}
              <div
                className="rounded-2xl p-5 relative overflow-hidden flex flex-col gap-3 backdrop-blur-md"
                style={{
                  background: "rgba(16,27,48,0.65)",
                  border: "1px solid rgba(94,168,122,0.15)",
                  boxShadow: "0 0 24px rgba(94,168,122,0.07), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-[0.06]"
                  style={{ background: "radial-gradient(circle at top right,#5ea87a,transparent 65%)" }}
                />
                <div className="relative flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#4a5a7a]"
                    style={{ fontFamily: "var(--font-space)" }}>
                    LATIHAN KILAT
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[#5ea87a]"
                    style={{ fontFamily: "var(--font-space)" }}>
                    <Flame className="size-3" /> 7 HARI STREAK
                  </span>
                </div>

                <p className="relative text-sm text-[#d7e2ff] leading-relaxed"
                  style={{ fontFamily: "var(--font-jakarta)" }}>
                  彼女は{" "}
                  <span
                    className="inline-block px-2 py-0.5 rounded-md text-[#071327] font-bold"
                    style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)" }}>
                    ＿＿＿
                  </span>
                  {" "}ので、試験に合格した。
                </p>
                <p className="relative text-[11px] text-[#8a9bbf] -mt-1">
                  Dia lulus ujian karena...
                </p>

                <div className="relative flex flex-col gap-2">
                  {[
                    { text: "一生懸命勉強した", correct: true },
                    { text: "遊んでいた", correct: false },
                    { text: "寝ていた", correct: false },
                  ].map(({ text, correct }, i) => (
                    <button
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-all hover:brightness-110"
                      style={{
                        background: correct
                          ? "rgba(94,168,122,0.08)"
                          : "rgba(187,198,226,0.04)",
                        border: correct
                          ? "1px solid rgba(94,168,122,0.25)"
                          : "1px solid rgba(187,198,226,0.06)",
                        color: correct ? "#5ea87a" : "#8a9bbf",
                      }}
                    >
                      <span
                        className="size-4 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{
                          background: correct ? "rgba(94,168,122,0.2)" : "rgba(187,198,226,0.06)",
                          color: correct ? "#5ea87a" : "#4a5a7a",
                        }}>
                        {["A", "B", "C"][i]}
                      </span>
                      <span style={{ fontFamily: "var(--font-jakarta)" }}>{text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ── Right Sidebar ── */}
        <aside
          className="w-[270px] shrink-0 hidden lg:flex flex-col py-5 px-4 overflow-y-auto backdrop-blur-xl"
          style={{
            background: "rgba(8,16,36,0.55)",
            borderLeft: "1px solid rgba(107,156,218,0.1)",
            boxShadow: "inset 1px 0 0 rgba(255,255,255,0.03)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>
              Riwayat Soal
            </span>
            <a href="/riwayat-soal"
              className="flex items-center gap-1 text-[10px] text-[#4a5a7a] hover:text-[#bbc6e2] transition-colors"
              style={{ fontFamily: "var(--font-space)" }}>
              LIHAT SEMUA <ArrowUpRight className="size-3" />
            </a>
          </div>
          <p className="text-[10px] text-[#4a5a7a] mb-4 flex items-center gap-1"
            style={{ fontFamily: "var(--font-space)" }}>
            <Camera className="size-2.5" />
            Tersimpan otomatis setelah analisis foto
          </p>

          {/* Question cards */}
          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-[#4a5a7a]">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-[11px] text-[#4a5a7a] text-center py-4">Belum ada sesi latihan</p>
            ) : sessions.map((s) => {
              const meta = categoryMeta[s.category] ?? categoryMeta["AI"];
              return (
                <a
                  key={s.id}
                  href={`/analisis-foto?session=${s.id}`}
                  className="group flex flex-col rounded-xl overflow-hidden text-left transition-all hover:scale-[1.01]"
                  style={{ background: "#1f2a3f" }}
                >
                  {/* Thumbnail */}
                  <div
                    className="h-16 w-full flex items-center justify-center relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg,${meta.from},${meta.to})` }}
                  >
                    <div className="analyzing-scan-line opacity-30" />
                    <span
                      className="text-6xl font-black select-none"
                      style={{ color: `${meta.accent}99`, fontFamily: "var(--font-jakarta)" }}
                    >
                      {meta.kanji}
                    </span>
                    <span
                      className="absolute top-1.5 left-2 text-[9px] px-2 py-0.5 rounded-full font-bold"
                      style={{
                        background: `${meta.accent}25`,
                        color: meta.accent,
                        border: `1px solid ${meta.accent}40`,
                        fontFamily: "var(--font-space)",
                      }}
                    >
                      JLPT {s.level}
                    </span>
                    <div className="absolute bottom-1.5 right-2 flex items-center gap-1 opacity-50">
                      <Camera className="size-2.5" style={{ color: meta.accent }} />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-semibold text-[#d7e2ff] mb-1.5 truncate"
                      style={{ fontFamily: "var(--font-jakarta)" }}>
                      {s.title}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[10px] text-[#4a5a7a]">
                        <BookMarked className="size-2.5" />
                        {s.total} Pertanyaan
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-[#4a5a7a]"
                        style={{ fontFamily: "var(--font-space)" }}>
                        <Clock className="size-2.5" />
                        {relativeTime(s.created_at)}
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>

          {/* Sensei Tips */}
          <div
            className="mt-6 rounded-xl overflow-hidden"
            style={{ background: "#1a2540", border: "1px solid rgba(107,156,218,0.15)" }}
          >
            {/* Header strip */}
            <div className="flex items-center gap-2 px-4 py-2.5"
              style={{ background: "linear-gradient(90deg,rgba(107,156,218,0.15),rgba(107,156,218,0.04))", borderBottom: "1px solid rgba(107,156,218,0.1)" }}>
              <Sparkles className="size-3 text-[#6b9cda]" />
              <span className="text-[10px] font-bold tracking-wider text-[#6b9cda]"
                style={{ fontFamily: "var(--font-space)" }}>TIPS SENSEI</span>
            </div>

            {/* Body */}
            <div className="px-4 py-3 flex flex-col gap-2.5">
              {/* Grammar tag + description */}
              <div className="flex items-start gap-3">
                <span className="shrink-0 px-2 py-1 rounded-lg text-sm font-black leading-none mt-0.5"
                  style={{ background: "rgba(107,156,218,0.18)", color: "#6b9cda", fontFamily: "var(--font-jakarta)" }}>
                  ～ても
                </span>
                <p className="text-[11px] text-[#bbc6e2] leading-relaxed">
                  Walaupun... — dipakai saat kondisi <span className="text-[#d7e2ff] font-semibold">tidak berpengaruh</span> pada hasil. Sering muncul di soal N2.
                </p>
              </div>

              {/* Example box */}
              <div className="rounded-lg px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.03)", borderLeft: "2px solid rgba(107,156,218,0.4)" }}>
                <p className="text-sm text-[#d7e2ff] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>
                  雨が降っても、試合は続く。
                </p>
                <p className="text-[10px] text-[#4a5a7a]">Walaupun hujan, pertandingan tetap berlanjut.</p>
              </div>
            </div>
          </div>

          {/* Progress Minggu Ini */}
          <div className="mt-6 rounded-xl p-4" style={{ background: "#1f2a3f" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-[#4a5a7a]"
                style={{ fontFamily: "var(--font-space)" }}>
                PROGRESS MINGGU INI
              </p>
              <span className="text-[10px] text-[#5ea87a] font-semibold"
                style={{ fontFamily: "var(--font-space)" }}>
                5/7 hari
              </span>
            </div>
            {/* Day dots */}
            <div className="flex items-end gap-1.5 mb-3">
              {[
                { day: "S", val: 80, done: true  },
                { day: "S", val: 45, done: true  },
                { day: "R", val: 65, done: true  },
                { day: "K", val: 0,  done: false },
                { day: "J", val: 90, done: true  },
                { day: "S", val: 30, done: true  },
                { day: "M", val: 0,  done: false },
              ].map(({ day, val, done }, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: done ? `${Math.max(val * 0.28, 4)}px` : "4px",
                      background: done
                        ? `linear-gradient(180deg,#6b9cda,#2f4865)`
                        : "rgba(187,198,226,0.06)",
                    }}
                  />
                  <span className="text-[9px] text-[#4a5a7a]"
                    style={{ fontFamily: "var(--font-space)" }}>
                    {day}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#4a5a7a]">
              <span>48 soal diselesaikan</span>
              <span className="text-[#5ea87a]">+12% vs minggu lalu</span>
            </div>
          </div>

          {/* Fokus Latihan */}
          <div className="mt-4 rounded-xl p-4" style={{ background: "#1f2a3f" }}>
            <p className="text-[10px] font-bold text-[#4a5a7a] mb-3"
              style={{ fontFamily: "var(--font-space)" }}>
              FOKUS LATIHAN
            </p>
            <div className="flex flex-col gap-3">
              {[
                { label: "Tata Bahasa",  pct: 72, color: "#6b9cda" },
                { label: "Kosakata",     pct: 88, color: "#5ea87a" },
                { label: "Reading",      pct: 54, color: "#e07b4a" },
                { label: "Listening",    pct: 41, color: "#c05abf" },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#8a9bbf]">{label}</span>
                    <span className="font-semibold" style={{ color, fontFamily: "var(--font-space)" }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "rgba(187,198,226,0.06)" }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg,${color}99,${color})` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-[#4a5a7a] leading-relaxed">
              <span className="text-[#e07b4a]">Reading</span> &amp;{" "}
              <span className="text-[#c05abf]">Listening</span> perlu lebih banyak latihan minggu ini.
            </p>
          </div>
        </aside>
      </div>

      <BottomNav activeHref="/" />
    </div>
  );
}
