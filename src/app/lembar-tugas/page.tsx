"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import {
  Check, X, ChevronLeft, ChevronRight, Clock, History, Sparkles, Wand2, Flag, Pause,
  BookOpen, BookA, Zap, NotebookPen,
} from "lucide-react";

type Difficulty = "mudah" | "sedang" | "sulit";
type CategoryAll = "全" | "語彙" | "文法" | "文字" | "読解";
type Level = "N1" | "N2" | "N3" | "N4" | "N5";
type Stage = "setup" | "generating" | "quiz";

interface Option { text: string; correct: boolean }
interface Soal {
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
}

interface RiwayatItem {
  id: string;
  title: string;
  category: string;
  level: string;
  total: number;
  score: number | null;
  created_at: string;
}

const LEVELS: { lv: Level; desc: string }[] = [
  { lv: "N5", desc: "Pemula" },
  { lv: "N4", desc: "Dasar" },
  { lv: "N3", desc: "Menengah" },
  { lv: "N2", desc: "Tinggi" },
  { lv: "N1", desc: "Mahir" },
];

const KATEGORIS: { jp: Exclude<CategoryAll, "全">; label: string; desc: string; Icon: typeof BookOpen; tone: "iris" | "emerald" | "amber" | "rose" }[] = [
  { jp: "文法", label: "Bunpou",  desc: "Tata bahasa, pola, partikel",  Icon: BookOpen,    tone: "iris" },
  { jp: "語彙", label: "Goi",     desc: "Kosakata, sinonim, kolokasi",  Icon: BookA,       tone: "emerald" },
  { jp: "文字", label: "Moji",    desc: "Kanji reading + writing",      Icon: Zap,         tone: "amber" },
  { jp: "読解", label: "Dokkai",  desc: "Reading comprehension",        Icon: NotebookPen, tone: "rose" },
];

const COUNTS = [5, 10, 15, 20, 30];

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function relativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "Hari ini";
  if (days < 2) return "Kemarin";
  if (days < 7) return `${days} hari`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function scoreTone(score: number | null, total: number): "good" | "mid" | "bad" | "none" {
  if (score == null || total === 0) return "none";
  const pct = score / total;
  if (pct >= 0.85) return "good";
  if (pct >= 0.65) return "mid";
  return "bad";
}

