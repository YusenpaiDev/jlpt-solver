"use client";

import { useState, useEffect } from "react";
import { BottomNav } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2, XCircle, BookOpen, ArrowLeft, ArrowRight,
  LayoutList, Sparkles, ChevronDown, Clock, Star, X,
  Loader2, Wand2, RotateCcw, Check,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────── */
type Difficulty = "mudah" | "sedang" | "sulit";
type Category   = "全" | "語彙" | "文法" | "文字" | "読解";

type Option = { text: string; correct: boolean };
type Soal = {
  id: number;
  no: string;
  category: string;
  difficulty: Difficulty;
  question: string;
  context?: string;
  options: Option[];
  explanation: {
    correct: string;
    wrong: string;
    grammar: { term: string; meaning: string }[];
    tips: string;
  };
};

type Stage = "setup" | "generating" | "quiz";

interface RiwayatItem {
  id: string;
  title: string;
  category: string;
  total: number;
  score: number | null;
  created_at: string;
}

/* ─── Constants ───────────────────────────────────────────────── */
const LEVELS    = ["N1","N2","N3","N4","N5"] as const;
const CATS: { value: Category; label: string; kanji: string; color: string }[] = [
  { value: "全",  label: "Semua",      kanji: "全", color: "#6b8cba" },
  { value: "語彙", label: "Kosakata",  kanji: "語", color: "#4a7abf" },
  { value: "文法", label: "Tata Bahasa",kanji: "文", color: "#5ea87a" },
  { value: "文字", label: "Kanji",     kanji: "字", color: "#a67bd4" },
  { value: "読解", label: "Reading",   kanji: "読", color: "#e07b4a" },
];
const COUNTS = [5, 7, 10];

const diffColor: Record<Difficulty, string> = {
  mudah: "#5ea87a", sedang: "#e07b4a", sulit: "#e05a5a",
};
const catColor: Record<string, string> = {
  語彙: "#4a7abf", 文法: "#5ea87a", 読解: "#e07b4a", 文字: "#a67bd4",
};

