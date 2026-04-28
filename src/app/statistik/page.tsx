"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, BottomNav } from "@/components/Sidebar";
import {
  Bell, BookOpen, BarChart2,
  Flame, Target, BookMarked, TrendingUp,
  TrendingDown, Award, Clock, Zap, Loader2,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────── */
interface RawSession {
  id: string;
  level: string;
  category: string;
  total: number;
  score: number | null;
  created_at: string;
}

/* ─── Heatmap helpers ─────────────────────────────────────────── */
const heatColor = (v: number) =>
  v === 0 ? "rgba(187,198,226,0.06)"
  : v === 1 ? "#1a3a6f"
  : v === 2 ? "#2f5a9a"
  : v === 3 ? "#4a7abf"
  : "#6b9cda";

function buildEmptyHeatmap(): number[][] {
  return Array.from({ length: 52 }, () => Array(7).fill(0));
}

function buildHeatmap(sessions: RawSession[], now: Date): number[][] {
  const dateMap = new Map<string, number>();
  sessions.forEach(s => {
    const date = s.created_at.split("T")[0];
    dateMap.set(date, (dateMap.get(date) ?? 0) + 1);
  });

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 52 * 7 + 1);
  const dow = startDate.getDay();
  startDate.setDate(startDate.getDate() - dow); // align to Sunday

  const result: number[][] = [];
  for (let w = 0; w < 52; w++) {
    const week: number[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + w * 7 + d);
      if (date > now) { week.push(0); continue; }
      const dateStr = date.toISOString().split("T")[0];
      const count = dateMap.get(dateStr) ?? 0;
      week.push(count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4);
    }
    result.push(week);
  }
  return result;
}

/* ─── Weekly bars helper ─────────────────────────────────────── */
const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function buildWeeklyBars(sessions: RawSession[], now: Date) {
  const result = DAY_LABELS.map(day => ({ day, soal: 0, menit: 0 }));
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sessions.forEach(s => {
    const date = new Date(s.created_at);
    if (date < sevenDaysAgo) return;
    const jsDay = date.getDay();
    const idx = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 … Sun=6
    result[idx].soal += s.total ?? 0;
  });
  return result;
}

/* ─── Category accuracy helper ───────────────────────────────── */
type LucideIcon = typeof BookMarked;
const catMeta: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  "文法": { label: "Tata Bahasa", color: "#6b9cda", icon: BookMarked },
  "語彙": { label: "Kosakata",    color: "#5ea87a", icon: BookOpen  },
  "読解": { label: "Reading",     color: "#e07b4a", icon: Target    },
  "文字": { label: "Kanji",       color: "#bbc6e2", icon: Award     },
};

function buildCatAccuracy(sessions: RawSession[]) {
  const catMap = new Map<string, { totalQ: number; totalScore: number }>();
  sessions.forEach(s => {
    if (s.score == null || !s.total) return;
    const prev = catMap.get(s.category) ?? { totalQ: 0, totalScore: 0 };
    catMap.set(s.category, { totalQ: prev.totalQ + s.total, totalScore: prev.totalScore + s.score });
  });
  return Array.from(catMap.entries()).map(([cat, { totalQ, totalScore }]) => {
    const meta = catMeta[cat] ?? { label: cat, color: "#bbc6e2", icon: BookMarked };
    return { label: meta.label, pct: Math.round((totalScore / totalQ) * 100), color: meta.color, icon: meta.icon };
  }).sort((a, b) => b.pct - a.pct);
}

/* ─── Month labels for heatmap ────────────────────────────────── */
const months = ["Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des","Jan","Feb","Mar","Apr"];