export default function LembarTugas() {
  const [stage, setStage] = useState<Stage>("setup");

  /* Setup */
  const [level, setLevel] = useState<Level>("N2");
  const [kategori, setKategori] = useState<CategoryAll>("文法");
  const [count, setCount] = useState(10);
  const [timerOn, setTimerOn] = useState(true);

  /* Quiz */
  const [soalList, setSoalList] = useState<Soal[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /* Shared */
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const [riwayat, setRiwayat] = useState<RiwayatItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const xp = 820;
  const xpTarget = 1000;

  /* Load profile + history */
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
      const [profileRes, sessionRes] = await Promise.all([
        supabase.from("profiles").select("target_level, streak").eq("id", user.id).single(),
        supabase.from("sessions")
          .select("id, title, category, level, total, score, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(24),
      ]);
      if (profileRes.data) {
        if (profileRes.data.target_level) setLevel(profileRes.data.target_level as Level);
        setStreak(profileRes.data.streak ?? 0);
      }
      setRiwayat((sessionRes.data ?? []) as RiwayatItem[]);
    }
    load();
  }, []);

  /* Quiz timer */
  useEffect(() => {
    if (stage !== "quiz" || !timerOn || startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [stage, timerOn, startedAt]);

  const elapsed = startedAt != null ? Math.floor((now - startedAt) / 1000) : 0;
  const soal = soalList[current];
  const picked = soal ? answers[soal.id] : undefined;
  const correctIdx = soal ? soal.options.findIndex(o => o.correct) : -1;
  const showResult = picked != null;

  const allAnswered = soalList.length > 0 && soalList.every(s => answers[s.id] != null);
  const correctCount = soalList.filter(s => {
    const p = answers[s.id];
    return p != null && s.options[p]?.correct;
  }).length;

  async function handleGenerate() {
    setError(null);
    setStage("generating");
    try {
      const res = await fetch("/api/tugas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, category: kategori, count }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const questions: Soal[] = json.data.questions.map((q: Omit<Soal, "id">, i: number) => ({
        ...q, id: i + 1,
      }));
      setSoalList(questions);
      setAnswers({});
      setFlagged(new Set());
      setCurrent(0);
      setStartedAt(Date.now());
      setNow(Date.now());
      setSaved(false);
      setStage("quiz");
    } catch {
      setError("Gagal membuat soal. Coba lagi.");
      setStage("setup");
    }
  }

  async function handleFinish() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const catLabel = kategori === "全" ? "Semua" : kategori;
    await supabase.from("sessions").insert({
      user_id: user.id,
      level,
      category: catLabel,
      title: `Lembar Tugas ${level} — ${catLabel}`,
      total: soalList.length,
      score: correctCount,
    });
    setSaving(false);
    setSaved(true);
    // refresh
    const { data } = await supabase.from("sessions")
      .select("id, title, category, level, total, score, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(24);
    setRiwayat((data ?? []) as RiwayatItem[]);
  }

  function pickAnswer(i: number) {
    if (!soal) return;
    if (answers[soal.id] != null) return;
    setAnswers(p => ({ ...p, [soal.id]: i }));
  }

  function toggleFlag() {
    if (!soal) return;
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(soal.id)) next.delete(soal.id); else next.add(soal.id);
      return next;
    });
  }

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />

      <main className="app-shell">
        <UserBar
          streakDays={streak}
          xp={xp}
          xpTarget={xpTarget}
          avatarLetter={userInitial}
          isPro
          hasUnread
        />

        <header className="lt-header">
          <div>
            <Breadcrumb items={
              stage === "setup"
                ? [{ label: "Beranda", href: "/" }, { label: "Lembar Tugas" }]
                : [
                    { label: "Beranda", href: "/" },
                    { label: "Lembar Tugas" },
                    { label: `Sesi · ${count} soal` },
                  ]
            } />
            <div className="lt-header-title-row">
              {stage === "quiz" && (
                <span className={`lv-badge lv-${level.toLowerCase()}`}>
                  <span>{level}</span>
                  <span className="lv-badge-kat">{kategori === "全" ? "MIX" : kategori}</span>
                </span>
              )}
              <h1 className="lt-title">
                {stage === "setup" ? (
                  <>Lembar Tugas <span className="lt-title-jp">課題</span></>
                ) : (
                  <>Generated <span className="lt-title-jp">問題</span></>
                )}
              </h1>
            </div>
          </div>

          <div className="lt-header-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrawerOpen(true)}>
              <History size={13} />
              Riwayat
              {riwayat.length > 0 && <span className="lt-riwayat-count">{riwayat.length}</span>}
            </button>
            {stage === "quiz" && (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTimerOn(o => !o)}>
                  <Pause size={12} strokeWidth={2} />
                  {timerOn ? "Jeda timer" : "Lanjut"}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStage("setup")}>
                  <X size={12} strokeWidth={2} />
                  Keluar
                </button>
              </>
            )}
          </div>
        </header>

        {error && (
          <div className="glass-card" style={{ padding: 16, marginBottom: 16, border: "1px solid rgba(164,36,59,0.32)", background: "rgba(164,36,59,0.06)" }}>
            <p style={{ color: "var(--accent-rose)", margin: 0, fontSize: 13 }}>⚠️ {error}</p>
          </div>
        )}

        {stage === "setup" && (
          <SetupView
            level={level} setLevel={setLevel}
            kategori={kategori} setKategori={setKategori}
            count={count} setCount={setCount}
            timerOn={timerOn} setTimerOn={setTimerOn}
            riwayat={riwayat}
            onStart={handleGenerate}
          />
        )}

        {stage === "generating" && (
          <div className="glass-card lt-gen-overlay">
            <div className="lt-gen-spinner" />
            <p className="lt-gen-title">Menyiapkan {count} soal {level} {kategori === "全" ? "" : kategori}...</p>
            <p className="lt-gen-sub">Sensei AI lagi nyiapin soal — biasanya butuh 10-20 detik.</p>
          </div>
        )}

        {stage === "quiz" && soal && (
          <QuizView
            soalList={soalList}
            soal={soal}
            current={current} setCurrent={setCurrent}
            picked={picked} pickAnswer={pickAnswer}
            answers={answers}
            flagged={flagged} toggleFlag={toggleFlag}
            correctIdx={correctIdx}
            showResult={showResult}
            elapsed={elapsed}
            level={level}
            kategori={kategori === "全" ? "MIX" : kategori}
            allAnswered={allAnswered}
            correctCount={correctCount}
            saving={saving}
            saved={saved}
            onFinish={handleFinish}
            onReset={() => setStage("setup")}
          />
        )}
      </main>

      <RiwayatDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        riwayat={riwayat}
      />
    </>
  );
}

