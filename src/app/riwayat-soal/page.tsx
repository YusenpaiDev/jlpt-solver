"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, BottomNav } from "@/components/Sidebar";
import {
  Search, Trash2, Clock, BookMarked,
  SlidersHorizontal, Loader2, RefreshCw,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";


/* ─── Types ─────────────────────────────────────────────────── */
type Level = "N1" | "N2" | "N3" | "N4" | "N5";

interface Session {
  id: string;
  level: Level;
  category: string;
  title: string;
  total: number;
  score: number | null;
  created_at: string;
  ai_result: { questions: { question: string }[] } | null;
}

/* ─── Helpers ───────────────────────────────────────────────── */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return "Baru saja";
  if (mins  < 60)  return `${mins} menit lalu`;
  if (hours < 24)  return `${hours} jam lalu`;
  if (days  === 1) return "Kemarin";
  if (days  < 7)   return `${days} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const categoryMeta: Record<string, { kanji: string; accent: string; from: string; to: string }> = {
  "文法": { kanji: "文", accent: "#60a5fa", from: "#1e3a8a", to: "#0c1942" },
  "語彙": { kanji: "語", accent: "#c084fc", from: "#581c87", to: "#1e0f3a" },
  "文字": { kanji: "字", accent: "#4ade80", from: "#14532d", to: "#0a2a1e" },
  "読解": { kanji: "読", accent: "#fb923c", from: "#7c2d12", to: "#2e1a06" },
  "AI":   { kanji: "全", accent: "#22d3ee", from: "#155e75", to: "#062030" },
};

/* Vibrant gradient palettes — rotate per card index so cards never look identical,
   even when several sessions share the same category. */
const cardPalettes: { from: string; to: string; glow: string }[] = [
  { from: "#1e3a8a", to: "#3b0764", glow: "#60a5fa" }, // blue → purple
  { from: "#581c87", to: "#831843", glow: "#e879f9" }, // purple → pink
  { from: "#14532d", to: "#155e75", glow: "#34d399" }, // green → teal
  { from: "#7c2d12", to: "#831843", glow: "#fb923c" }, // orange → pink
  { from: "#155e75", to: "#1e3a8a", glow: "#22d3ee" }, // cyan → blue
  { from: "#831843", to: "#7c2d12", glow: "#f472b6" }, // pink → orange
  { from: "#3b0764", to: "#14532d", glow: "#a78bfa" }, // deep purple → green
  { from: "#7c2d12", to: "#1e3a8a", glow: "#fbbf24" }, // orange → blue
];

const levelColors: Record<Level, { bg: string; text: string; border: string }> = {
  N1: { bg: "rgba(139,90,191,0.15)",  text: "#b07ad4", border: "rgba(139,90,191,0.3)" },
  N2: { bg: "rgba(74,122,191,0.15)",  text: "#6b9cda", border: "rgba(74,122,191,0.3)" },
  N3: { bg: "rgba(58,154,122,0.15)",  text: "#5abf99", border: "rgba(58,154,122,0.3)" },
  N4: { bg: "rgba(192,132,74,0.15)",  text: "#d4a06a", border: "rgba(192,132,74,0.3)" },
  N5: { bg: "rgba(74,154,191,0.15)",  text: "#6ab4d4", border: "rgba(74,154,191,0.3)" },
};


/* ─── Page ──────────────────────────────────────────────────── */
export default function RiwayatSoal() {
  const [sessions,     setSessions]     = useState<Session[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<Level | "ALL">("ALL");
  const [query,        setQuery]        = useState("");
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  const filters: (Level | "ALL")[] = ["ALL", "N1", "N2", "N3", "N4", "N5"];

  const fetchSessions = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFetchError("Kamu perlu login untuk melihat riwayat.");
        return;
      }
      const { data, error } = await supabase
        .from("sessions")
        .select("id, level, category, title, total, score, created_at, ai_result")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSessions((data ?? []) as Session[]);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Gagal memuat riwayat.");
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (id: string) => {
    setDeletingId(id);
    try {
      const supabase = createClient();
      await supabase.from("sessions").delete().eq("id", id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const deleteAll = async () => {
    if (!confirm("Hapus semua riwayat? Tindakan ini tidak bisa dibatalkan.")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("sessions").delete().eq("user_id", user.id);
    setSessions([]);
  };

  useEffect(() => { fetchSessions(); }, []);

  const filtered = sessions.filter(s => {
    const matchLevel = activeFilter === "ALL" || s.level === activeFilter;
    const matchQuery = s.title.toLowerCase().includes(query.toLowerCase());
    return matchLevel && matchQuery;
  });

  const avgScore = filtered.length > 0 && filtered.some(s => s.score !== null)
    ? Math.round(
        filtered.filter(s => s.score !== null && s.total > 0)
          .reduce((acc, s) => acc + (s.score! / s.total) * 100, 0) /
        filtered.filter(s => s.score !== null).length
      )
    : null;

  /* top category */
  const catCount = sessions.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[#d7e2ff]"
      style={{ fontFamily: "var(--font-manrope)" }}>

      <AppHeader activeHref="/riwayat-soal" />

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <Sidebar activeHref="/riwayat-soal" />

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Page header */}
          <div className="px-4 md:px-8 pt-5 md:pt-7 pb-4 md:pb-5 border-b shrink-0"
            style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="text-[10px] tracking-widest text-[#4a5a7a] block mb-1.5"
                  style={{ fontFamily: "var(--font-space)" }}>LATIHAN · RIWAYAT</span>
                <h1 className="text-2xl font-extrabold text-[#d7e2ff]"
                  style={{ fontFamily: "var(--font-jakarta)" }}>Riwayat Soal</h1>
                <p className="text-sm text-[#4a5a7a] mt-1">
                  Semua sesi analisis foto yang pernah kamu lakukan.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchSessions}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[#4a5a7a] hover:text-[#8a9bbf] hover:bg-white/5 transition-colors"
                  style={{ fontFamily: "var(--font-space)" }}>
                  <RefreshCw className="size-3.5" /> REFRESH
                </button>
                {sessions.length > 0 && (
                  <button
                    onClick={deleteAll}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/5 transition-colors"
                    style={{ fontFamily: "var(--font-space)" }}>
                    <Trash2 className="size-3.5" /> HAPUS SEMUA
                  </button>
                )}
              </div>
            </div>

            {/* Search + filter */}
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <div className="relative w-full md:flex-1 md:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#4a5a7a]" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Cari soal..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none"
                  style={{ background: "#101b30", fontFamily: "var(--font-manrope)" }}
                />
              </div>

              <div className="flex items-center gap-1 md:gap-1.5 overflow-x-auto -mx-1 px-1 scrollbar-none">
                {filters.map(f => {
                  const active = activeFilter === f;
                  const lc = f !== "ALL" ? levelColors[f as Level] : null;
                  return (
                    <button key={f}
                      onClick={() => setActiveFilter(f)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0"
                      style={active && lc ? {
                        background: lc.bg, color: lc.text,
                        border: `1px solid ${lc.border}`,
                        fontFamily: "var(--font-space)",
                      } : active ? {
                        background: "rgba(187,198,226,0.12)", color: "#d7e2ff",
                        border: "1px solid rgba(187,198,226,0.2)",
                        fontFamily: "var(--font-space)",
                      } : {
                        background: "transparent", color: "#4a5a7a",
                        border: "1px solid transparent",
                        fontFamily: "var(--font-space)",
                      }}>
                      {f}
                    </button>
                  );
                })}
              </div>

              <button className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[#4a5a7a] hover:text-[#8a9bbf] hover:bg-white/5 transition-colors ml-auto"
                style={{ fontFamily: "var(--font-space)" }}>
                <SlidersHorizontal className="size-3.5" /> FILTER
              </button>
            </div>
          </div>

          {/* Grid area */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 md:py-6 pb-20 lg:pb-6">

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="size-8 text-[#4a7abf] animate-spin" />
                <p className="text-sm text-[#4a5a7a]">Memuat riwayat...</p>
              </div>
            )}

            {/* Error */}
            {!loading && fetchError && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="size-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: "#101b30" }}>⚠️</div>
                <p className="font-semibold text-[#c05050]">{fetchError}</p>
                <button onClick={fetchSessions}
                  className="text-xs px-4 py-2 rounded-xl font-semibold transition-colors hover:brightness-110"
                  style={{ background: "#101b30", color: "#6b9cda", fontFamily: "var(--font-space)" }}>
                  COBA LAGI
                </button>
              </div>
            )}

            {/* Empty */}
            {!loading && !fetchError && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="size-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: "#101b30" }}>
                  {sessions.length === 0 ? "📭" : "🔍"}
                </div>
                <p className="font-semibold text-[#4a5a7a]" style={{ fontFamily: "var(--font-jakarta)" }}>
                  {sessions.length === 0
                    ? "Belum ada sesi analisis"
                    : "Tidak ada soal ditemukan"}
                </p>
                <p className="text-xs text-[#2a354b] text-center">
                  {sessions.length === 0
                    ? "Upload foto soal JLPT untuk memulai."
                    : "Coba ubah filter atau kata kunci pencarian."}
                </p>
                {sessions.length === 0 && (
                  <a href="/analisis-foto"
                    className="text-xs px-5 py-2 rounded-xl font-bold text-[#071327] mt-1"
                    style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", fontFamily: "var(--font-space)" }}>
                    ANALISIS FOTO SEKARANG
                  </a>
                )}
              </div>
            )}

            {/* Cards */}
            {!loading && !fetchError && filtered.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  {filtered.map((s, idx) => {
                    const meta    = categoryMeta[s.category] ?? categoryMeta["AI"];
                    const palette = cardPalettes[idx % cardPalettes.length];
                    const lc      = levelColors[s.level] ?? levelColors.N3;
                    const pct    = s.score !== null && s.total > 0
                      ? Math.round((s.score / s.total) * 100)
                      : null;
                    const scoreColor = pct === null ? "#4a5a7a"
                      : pct >= 80 ? "#5ea87a"
                      : pct >= 60 ? "#c0844a"
                      : "#c05050";
                    const scoreBg = pct === null ? "rgba(74,90,122,0.15)"
                      : pct >= 80 ? "rgba(94,168,122,0.18)"
                      : pct >= 60 ? "rgba(192,132,74,0.18)"
                      : "rgba(192,80,80,0.18)";
                    const preview = s.ai_result?.questions?.[0]?.question ?? "";

                    return (
                      <div key={s.id}
                        className="group relative flex flex-col rounded-2xl overflow-hidden transition-all hover:scale-[1.03] hover:-translate-y-0.5 cursor-pointer"
                        style={{
                          background: "#101b30",
                          boxShadow: `0 0 0 1px ${palette.glow}25, 0 8px 28px ${palette.glow}10`,
                        }}>

                        {/* Thumbnail */}
                        <a href={`/analisis-foto?session=${s.id}`}
                          className="h-32 relative overflow-hidden block"
                          style={{ background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)` }}>

                          <div className="absolute inset-0"
                            style={{ background: `radial-gradient(ellipse at 25% 30%, ${palette.glow}40, transparent 60%)` }} />
                          <div className="absolute inset-0"
                            style={{ background: `radial-gradient(ellipse at 80% 90%, ${palette.glow}25, transparent 55%)` }} />

                          {/* fake text lines */}
                          <div className="absolute left-3 top-10 flex flex-col gap-1.5 w-[55%]">
                            <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", width: "90%" }} />
                            <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", width: "75%" }} />
                            <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)", width: "60%" }} />
                          </div>

                          {preview && (
                            <p className="absolute left-3 top-9 text-[9px] leading-relaxed w-[58%] line-clamp-2"
                              style={{ color: "rgba(215,226,255,0.35)", fontFamily: "var(--font-jakarta)" }}>
                              {preview}
                            </p>
                          )}

                          <span className="absolute -bottom-2 right-1 text-[72px] font-black leading-none select-none"
                            style={{ color: `${palette.glow}30`, fontFamily: "var(--font-jakarta)", textShadow: `0 0 24px ${palette.glow}30` }}>
                            {meta.kanji}
                          </span>

                          <span className="absolute bottom-2.5 left-2.5 text-[9px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}`, fontFamily: "var(--font-space)" }}>
                            JLPT {s.level}
                          </span>

                          {pct !== null && (
                            <span className="absolute top-2.5 right-2.5 text-[10px] px-2 py-0.5 rounded-full font-bold"
                              style={{ background: scoreBg, color: scoreColor, fontFamily: "var(--font-space)" }}>
                              {pct}%
                            </span>
                          )}
                        </a>

                        {/* Info */}
                        <div className="px-3.5 py-3 flex flex-col gap-2">
                          <p className="text-sm font-semibold text-[#d7e2ff] leading-tight truncate"
                            style={{ fontFamily: "var(--font-jakarta)" }}>
                            {s.title}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-[10px] text-[#4a5a7a]">
                              <BookMarked className="size-3" />
                              <span style={{ color: scoreColor, fontFamily: "var(--font-space)" }}>
                                {s.score !== null ? `${s.score}/${s.total}` : `${s.total}`}
                              </span>
                              <span className="text-[#2a354b]">
                                {s.score !== null ? "benar" : "soal"}
                              </span>
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-[#4a5a7a]"
                              style={{ fontFamily: "var(--font-space)" }}>
                              <Clock className="size-3" />{relativeTime(s.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Delete button — appears on hover */}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                          disabled={deletingId === s.id}
                          className="absolute top-2 left-2 size-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:brightness-125"
                          style={{ background: "rgba(192,80,80,0.75)" }}>
                          {deletingId === s.id
                            ? <Loader2 className="size-3 text-white animate-spin" />
                            : <Trash2 className="size-3 text-white" />}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 mb-4 px-1">
                  {[
                    { label: "Sesi latihan",      value: `${filtered.length}` },
                    { label: "Rata-rata skor",     value: avgScore !== null ? `${avgScore}%` : "—" },
                    { label: "Kategori terbanyak", value: topCat },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: "#101b30" }}>
                      <span className="text-sm font-bold text-[#d7e2ff]"
                        style={{ fontFamily: "var(--font-jakarta)" }}>{value}</span>
                      <span className="text-[10px] text-[#4a5a7a]"
                        style={{ fontFamily: "var(--font-space)" }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Footer info */}
                <div className="flex items-center justify-end pb-2">
                  <span className="text-[10px] text-[#2a354b]" style={{ fontFamily: "var(--font-space)" }}>
                    {filtered.length} dari {sessions.length} sesi · SORT: TERBARU ↓
                  </span>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      <BottomNav activeHref="/riwayat-soal" />
    </div>
  );
}