/* ─── Page ───────────────────────────────────────────────────── */
export default function Statistik() {
  const [loading,     setLoading]     = useState(true);
  const [totalSoal,   setTotalSoal]   = useState(0);
  const [akurasi,     setAkurasi]     = useState<number | null>(null);
  const [streak,      setStreak]      = useState(0);
  const [heatmapData, setHeatmapData] = useState<number[][]>(() => buildEmptyHeatmap());
  const [weeklyBars,  setWeeklyBars]  = useState(DAY_LABELS.map(day => ({ day, soal: 0, menit: 0 })));
  const [catAccuracy, setCatAccuracy] = useState<{ label: string; pct: number; color: string; icon: LucideIcon }[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [profileRes, sessionRes] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("sessions").select("id,level,category,total,score,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (profileRes.data) setStreak(profileRes.data.streak ?? 0);

      const sessions: RawSession[] = sessionRes.data ?? [];
      const now = new Date();

      setTotalSoal(sessions.reduce((s, r) => s + (r.total ?? 0), 0));

      const scored = sessions.filter(r => r.score != null && r.total);
      if (scored.length > 0) {
        const avg = scored.reduce((s, r) => s + r.score! / r.total, 0) / scored.length;
        setAkurasi(Math.round(avg * 100));
      }

      setHeatmapData(buildHeatmap(sessions, now));
      setWeeklyBars(buildWeeklyBars(sessions, now));
      setCatAccuracy(buildCatAccuracy(sessions));
      setLoading(false);
    }
    load();
  }, []);

  const activeDays = heatmapData.flat().filter(v => v > 0).length;
  const weeklySoalTotal = weeklyBars.reduce((s, b) => s + b.soal, 0);
  const maxSoal = Math.max(...weeklyBars.map(b => b.soal), 1);

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[#d7e2ff]"
      style={{ background: "#071327", fontFamily: "var(--font-manrope)" }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 shrink-0"
        style={{ background: "#071327", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md flex items-center justify-center text-[10px] font-black text-[#071327]"
              style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)" }}>S</div>
            <span className="text-sm font-bold tracking-tight text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>Sensei JLPT</span>
          </div>
          <nav className="hidden md:flex items-center gap-0.5">
            {["Materi","Latihan","Pro"].map((item, i) => (
              <button key={item}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  i === 0 ? "text-[#d7e2ff] font-medium" : "text-[#8a9bbf] hover:text-[#d7e2ff] hover:bg-white/5"
                }`}>
                {item}
                {item === "Pro" && (
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-[#071327]"
                    style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", fontFamily: "var(--font-space)" }}>NEW</span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <a href="/premium" className="hidden sm:flex text-[11px] px-4 py-1.5 rounded-full font-medium border transition-colors hover:bg-white/5"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "#bbc6e2", fontFamily: "var(--font-space)" }}>
            Langganan
          </a>
          <button className="relative size-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
            <Bell className="size-4 text-[#8a9bbf]" />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-400 ring-2 ring-[#071327]" />
          </button>
          <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold text-[#071327] ring-2 ring-[#2f4865]"
            style={{ background: "linear-gradient(135deg,#bbc6e2,#4a7abf)" }}>A</div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ── */}
        <Sidebar activeHref="/statistik" />

        {/* ── Main ── */}
        <main className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-5 md:py-7 pb-20 lg:pb-7 relative"
          style={{ background: "#071327" }}>

          {/* ambient glows */}
          <div className="pointer-events-none absolute top-0 left-1/3 w-[500px] h-[300px] opacity-[0.06] blur-[80px]"
            style={{ background: "radial-gradient(circle,#4a7abf,transparent 70%)" }} />
          <div className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[400px] opacity-[0.04] blur-[80px]"
            style={{ background: "radial-gradient(circle,#8b5abf,transparent 70%)" }} />

          <div className="relative flex flex-col gap-6">

            {/* ── Page title ── */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 className="size-4 text-[#6b9cda]" />
                  <span className="text-[10px] font-semibold text-[#4a5a7a]"
                    style={{ fontFamily: "var(--font-space)" }}>STATISTIK BELAJAR</span>
                </div>
                <h1 className="text-2xl font-extrabold text-[#d7e2ff]"
                  style={{ fontFamily: "var(--font-jakarta)" }}>Progres Kamu</h1>
              </div>
            </div>

            {/* ── Top stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  icon: BookMarked, label: "Total Soal",
                  value: loading ? "—" : totalSoal.toLocaleString(),
                  sub: "dari semua sesi", color: "#6b9cda", trend: "up",
                },
                {
                  icon: Target, label: "Akurasi",
                  value: loading ? "—" : akurasi != null ? `${akurasi}%` : "—",
                  sub: "rata-rata semua sesi", color: "#5ea87a", trend: "up",
                },
                {
                  icon: Flame, label: "Streak Aktif",
                  value: loading ? "—" : `${streak} hr`,
                  sub: "hari berturut-turut", color: "#e07b4a", trend: "up",
                },
                {
                  icon: Clock, label: "Hari Aktif",
                  value: loading ? "—" : String(activeDays),
                  sub: "dalam setahun terakhir", color: "#a67bd4", trend: "up",
                },
              ].map(({ icon: Icon, label, value, sub, color, trend }) => (
                <div key={label} className="flex flex-col gap-3 p-4 rounded-2xl relative overflow-hidden"
                  style={{ background: "#101b30" }}>
                  <div className="absolute inset-0 opacity-20"
                    style={{ background: `radial-gradient(circle at top right,${color}30,transparent 70%)` }} />
                  <div className="relative flex items-center justify-between">
                    <div className="size-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}18` }}>
                      <Icon className="size-4" style={{ color }} />
                    </div>
                    {loading
                      ? <Loader2 className="size-3.5 text-[#4a5a7a] animate-spin" />
                      : trend === "up"
                        ? <TrendingUp className="size-3.5 text-[#5ea87a]" />
                        : <TrendingDown className="size-3.5 text-[#e07b4a]" />}
                  </div>
                  <div className="relative">
                    <p className="text-2xl font-extrabold text-[#d7e2ff] leading-none mb-1"
                      style={{ fontFamily: "var(--font-jakarta)" }}>{value}</p>
                    <p className="text-[10px] text-[#4a5a7a]"
                      style={{ fontFamily: "var(--font-space)" }}>{label}</p>
                  </div>
                  <p className="relative text-[10px] leading-none" style={{ color }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* ── Heatmap ── */}
            <div className="p-5 rounded-2xl overflow-x-auto" style={{ background: "#101b30" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-[#d7e2ff]"
                    style={{ fontFamily: "var(--font-jakarta)" }}>Aktivitas Belajar</p>
                  <p className="text-[10px] text-[#4a5a7a] mt-0.5">
                    {loading ? "Memuat…" : `${activeDays} hari aktif dalam setahun terakhir`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#4a5a7a]">Kurang</span>
                  {[0,1,2,3,4].map(v => (
                    <div key={v} className="size-2.5 rounded-sm" style={{ background: heatColor(v) }} />
                  ))}
                  <span className="text-[10px] text-[#4a5a7a]">Banyak</span>
                </div>
              </div>

              {/* Month labels */}
              <div className="flex gap-[3px] mb-1 ml-7">
                {months.map((m, i) => (
                  <div key={i} className="text-[9px] text-[#4a5a7a]"
                    style={{ width: `${(52 / 12) * 11}px`, fontFamily: "var(--font-space)" }}>
                    {m}
                  </div>
                ))}
              </div>

              <div className="flex gap-[3px]">
                {/* Day labels */}
                <div className="flex flex-col gap-[3px] mr-1">
                  {["S","S","R","K","J","S","M"].map((d, i) => (
                    <div key={i} className="size-[11px] flex items-center justify-center text-[8px] text-[#4a5a7a]"
                      style={{ fontFamily: "var(--font-space)" }}>{i % 2 === 0 ? d : ""}</div>
                  ))}
                </div>
                {/* Grid */}
                <div className="flex gap-[3px]">
                  {heatmapData.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                      {week.map((val, di) => (
                        <div key={di} className="size-[11px] rounded-sm transition-transform hover:scale-125"
                          style={{ background: heatColor(val) }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Middle row: Weekly chart + Category accuracy ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

              {/* Weekly bar chart */}
              <div className="p-5 rounded-2xl" style={{ background: "#101b30" }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-sm font-bold text-[#d7e2ff]"
                      style={{ fontFamily: "var(--font-jakarta)" }}>Soal per Hari</p>
                    <p className="text-[10px] text-[#4a5a7a] mt-0.5">
                      {loading ? "Memuat…" : `${weeklySoalTotal} soal minggu ini`}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#4a5a7a]">
                    <span className="size-2 rounded-sm inline-block" style={{ background: "#4a7abf" }} />
                    Soal
                  </span>
                </div>

                <div className="flex items-end gap-2 h-36">
                  {weeklyBars.map(({ day, soal }) => (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex items-end relative" style={{ height: "112px" }}>
                        <div className="relative w-full rounded-t-md transition-all"
                          style={{
                            height: `${(soal / maxSoal) * 100}%`,
                            background: soal === Math.max(...weeklyBars.map(b => b.soal))
                              ? "linear-gradient(180deg,#6b9cda,#4a7abf)"
                              : "linear-gradient(180deg,#2f5a9a,#1a3a6f)",
                            minHeight: soal > 0 ? "4px" : "0px",
                          }} />
                      </div>
                      <span className="text-[10px] text-[#4a5a7a]"
                        style={{ fontFamily: "var(--font-space)" }}>{day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category accuracy */}
              <div className="p-5 rounded-2xl" style={{ background: "#101b30" }}>
                <p className="text-sm font-bold text-[#d7e2ff] mb-1"
                  style={{ fontFamily: "var(--font-jakarta)" }}>Akurasi per Kategori</p>
                <p className="text-[10px] text-[#4a5a7a] mb-4">semua sesi kamu</p>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-4 animate-spin text-[#4a5a7a]" />
                  </div>
                ) : catAccuracy.length === 0 ? (
                  <p className="text-[11px] text-[#4a5a7a] text-center py-6">Belum ada data</p>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {catAccuracy.map(({ label, pct, color, icon: Icon }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Icon className="size-3" style={{ color }} />
                            <span className="text-xs text-[#8a9bbf]">{label}</span>
                          </div>
                          <span className="text-xs font-bold" style={{ color, fontFamily: "var(--font-jakarta)" }}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: "rgba(187,198,226,0.06)" }}>
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, background: `linear-gradient(90deg,${color}80,${color})` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Bottom: AI Insight ── */}
            <div className="pb-4">
              <div className="p-4 rounded-2xl relative overflow-hidden"
                style={{ background: "#0d1929", border: "1px solid rgba(107,156,218,0.15)" }}>
                <div className="absolute inset-0 opacity-20"
                  style={{ background: "radial-gradient(circle at bottom right,#4a7abf,transparent 70%)" }} />
                <div className="relative flex items-start gap-3">
                  <div className="size-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(107,156,218,0.15)" }}>
                    <Zap className="size-4 text-[#6b9cda]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#d7e2ff] mb-1"
                      style={{ fontFamily: "var(--font-jakarta)" }}>Insight dari Sensei AI</p>
                    <p className="text-[11px] text-[#8a9bbf] leading-relaxed">
                      {akurasi != null && akurasi < 60
                        ? <>Akurasi kamu masih di bawah 60%. Coba perbanyak latihan soal <span className="text-[#bbc6e2]">tata bahasa</span> dan <span className="text-[#bbc6e2]">kosakata</span> secara rutin setiap hari.</>
                        : akurasi != null && akurasi >= 80
                          ? <>Akurasi kamu sudah bagus di <span className="text-[#5ea87a]">{akurasi}%</span>! Pertahankan streak dan tingkatkan latihan <span className="text-[#bbc6e2]">reading</span> untuk mempersiapkan ujian.</>
                          : <>Terus tingkatkan latihan harianmu. Konsistensi adalah kunci lulus JLPT — target minimal <span className="text-[#bbc6e2]">10 soal per hari</span>.</>
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      <BottomNav activeHref="/statistik" />
    </div>
  );
}