/* ─── Setup view ─── */

function SetupView({
  level, setLevel, kategori, setKategori, count, setCount, timerOn, setTimerOn,
  riwayat, onStart,
}: {
  level: Level; setLevel: (l: Level) => void;
  kategori: CategoryAll; setKategori: (k: CategoryAll) => void;
  count: number; setCount: (n: number) => void;
  timerOn: boolean; setTimerOn: (b: boolean) => void;
  riwayat: RiwayatItem[];
  onStart: () => void;
}) {
  return (
    <div className="lt-setup-grid">
      <main className="lt-setup-main">
        <section className="setup-section glass-card">
          <div className="section-head">
            <span className="section-num">1</span>
            <div>
              <h3 className="section-title">Pilih Level</h3>
              <p className="section-desc">AI akan tune kesulitan soal sesuai level kamu</p>
            </div>
          </div>
          <div className="level-picker">
            {LEVELS.map(opt => (
              <button
                key={opt.lv}
                type="button"
                className={`level-tile lvt-${opt.lv.toLowerCase()}${level === opt.lv ? " on" : ""}`}
                onClick={() => setLevel(opt.lv)}
              >
                <span className="lvt-letter">{opt.lv}</span>
                <span className="lvt-desc">{opt.desc}</span>
                {level === opt.lv && (
                  <span className="lvt-check">
                    <Check size={10} strokeWidth={3} style={{ color: "#0E1116" }} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="setup-section glass-card">
          <div className="section-head">
            <span className="section-num">2</span>
            <div>
              <h3 className="section-title">Pilih Kategori</h3>
              <p className="section-desc">Atau biarkan AI campur — pilih salah satu di bawah</p>
            </div>
          </div>
          <div className="kat-grid">
            {KATEGORIS.map(k => (
              <button
                key={k.jp}
                type="button"
                className={`kat-tile kt-${k.tone}${kategori === k.jp ? " on" : ""}`}
                onClick={() => setKategori(k.jp)}
              >
                <div className="kt-icon">
                  <k.Icon size={16} strokeWidth={1.8} />
                </div>
                <div className="kt-text">
                  <div className="kt-jp">{k.jp}</div>
                  <div className="kt-label">{k.label}</div>
                  <div className="kt-desc">{k.desc}</div>
                </div>
                {kategori === k.jp && (
                  <span className="kt-check">
                    <Check size={10} strokeWidth={3} style={{ color: "#0E1116" }} />
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`kat-mix-btn${kategori === "全" ? " on" : ""}`}
            onClick={() => setKategori("全")}
          >
            <Sparkles size={11} fill="currentColor" strokeWidth={1.2} />
            {kategori === "全" ? "AI campur semua kategori ✓" : "Biar AI yang campur semua kategori →"}
          </button>
        </section>

        <section className="setup-section glass-card">
          <div className="section-head">
            <span className="section-num">3</span>
            <div>
              <h3 className="section-title">Opsi Sesi</h3>
              <p className="section-desc">Sesuaikan jumlah soal &amp; pengaturan ujian</p>
            </div>
          </div>
          <div className="opt-row">
            <div className="opt-block">
              <label className="opt-label">Jumlah soal</label>
              <div className="count-stepper">
                {COUNTS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`step-chip${count === c ? " on" : ""}`}
                    onClick={() => setCount(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="opt-est">
                <Clock size={11} strokeWidth={1.6} style={{ color: "var(--text-tertiary)" }} />
                Estimasi: <strong>{Math.round(count * 1.2)} menit</strong>
              </div>
            </div>
            <div className="opt-divider" />
            <div className="opt-block">
              <label className="opt-label">Mode</label>
              <div className="toggle-pair">
                <button
                  type="button"
                  className={`toggle-pill${timerOn ? " on" : ""}`}
                  onClick={() => setTimerOn(true)}
                >
                  <Clock size={12} strokeWidth={1.8} /> Dengan timer
                </button>
                <button
                  type="button"
                  className={`toggle-pill${!timerOn ? " on" : ""}`}
                  onClick={() => setTimerOn(false)}
                >
                  Tanpa timer
                </button>
              </div>
            </div>
          </div>
        </section>

        <button type="button" className="lt-start-cta" onClick={onStart}>
          <div className="cta-bg" />
          <Wand2 size={16} strokeWidth={1.8} />
          <span className="cta-text">Generate &amp; Mulai Sesi</span>
          <span className="cta-meta">
            {count} soal · {level} · {kategori === "全" ? "MIX" : kategori}
          </span>
          <ChevronRight size={16} strokeWidth={2.2} />
        </button>
      </main>

      <aside className="lt-setup-side">
        <div className="glass-card lt-side-card">
          <div className="lt-side-head">
            <History size={13} strokeWidth={1.8} style={{ color: "var(--accent-iris)" }} />
            Sesi Terbaru
          </div>
          {riwayat.length === 0 ? (
            <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", margin: 0, padding: "6px 4px" }}>
              Belum ada sesi.
            </p>
          ) : (
            <ul className="recent-list">
              {riwayat.slice(0, 5).map(r => {
                const tone = scoreTone(r.score, r.total);
                return (
                  <li key={r.id}>
                    <Link href={`/analisis-foto?session=${r.id}`} className="recent-item">
                      <span className={`lv-tag-mini lv-${r.level.toLowerCase()}`}>{r.level}</span>
                      <div className="recent-meta">
                        <div className="recent-title">
                          <span className="font-jp-sans">{r.category}</span>
                          <span className="recent-sep">·</span>
                          {r.total} soal
                        </div>
                        <div className="recent-date">{relativeDate(r.created_at)}</div>
                      </div>
                      {r.score != null && tone !== "none" && (
                        <span className={`recent-score rs-${tone}`}>{r.score}/{r.total}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="glass-card lt-side-card glow-amber">
          <div className="lt-side-head">
            <Sparkles size={12} fill="var(--accent-amber)" strokeWidth={1.2} style={{ color: "var(--accent-amber)" }} />
            Rekomendasi Sensei
          </div>
          <div>
            <div className="sg-eyebrow">Fokus latihan</div>
            <p className="sg-title">
              Coba sesi <strong>{kategori === "全" ? "MIX" : kategori}</strong> level {level} dengan {count} soal.
            </p>
            <p className="sg-desc">
              Sensei AI bakal generate soal khusus level kamu — kerjain lalu lihat akurasi di Statistik.
            </p>
            <button type="button" className="sg-cta" onClick={onStart}>
              Setup otomatis →
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ─── Quiz view ─── */

function QuizView({
  soalList, soal, current, setCurrent, picked, pickAnswer, answers, flagged, toggleFlag,
  correctIdx, showResult, elapsed, level, kategori, allAnswered, correctCount,
  saving, saved, onFinish, onReset,
}: {
  soalList: Soal[];
  soal: Soal;
  current: number;
  setCurrent: (i: number) => void;
  picked: number | undefined;
  pickAnswer: (i: number) => void;
  answers: Record<number, number>;
  flagged: Set<number>;
  toggleFlag: () => void;
  correctIdx: number;
  showResult: boolean;
  elapsed: number;
  level: Level;
  kategori: string;
  allAnswered: boolean;
  correctCount: number;
  saving: boolean;
  saved: boolean;
  onFinish: () => void;
  onReset: () => void;
}) {
  const total = soalList.length;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progress = ((current + 1) / total) * 100;

  return (
    <div className="lt-quiz-grid">
      <main className="lt-quiz-main">
        <div className="quiz-progress">
          <div className="qp-info">
            <span className="qp-counter">
              <strong>{String(current + 1).padStart(2, "0")}</strong>
              <span className="qp-total">/ {String(total).padStart(2, "0")}</span>
            </span>
            <div className="qp-bar">
              <div className="qp-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="qp-timer">
            <Clock size={13} strokeWidth={1.8} />
            <span className="qp-time-val">{fmtTime(elapsed)}</span>
            <span className="qp-time-tag">ELAPSED</span>
          </div>
        </div>

        <section className="glass-card quiz-card">
          <div className="quiz-meta-row">
            <span className={`lv-tag-mini lv-${level.toLowerCase()}`}>{level}</span>
            <span className="quiz-kat font-jp-sans">{soal.category || kategori}</span>
            <span className="quiz-num-tag">#{current + 1}</span>
          </div>

          {soal.context && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6, padding: 12, borderRadius: 10, background: "var(--surface-1)", border: "1px solid var(--edge-soft)" }}>
              {soal.context}
            </p>
          )}

          <p className="quiz-prompt">{soal.question}</p>

          <div className="quiz-options">
            {soal.options.map((opt, i) => {
              const isPicked = picked === i;
              const isCorrect = i === correctIdx;
              let cls = "";
              if (showResult) {
                if (isCorrect) cls = "correct";
                else if (isPicked) cls = "wrong";
              } else if (isPicked) cls = "picked";
              return (
                <button
                  key={i}
                  type="button"
                  className={`quiz-opt ${cls}`}
                  onClick={() => pickAnswer(i)}
                  disabled={showResult}
                >
                  <span className="qo-key">{String.fromCharCode(65 + i)}</span>
                  <span className="qo-text font-jp-sans">{opt.text}</span>
                  {showResult && isCorrect && <Check size={16} strokeWidth={2.4} style={{ color: "var(--accent-emerald)" }} />}
                  {showResult && isPicked && !isCorrect && <X size={16} strokeWidth={2.4} style={{ color: "var(--accent-rose)" }} />}
                </button>
              );
            })}
          </div>

          {showResult && (
            <div className="quiz-explain">
              <div className="qe-head">
                <span className="qe-badge">
                  <Sparkles size={10} fill="var(--accent-emerald)" strokeWidth={1.4} />
                  PENJELASAN
                </span>
              </div>
              {soal.explanation.correct && (
                <p className="qe-body">{soal.explanation.correct}</p>
              )}
              {soal.explanation.wrong && (
                <p className="qe-body" style={{ color: "var(--accent-rose)" }}>{soal.explanation.wrong}</p>
              )}
              {soal.explanation.tips && (
                <p className="qe-body" style={{ marginTop: 8 }}>
                  <strong>💡 Tips: </strong>{soal.explanation.tips}
                </p>
              )}
            </div>
          )}
        </section>

        <div className="quiz-nav">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={current === 0}
            onClick={() => setCurrent(current - 1)}
          >
            <ChevronLeft size={13} /> Sebelumnya
          </button>
          <div className="quiz-nav-center">
            <button
              type="button"
              className={`quiz-flag${flagged.has(soal.id) ? " on" : ""}`}
              onClick={toggleFlag}
            >
              <Flag size={12} />
              {flagged.has(soal.id) ? "Ditandai" : "Tandai"}
            </button>
            <span className="quiz-jump-hint">
              Pilih jawaban dulu · <kbd>→</kbd> lanjut
            </span>
          </div>
          {current < total - 1 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCurrent(current + 1)}
              disabled={picked == null}
            >
              Selanjutnya <ChevronRight size={13} />
            </button>
          ) : !allAnswered ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled
              title="Jawab semua soal dulu"
            >
              Selesai <Check size={13} strokeWidth={2.4} />
            </button>
          ) : saved ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={onReset}>
              Sesi baru <ChevronRight size={13} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onFinish}
              disabled={saving}
            >
              {saving ? "Menyimpan..." : `Selesai · ${correctCount}/${total}`}
              <Check size={13} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </main>

      <aside className="lt-quiz-side">
        <div className="glass-card quiz-side-card">
          <div className="qside-head">
            <span className="qside-title">Peta Soal</span>
            <span className="qside-meta">
              <span className="qsm-good">{answeredCount}</span>
              <span className="qsm-sep">/</span>
              <span>{total}</span>
            </span>
          </div>
          <div className="qside-grid">
            {soalList.map((s, i) => {
              const isCurrent = i === current;
              const isAnswered = answers[s.id] != null;
              const isFlagged = flagged.has(s.id);
              const cls = isCurrent ? "on" : isAnswered ? "done" : "";
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`qside-cell ${cls}${isFlagged ? " flagged" : ""}`}
                  onClick={() => setCurrent(i)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="qside-legend">
            <span><span className="lg-dot lg-on" /> Sekarang</span>
            <span><span className="lg-dot lg-done" /> Sudah</span>
            <span><span className="lg-dot lg-todo" /> Belum</span>
          </div>
        </div>

        <div className="glass-card quiz-tip-card">
          <div className="lt-side-head">
            <Sparkles size={12} fill="var(--accent-amber)" strokeWidth={1.2} style={{ color: "var(--accent-amber)" }} />
            Tips Sensei
          </div>
          <p className="quiz-tip-body">
            Baca soal pelan-pelan, terutama untuk pola{" "}
            <strong>「と / たら / ば / なら」</strong> — pikirin <em>siapa yang in control</em>.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ─── Riwayat drawer ─── */

function RiwayatDrawer({
  open, onClose, riwayat,
}: { open: boolean; onClose: () => void; riwayat: RiwayatItem[] }) {
  return (
    <>
      <div className={`drawer-overlay${open ? " on" : ""}`} onClick={onClose} />
      <aside className={`drawer${open ? " on" : ""}`}>
        <div className="drawer-head">
          <h3 className="drawer-title">Riwayat Lembar Tugas</h3>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Tutup">
            <X size={14} />
          </button>
        </div>
        <div className="drawer-body">
          <p className="drawer-sub">{riwayat.length} sesi terakhir · Klik untuk buka review</p>
          {riwayat.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", padding: "32px 0" }}>
              Belum ada sesi.
            </p>
          ) : (
            <ul className="drawer-list">
              {riwayat.map(r => {
                const tone = scoreTone(r.score, r.total);
                return (
                  <li key={r.id}>
                    <Link href={`/analisis-foto?session=${r.id}`} className="drawer-item">
                      <span className={`lv-tag-mini lv-${r.level.toLowerCase()}`}>{r.level}</span>
                      <div className="drawer-meta">
                        <div className="drawer-item-title">
                          <span className="font-jp-sans">{r.category}</span>
                          <span style={{ color: "var(--text-tertiary)", margin: "0 6px" }}>·</span>
                          {r.title}
                        </div>
                        <div className="drawer-item-sub">{relativeDate(r.created_at)} · {r.total} soal</div>
                      </div>
                      {r.score != null && tone !== "none" && (
                        <span className={`drawer-score ds-${tone}`}>{r.score}/{r.total}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