function relativeTime(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return "Baru saja";
  if (mins  < 60)  return `${mins} menit lalu`;
  if (hours < 24)  return `${hours} jam lalu`;
  if (days  === 1) return "Kemarin";
  return `${days} hari lalu`;
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function LembarTugas() {
  /* Setup state */
  const [level,    setLevel]    = useState<string>("N2");
  const [category, setCategory] = useState<Category>("全");
  const [count,    setCount]    = useState(7);

  /* Quiz state */
  const [stage,    setStage]    = useState<Stage>("setup");
  const [soalList, setSoalList] = useState<Soal[]>([]);
  const [current,  setCurrent]  = useState(0);
  const [answers,  setAnswers]  = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [view,     setView]     = useState<"single" | "all">("single");
  const [error,    setError]    = useState<string | null>(null);

  /* Sidebar state */
  const [riwayatOpen, setRiwayatOpen] = useState(false);
  const [riwayat,     setRiwayat]     = useState<RiwayatItem[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  /* Load user target_level + riwayat on mount */
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, sessionRes] = await Promise.all([
        supabase.from("profiles").select("target_level").eq("id", user.id).single(),
        supabase.from("sessions")
          .select("id,title,category,total,score,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (profileRes.data?.target_level) setLevel(profileRes.data.target_level);
      setRiwayat(sessionRes.data ?? []);
    }
    load();
  }, []);

  /* Generate questions */
  async function handleGenerate() {
    setError(null);
    setStage("generating");
    try {
      const res  = await fetch("/api/tugas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, category, count }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const questions: Soal[] = json.data.questions.map((q: Omit<Soal,"id">, i: number) => ({
        ...q, id: i + 1,
      }));

      setSoalList(questions);
      setAnswers({});
      setRevealed({});
      setCurrent(0);
      setView("single");
      setSaved(false);
      setStage("quiz");
    } catch {
      setError("Gagal membuat soal. Coba lagi.");
      setStage("setup");
    }
  }

  /* Save session to Supabase */
  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const correctCount = soalList.filter((s) => {
      const picked     = answers[s.id];
      const correctIdx = s.options.findIndex(o => o.correct);
      return picked === correctIdx;
    }).length;

    const catLabel = category === "全" ? "Semua" : category;

    await supabase.from("sessions").insert({
      user_id:    user.id,
      level,
      category:   catLabel,
      title:      `Lembar Tugas ${level} — ${catLabel}`,
      total:      soalList.length,
      score:      correctCount,
    });

    setSaving(false);
    setSaved(true);

    /* Refresh riwayat */
    const { data } = await supabase.from("sessions")
      .select("id,title,category,total,score,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setRiwayat(data ?? []);
  }

  /* Helpers */
  function pick(soalId: number, i: number) {
    setAnswers(p => ({ ...p, [soalId]: i }));
  }
  function reveal(soalId: number) {
    setRevealed(p => ({ ...p, [soalId]: true }));
  }

  const allRevealed  = soalList.length > 0 && soalList.every(s => revealed[s.id]);
  const correctCount = soalList.filter(s => {
    const picked     = answers[s.id];
    const correctIdx = s.options.findIndex(o => o.correct);
    return picked === correctIdx;
  }).length;

  const soal      = soalList[current];
  const picked    = soal ? answers[soal.id] : undefined;
  const isRevealed = soal ? !!revealed[soal.id] : false;

  /* ── Render ── */
  return (
    <div className="flex h-screen overflow-hidden text-[#d7e2ff]"
      style={{ background: "#0a1220", fontFamily: "var(--font-manrope)" }}>

      <div className="flex-1 flex flex-col min-h-0">

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 shrink-0"
          style={{ background: "#0a1220", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2 md:gap-3">
            <a href="/" className="flex items-center gap-2">
              <div className="size-6 rounded-md flex items-center justify-center text-[10px] font-black text-[#071327]"
                style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)" }}>S</div>
              <span className="text-sm font-bold text-[#d7e2ff]"
                style={{ fontFamily: "var(--font-jakarta)" }}>Sensei JLPT</span>
            </a>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold text-[#071327]"
              style={{ background: "#6b9cda", fontFamily: "var(--font-space)" }}>{level}</span>
            {stage === "quiz" && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <div className="flex items-center gap-1.5 text-xs text-[#4a5a7a]">
                  <span className="text-[#8a9bbf]">Lembar Tugas</span>
                  <ChevronDown className="size-3 -rotate-90 opacity-40" />
                  <span className="text-[#8a9bbf]">{soalList.length} SOAL</span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {stage === "quiz" && (
              <button onClick={() => setStage("setup")}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                style={{ background: "#1f2a3f", color: "#8a9bbf", fontFamily: "var(--font-space)" }}>
                <RotateCcw className="size-3" /> GENERATE ULANG
              </button>
            )}
            <button onClick={() => setRiwayatOpen(true)}
              className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
              style={{ background: "#1f2a3f", color: "#8a9bbf", fontFamily: "var(--font-space)" }}>
              <Clock className="size-3" /> RIWAYAT
            </button>
            <div className="flex items-center gap-2 text-xs text-[#4a5a7a]">
              <Sparkles className="size-3 text-[#6b9cda]" />
              <span style={{ color: "#6b9cda" }}>+ Claude AI</span>
            </div>
          </div>
        </header>

        {/* ── Stats strip (quiz only) ── */}
        {stage === "quiz" && (
          <div className="flex items-center gap-6 px-6 py-3 shrink-0"
            style={{ background: "#0d1929", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-[#bbc6e2]"
                style={{ fontFamily: "var(--font-jakarta)" }}>{soalList.length}</span>
              <span className="text-[9px] font-bold text-[#4a5a7a]"
                style={{ fontFamily: "var(--font-space)" }}>TOTAL SOAL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-[#6b9cda]"
                style={{ fontFamily: "var(--font-jakarta)" }}>
                {[...new Set(soalList.map(s => s.category))].length}
              </span>
              <span className="text-[9px] font-bold text-[#4a5a7a]"
                style={{ fontFamily: "var(--font-space)" }}>KATEGORI</span>
            </div>
            {allRevealed && (
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-[#5ea87a]"
                  style={{ fontFamily: "var(--font-jakarta)" }}>
                  {correctCount}/{soalList.length}
                </span>
                <span className="text-[9px] font-bold text-[#4a5a7a]"
                  style={{ fontFamily: "var(--font-space)" }}>SKOR</span>
              </div>
            )}
            <div className="flex-1" />
            {allRevealed && !saved && (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all hover:brightness-110 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#3a8a5a,#5ea87a)", color: "#fff", fontFamily: "var(--font-space)" }}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                {saving ? "MENYIMPAN…" : "SIMPAN HASIL"}
              </button>
            )}
            {saved && (
              <span className="text-[10px] font-semibold text-[#5ea87a] flex items-center gap-1"
                style={{ fontFamily: "var(--font-space)" }}>
                <CheckCircle2 className="size-3" /> TERSIMPAN
              </span>
            )}
            <button onClick={() => setView(v => v === "single" ? "all" : "single")}
              className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "#1f2a3f", color: "#8a9bbf", fontFamily: "var(--font-space)" }}>
              <LayoutList className="size-3" />
              {view === "single" ? "SEMUA SOAL" : "SATU PER SATU"}
            </button>
          </div>
        )}

        {/* ── Main content ── */}
        <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">

          {/* ── Setup screen ── */}
          {stage === "setup" && (
            <div className="flex items-center justify-center min-h-full px-6 py-10">
              <div className="w-full max-w-lg flex flex-col gap-6">

                {/* Title */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
                    style={{ background: "#101b30" }}>
                    <Wand2 className="size-3 text-[#6b9cda]" />
                    <span className="text-[10px] font-bold text-[#6b9cda]"
                      style={{ fontFamily: "var(--font-space)" }}>AI GENERATE SOAL</span>
                  </div>
                  <h1 className="text-2xl font-extrabold text-[#d7e2ff] mb-2"
                    style={{ fontFamily: "var(--font-jakarta)" }}>
                    Buat Lembar Tugas
                  </h1>
                  <p className="text-sm text-[#4a5a7a]">
                    Claude AI akan membuat soal latihan JLPT baru untukmu setiap sesi.
                  </p>
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-xl text-sm text-[#e05a5a]"
                    style={{ background: "rgba(224,90,90,0.08)", border: "1px solid rgba(224,90,90,0.2)" }}>
                    {error}
                  </div>
                )}

                {/* Level */}
                <div className="p-5 rounded-2xl flex flex-col gap-3"
                  style={{ background: "#101b30" }}>
                  <p className="text-[10px] font-bold text-[#4a5a7a]"
                    style={{ fontFamily: "var(--font-space)" }}>LEVEL JLPT</p>
                  <div className="flex gap-2">
                    {LEVELS.map(l => (
                      <button key={l} onClick={() => setLevel(l)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                        style={level === l
                          ? { background: "linear-gradient(135deg,#1a3a6f,#2f5a9a)", color: "#d7e2ff", border: "1px solid rgba(107,156,218,0.4)" }
                          : { background: "#0d1929", color: "#4a5a7a", border: "1px solid rgba(255,255,255,0.04)" }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div className="p-5 rounded-2xl flex flex-col gap-3"
                  style={{ background: "#101b30" }}>
                  <p className="text-[10px] font-bold text-[#4a5a7a]"
                    style={{ fontFamily: "var(--font-space)" }}>KATEGORI</p>
                  <div className="grid grid-cols-5 gap-2">
                    {CATS.map(c => (
                      <button key={c.value} onClick={() => setCategory(c.value)}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                        style={category === c.value
                          ? { background: `${c.color}20`, border: `1px solid ${c.color}50`, color: c.color }
                          : { background: "#0d1929", border: "1px solid rgba(255,255,255,0.04)", color: "#4a5a7a" }}>
                        <span className="text-base font-black"
                          style={{ fontFamily: "var(--font-jakarta)" }}>{c.kanji}</span>
                        <span className="text-[9px] font-bold"
                          style={{ fontFamily: "var(--font-space)" }}>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Count */}
                <div className="p-5 rounded-2xl flex flex-col gap-3"
                  style={{ background: "#101b30" }}>
                  <p className="text-[10px] font-bold text-[#4a5a7a]"
                    style={{ fontFamily: "var(--font-space)" }}>JUMLAH SOAL</p>
                  <div className="flex gap-2">
                    {COUNTS.map(n => (
                      <button key={n} onClick={() => setCount(n)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                        style={count === n
                          ? { background: "rgba(107,156,218,0.15)", color: "#6b9cda", border: "1px solid rgba(107,156,218,0.35)" }
                          : { background: "#0d1929", color: "#4a5a7a", border: "1px solid rgba(255,255,255,0.04)" }}>
                        {n} soal
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate button */}
                <button onClick={handleGenerate}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all hover:brightness-110"
                  style={{ background: "linear-gradient(135deg,#1a3a6f,#2f5a9a)", color: "#d7e2ff", fontFamily: "var(--font-space)" }}>
                  <Wand2 className="size-4" />
                  GENERATE {count} SOAL {level} — {CATS.find(c => c.value === category)?.label}
                </button>
              </div>
            </div>
          )}

          {/* ── Generating screen ── */}
          {stage === "generating" && (
            <div className="flex flex-col items-center justify-center min-h-full gap-5 text-center px-6">
              <div className="size-16 rounded-2xl flex items-center justify-center relative"
                style={{ background: "rgba(107,156,218,0.12)", border: "1px solid rgba(107,156,218,0.2)" }}>
                <div className="absolute inset-0 rounded-2xl animate-ping opacity-20"
                  style={{ background: "rgba(107,156,218,0.3)" }} />
                <Wand2 className="size-7 text-[#6b9cda] relative" />
              </div>
              <div>
                <p className="text-base font-bold text-[#d7e2ff] mb-1"
                  style={{ fontFamily: "var(--font-jakarta)" }}>
                  Sensei AI sedang membuat soal…
                </p>
                <p className="text-sm text-[#4a5a7a]">
                  {count} soal {level} • {CATS.find(c => c.value === category)?.label}
                </p>
              </div>
              <Loader2 className="size-5 animate-spin text-[#4a5a7a]" />
            </div>
          )}

          {/* ── Quiz ── */}
          {stage === "quiz" && soal && (
            <div className="px-6 py-5">
              {view === "all" ? (
                <div className="max-w-3xl mx-auto flex flex-col gap-5 pb-8">
                  {soalList.map((s, idx) => (
                    <SoalCard key={s.id} soal={s}
                      picked={answers[s.id]} revealed={!!revealed[s.id]}
                      onPick={i => pick(s.id, i)}
                      onReveal={() => reveal(s.id)}
                      questionIndex={idx} total={soalList.length} />
                  ))}
                </div>
              ) : (
                <div className="max-w-3xl mx-auto pb-8">
                  <SoalCard soal={soal}
                    picked={picked} revealed={isRevealed}
                    onPick={i => pick(soal.id, i)}
                    onReveal={() => reveal(soal.id)}
                    questionIndex={current} total={soalList.length} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom nav (quiz single view) ── */}
        {stage === "quiz" && view === "single" && (
          <div className="shrink-0 flex items-center justify-between px-6 py-3"
            style={{ background: "#0d1929", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <button onClick={() => setCurrent(c => Math.max(0, c - 1))}
              disabled={current === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-30"
              style={{ background: "#1f2a3f", color: "#8a9bbf" }}>
              <ArrowLeft className="size-4" /> Sebelumnya
            </button>
            <button onClick={() => setView("all")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "#1f2a3f", color: "#8a9bbf" }}>
              <LayoutList className="size-4" /> Semua Soal
            </button>
            <button onClick={() => setCurrent(c => Math.min(soalList.length - 1, c + 1))}
              disabled={current === soalList.length - 1}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110 disabled:opacity-30"
              style={{ background: "linear-gradient(135deg,#1a3a6f,#2f5a9a)", color: "#d7e2ff" }}>
              Berikutnya <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Riwayat Drawer ── */}
      {riwayatOpen && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: "rgba(7,19,39,0.7)" }}
            onClick={() => setRiwayatOpen(false)} />
          <aside className="fixed top-0 right-0 h-full z-50 flex flex-col w-[300px]"
            style={{ background: "#0d1929", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>

            <div className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <Star className="size-3.5 text-[#e07b4a]" />
                <span className="text-sm font-bold text-[#d7e2ff]"
                  style={{ fontFamily: "var(--font-jakarta)" }}>Riwayat Sesi</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold text-[#4a5a7a]"
                  style={{ background: "#1f2a3f", fontFamily: "var(--font-space)" }}>
                  {riwayat.length}
                </span>
              </div>
              <button onClick={() => setRiwayatOpen(false)}
                className="text-[#4a5a7a] hover:text-[#d7e2ff] transition-colors">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-2 pt-3 pb-4">
              {riwayat.length === 0 ? (
                <p className="text-[11px] text-[#4a5a7a] text-center py-8">Belum ada riwayat</p>
              ) : riwayat.map(r => {
                const color = catColor[r.category] ?? "#6b8cba";
                const pct   = r.score != null && r.total ? Math.round((r.score / r.total) * 100) : null;
                return (
                  <div key={r.id} className="p-3 rounded-xl transition-all hover:brightness-110"
                    style={{ background: "#101b30" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-[#d7e2ff]"
                          style={{ fontFamily: "var(--font-jakarta)" }}>{r.total} soal</span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: `${color}25`, color, fontFamily: "var(--font-space)" }}>
                          {r.category}
                        </span>
                      </div>
                      {pct != null && (
                        <span className="text-[10px] font-bold"
                          style={{ color: pct >= 70 ? "#5ea87a" : pct >= 50 ? "#e07b4a" : "#e05a5a", fontFamily: "var(--font-space)" }}>
                          {pct}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-[#4a5a7a]"
                      style={{ fontFamily: "var(--font-space)" }}>
                      <Clock className="size-2.5" />
                      {relativeTime(r.created_at)}
                    </div>
                    <p className="text-[10px] text-[#4a5a7a] mt-1 truncate">{r.title}</p>
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}

      <BottomNav activeHref="/lembar-tugas" />
    </div>
  );
}

/* ─── SoalCard ────────────────────────────────────────────────── */
function SoalCard({ soal, picked, revealed, onPick, onReveal, questionIndex, total }: {
  soal: Soal;
  picked: number | undefined;
  revealed: boolean;
  onPick: (i: number) => void;
  onReveal: () => void;
  questionIndex?: number;
  total?: number;
}) {
  const correctIdx = soal.options.findIndex(o => o.correct);

  function optStyle(i: number) {
    if (!revealed) {
      return picked === i
        ? { bg: "rgba(107,156,218,0.12)", border: "rgba(107,156,218,0.4)", text: "#d7e2ff" }
        : { bg: "#101b30", border: "rgba(255,255,255,0.04)", text: "#8a9bbf" };
    }
    if (i === correctIdx) return { bg: "rgba(94,168,122,0.1)",  border: "rgba(94,168,122,0.45)", text: "#5ea87a" };
    if (picked === i)     return { bg: "rgba(224,90,90,0.08)",  border: "rgba(224,90,90,0.4)",  text: "#e05a5a" };
    return { bg: "#0d1929", border: "rgba(255,255,255,0.03)", text: "#4a5a7a" };
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#d7e2ff]"
            style={{ fontFamily: "var(--font-jakarta)" }}>{soal.no}</span>
          <span className="text-[9px] px-2 py-0.5 rounded font-bold"
            style={{
              background: catColor[soal.category] ? `${catColor[soal.category]}25` : "#1f2a3f",
              color: catColor[soal.category] ?? "#8a9bbf",
              fontFamily: "var(--font-space)",
            }}>{soal.category}</span>
        </div>
        <span className="text-[9px] font-semibold"
          style={{ color: diffColor[soal.difficulty], fontFamily: "var(--font-space)" }}>
          {soal.difficulty}
        </span>
      </div>

      {/* Context */}
      {soal.context && (
        <p className="text-sm text-[#8a9bbf] leading-relaxed px-1"
          style={{ fontFamily: "var(--font-jakarta)" }}>{soal.context}</p>
      )}

      {/* Question */}
      <p className="text-base text-[#d7e2ff] leading-relaxed"
        style={{ fontFamily: "var(--font-jakarta)" }}>{soal.question}</p>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {soal.options.map((opt, i) => {
          const s = optStyle(i);
          return (
            <button key={i} onClick={() => !revealed && onPick(i)} disabled={revealed}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
              style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
              <span className="size-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: revealed && i === correctIdx ? "rgba(94,168,122,0.25)"
                    : revealed && picked === i ? "rgba(224,90,90,0.2)"
                    : picked === i ? "rgba(107,156,218,0.2)"
                    : "rgba(187,198,226,0.06)",
                  fontFamily: "var(--font-space)",
                }}>
                {revealed && i === correctIdx ? <CheckCircle2 className="size-3.5" /> :
                 revealed && picked === i     ? <XCircle className="size-3.5" /> :
                 ["1","2","3","4"][i]}
              </span>
              <span className="text-sm">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {/* Reveal button + progress */}
      {!revealed && (
        <div className="flex flex-col gap-2">
          <button onClick={onReveal}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: "rgba(107,156,218,0.12)", color: "#6b9cda", border: "1px solid rgba(107,156,218,0.2)" }}>
            <BookOpen className="size-4" /> Lihat Jawaban &amp; Pembahasan
          </button>
          {questionIndex !== undefined && total !== undefined && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px]"
                style={{ fontFamily: "var(--font-space)" }}>
                <span className="text-[#4a5a7a]">{soal.no} dari {total} soal</span>
                <span className="text-[#4a5a7a]">{Math.round(((questionIndex + 1) / total) * 100)}%</span>
              </div>
              <div className="h-1 rounded-full" style={{ background: "rgba(187,198,226,0.06)" }}>
                <div className="h-1 rounded-full transition-all"
                  style={{ width: `${((questionIndex + 1) / total) * 100}%`, background: "linear-gradient(90deg,#2f5a9a,#6b9cda)" }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Explanation */}
      {revealed && (
        <div className="flex flex-col gap-3 p-4 rounded-2xl"
          style={{ background: "#0d1929", border: "1px solid rgba(255,255,255,0.04)" }}>

          {/* Correct explanation */}
          <div className="flex gap-3">
            <CheckCircle2 className="size-4 text-[#5ea87a] shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-[#5ea87a] mb-1"
                style={{ fontFamily: "var(--font-space)" }}>KENAPA BENAR</p>
              <p className="text-xs text-[#8a9bbf] leading-relaxed">{soal.explanation.correct}</p>
            </div>
          </div>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.04)" }} />

          {/* Wrong explanation */}
          <div className="flex gap-3">
            <XCircle className="size-4 text-[#e07b4a] shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-[#e07b4a] mb-1"
                style={{ fontFamily: "var(--font-space)" }}>KENAPA SALAH</p>
              <p className="text-xs text-[#8a9bbf] leading-relaxed">{soal.explanation.wrong}</p>
            </div>
          </div>

          {/* Grammar points */}
          {soal.explanation.grammar.filter(g => g.term && g.meaning).length > 0 && (
            <>
              <div className="h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
              <div className="flex flex-wrap gap-1.5">
                {soal.explanation.grammar.filter(g => g.term && g.meaning).map((g, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-[11px]"
                    style={{ background: "rgba(107,156,218,0.1)", color: "#8ab4e8", fontFamily: "var(--font-jakarta)" }}>
                    {g.term} — {g.meaning}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Tips */}
          {soal.explanation.tips && (
            <>
              <div className="h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
              <div className="flex gap-3">
                <Sparkles className="size-4 text-[#6b9cda] shrink-0 mt-0.5" />
                <p className="text-xs text-[#8a9bbf] leading-relaxed italic">{soal.explanation.tips}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
