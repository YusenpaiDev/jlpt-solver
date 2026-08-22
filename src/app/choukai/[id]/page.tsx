"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import {
  Headphones, Play, Pause, RotateCcw, Rewind, FastForward, Check, X, ChevronLeft, ChevronRight, ChevronDown,
  Lightbulb, Grid3x3, Plus, BookOpen, Loader2, Sparkles, AlertCircle, Highlighter, Undo2, Trash2,
} from "lucide-react";
import { StabiloLayer, STABILO_COLORS, type HiStroke } from "@/components/StabiloLayer";
import { useUserStats } from "@/lib/use-user-stats";

type Level = "N1" | "N2" | "N3" | "N4" | "N5";

interface GrammarPoint { jp: string; reading: string; id: string }
interface TranscriptLine { sp: string; jp: string; id?: string }

interface ChoukaiQuestion {
  mondai?: number;
  category?: string;
  audio?: string;
  image?: string | null;
  question: string;
  options: string[];
  correct: string | number;
  explanation: string;
  why_wrong?: string;
  grammar_points?: GrammarPoint[];
  tip?: string;
  transcript?: TranscriptLine[];
  prompt?: string;
}

interface ChoukaiAiResult {
  title: string;
  section?: string;
  vocabulary?: unknown[];
  questions: ChoukaiQuestion[];
}

interface SessionRow {
  id: string;
  level: Level;
  category: string;
  title: string;
  total: number;
  score: number | null;
  created_at: string;
  ai_result: ChoukaiAiResult | null;
}

interface AnswerState { picked: number; correct: boolean }

const MONDAI_NAMES: Record<number, string> = {
  1: "課題理解",
  2: "ポイント理解",
  3: "概要理解",
  4: "即時応答",
  5: "統合理解",
};

const MONDAI_TIPS: Record<number, string> = {
  1: "Fokus ke kalimat keputusan terakhir — sering ada kata kunci 「その前に」「まず」「あとで」 yang nentuin urutan tindakan.",
  2: "Pertanyaan biasanya disebut DI AWAL audio. Catat poin pertanyaan dulu sebelum opsi.",
  3: "Tidak ada opsi tertulis di kertas. Fokus tangkap TEMA UMUM, bukan detail.",
  4: "Pilih respons paling natural. Jawaban sering yang paling singkat & langsung.",
  5: "Audio panjang — buat catatan singkat orang per orang. Jawab setelah dengar penuh.",
};

function stripOptionPrefix(opt: string): string {
  return opt.replace(/^\s*[1-4０-９]\s*[.．、:]\s*/, "");
}

function toIdx(correct: string | number, optionsLen: number): number {
  const n = typeof correct === "number" ? correct : parseInt(String(correct).replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n)) return -1;
  if (n >= 1 && n <= optionsLen) return n - 1;
  return n;
}

function stateFor(i: number, picked: number | null, submitted: boolean, correctIdx: number) {
  if (!submitted) return picked === i ? "picked" : "";
  if (i === correctIdx) return "correct";
  if (i === picked) return "wrong";
  return "dim";
}

/* ─── Audio Player ─── */

function AudioPlayer({ src }: { src?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [played, setPlayed] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = speed;
  }, [speed]);

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); return; }
    try { await a.play(); } catch { /* user gesture / missing handled by onError */ }
  };

  const replay = async () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    setT(0);
    try { await a.play(); } catch { /* ignore */ }
  };

  // Mundur / maju beberapa detik (buat navigasi audio panjang).
  const seek = (delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    const next = Math.min(Math.max(a.currentTime + delta, 0), a.duration || a.currentTime + delta);
    a.currentTime = next;
    setT(next);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const pct = dur > 0 ? (t / dur) * 100 : 0;
  const bars = Array.from({ length: 48 }, (_, i) => i);

  return (
    <div className="ch-player glass-card">
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
          onEnded={() => { setPlaying(false); setPlayed(true); }}
          onError={() => setMissing(true)}
        />
      )}
      <div className="chp-row">
        <button type="button" className="chp-skip" onClick={() => seek(-10)} disabled={missing || !src}
                title="Mundur 10 detik" aria-label="Mundur 10 detik">
          <Rewind size={16} strokeWidth={2} fill="currentColor" />
          <span className="chp-skip-n">10</span>
        </button>
        <button type="button" className="chp-play" onClick={togglePlay} disabled={missing || !src}
                aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
        <button type="button" className="chp-skip" onClick={() => seek(10)} disabled={missing || !src}
                title="Maju 10 detik" aria-label="Maju 10 detik">
          <FastForward size={16} strokeWidth={2} fill="currentColor" />
          <span className="chp-skip-n">10</span>
        </button>
        <div className="chp-main">
          <div className="chp-wave">
            {bars.map(i => {
              const on = (i / bars.length) * 100 <= pct;
              const h = 22 + Math.abs(Math.sin(i * 0.9)) * 60 + (i % 3) * 8;
              const live = playing && on && i === Math.floor((pct / 100) * bars.length);
              return (
                <span
                  key={i}
                  className={`chp-bar${on ? " on" : ""}${live ? " live" : ""}`}
                  style={{ height: `${Math.min(h, 90)}%` }}
                />
              );
            })}
          </div>
          <div className="chp-times"><span>{fmt(t)}</span><span>{fmt(dur)}</span></div>
        </div>
        <button type="button" className="chp-replay" onClick={replay} title="Ulang dari awal"
                disabled={missing || !src} aria-label="Ulang">
          <RotateCcw size={17} strokeWidth={2} />
        </button>
      </div>
      <div className="chp-foot">
        <div className="chp-speed">
          {[0.75, 1, 1.25].map(s => (
            <button
              key={s}
              type="button"
              className={`chp-sp${speed === s ? " on" : ""}`}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
        {missing && (
          <span className="chp-missing">
            <AlertCircle size={12} /> Audio belum tersedia
          </span>
        )}
        {!missing && src && !played && t === 0 && (
          <span className="chp-hint"><Headphones size={12} strokeWidth={1.8} /> Dengerin dulu sebelum jawab</span>
        )}
        {!missing && played && (
          <span className="chp-done"><Check size={12} strokeWidth={2.4} /> Sudah didengar</span>
        )}
      </div>
    </div>
  );
}

/* ─── Pembahasan ─── */

function Pembahasan({ q, correct, correctNum }: { q: ChoukaiQuestion; correct: boolean; correctNum: number }) {
  return (
    <section className={`ch-pemb ${correct ? "good" : "bad"}`}>
      <div className="ch-pemb-badge">
        <span className={`chpb-ic ${correct ? "good" : "bad"}`}>
          {correct ? <Check size={14} strokeWidth={2.6} /> : <X size={14} strokeWidth={2.6} />}
        </span>
        <strong>{correct ? "Benar! いいね" : `Belum tepat — jawaban yang benar nomor ${correctNum}`}</strong>
      </div>

      <div className="ch-pemb-sec good">
        <div className="ch-pemb-h">
          <Lightbulb size={13} strokeWidth={1.8} /> KENAPA BENAR
        </div>
        <p>{q.explanation}</p>
      </div>

      {q.why_wrong && (
        <div className="ch-pemb-sec bad">
          <div className="ch-pemb-h"><X size={13} strokeWidth={2} /> PILIHAN LAIN</div>
          <p>{q.why_wrong}</p>
        </div>
      )}

      {q.tip && (
        <div className="ch-pemb-sec vocab">
          <div className="ch-pemb-h"><Sparkles size={13} strokeWidth={1.8} /> TIP</div>
          <p>{q.tip}</p>
        </div>
      )}

      {q.grammar_points && q.grammar_points.length > 0 && (
        <div className="ch-pemb-sec vocab">
          <div className="ch-pemb-h">
            <BookOpen size={13} strokeWidth={1.8} /> KOSAKATA KUNCI
            <Link className="ch-pemb-link" href="/kamus">+ Simpan semua</Link>
          </div>
          <div className="ch-chips">
            {q.grammar_points.map((v, i) => (
              <span className="ch-chip" key={i}>
                <span className="ch-chip-k">{v.jp}</span>
                <span className="ch-chip-r">{v.reading}</span>
                <span className="ch-chip-m">{v.id}</span>
                <span className="ch-chip-add"><Plus size={10} strokeWidth={2.6} /></span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── Main page ─── */

export default function ChoukaiPlayer() {
  const stats = useUserStats();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params?.id;

  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [learnMode, setLearnMode] = useState(false);
  const [showMap, setShowMap] = useState(false);

  /* Coret/stabilo — sementara (gak ke DB): coretan per-soal keyed `c-${idx}`,
     ilang pas reload/keluar halaman. Overlay nutupin kartu soal pas draw mode. */
  const [drawMode, setDrawMode] = useState(false);
  const [stabiloColor, setStabiloColor] = useState<string>(STABILO_COLORS[0].rgba);
  const [highlights, setHighlights] = useState<Record<string, HiStroke[]>>({});
  const hasAnyStroke = Object.values(highlights).some(a => a.length > 0);

  // Guard biar skor/XP cuma disimpan sekali per sesi.
  const [saved, setSaved] = useState(false);
  const commitStroke = (key: string, s: HiStroke) =>
    setHighlights(h => ({ ...h, [key]: [...(h[key] ?? []), s] }));
  // Undo global: buang coretan dgn timestamp terbaru di seluruh soal.
  const undoLastStroke = () => setHighlights(h => {
    let bestKey: string | null = null, bestIdx = -1, bestT = -Infinity;
    for (const [k, arr] of Object.entries(h)) {
      for (let i = 0; i < arr.length; i++) {
        const t = arr[i].t ?? 0;
        if (t >= bestT) { bestT = t; bestKey = k; bestIdx = i; }
      }
    }
    if (bestKey === null) return h;
    const arr = h[bestKey].slice();
    arr.splice(bestIdx, 1);
    return { ...h, [bestKey]: arr };
  });

  useEffect(() => {
    async function load() {
      if (!sessionId) return;
      setLoading(true);
      setFetchError(null);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setFetchError("Kamu perlu login untuk membuka sesi ini.");
          return;
        }
        setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());

        const [profileRes, sessionRes] = await Promise.all([
          supabase.from("profiles").select("streak").eq("id", user.id).single(),
          supabase.from("sessions").select("*").eq("id", sessionId).single(),
        ]);
        if (profileRes.data) setStreak(profileRes.data.streak ?? 0);
        if (sessionRes.error) throw sessionRes.error;
        const row = sessionRes.data as SessionRow;
        setSession(row);
        // Restore jawaban kalau sesi ini pernah dikerjain (biar bisa di-review).
        const prev = (row.ai_result as { user_progress?: { answers?: Record<number, AnswerState> } } | null)?.user_progress?.answers;
        if (prev) setAnswers(prev);
        if (row.score != null) setSaved(true); // udah selesai → jangan re-save/re-XP
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Gagal memuat sesi.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  const questions: ChoukaiQuestion[] = useMemo(
    () => session?.ai_result?.questions ?? [],
    [session]
  );

  const q = questions[idx];

  useEffect(() => {
    setShowScript(false);
    const prev = q ? answers[idx] : null;
    setPicked(prev ? prev.picked : null);
    setSubmitted(!!prev);
  }, [idx, q, answers]);

  /* Simpan skor + stats + XP pas SEMUA soal kejawab. Dulu choukai gak pernah
     nyimpen apa-apa (doSubmit cuma state lokal) → Statistik/Riwayat kosong. */
  useEffect(() => {
    const total = questions.length;
    if (!sessionId || total === 0 || saved || !session) return;
    if (session.score != null) return;                 // udah selesai sebelumnya
    const answered = Object.keys(answers).length;
    if (answered < total) return;                       // belum semua dijawab
    const correct = Object.values(answers).filter(a => a.correct).length;
    setSaved(true);
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const stats = { answered, correct, perCat: { "聴解": { a: answered, c: correct } } };
        const nextAi = { ...(session.ai_result ?? {}), stats, user_progress: { answers } };
        await supabase.from("sessions").update({ score: correct, ai_result: nextAi }).eq("id", sessionId);
        const { data: prof } = await supabase.from("profiles").select("xp").eq("id", user.id).single();
        await supabase.from("profiles").update({ xp: (prof?.xp ?? 0) + correct * 10 + 5 }).eq("id", user.id);
      } catch { /* biarin — nyusul kalau gagal */ }
    })();
  }, [answers, questions.length, sessionId, saved, session]);

  if (loading) {
    return (
      <>
        <AuroraBackground />
        <NavRail />
        <main className="app-shell">
          <div className="ch-list-empty"><Loader2 size={20} className="ch-spin" /> Memuat sesi…</div>
        </main>
      </>
    );
  }

  if (fetchError || !session || !q) {
    return (
      <>
        <AuroraBackground />
        <NavRail />
        <main className="app-shell">
          <div className="glass-card ch-list-empty">
            <AlertCircle size={24} style={{ color: "var(--accent-rose)" }} />
            <h3>{fetchError ?? "Sesi tidak ditemukan atau belum punya soal"}</h3>
            <Link href="/choukai" className="btn btn-secondary btn-sm">← Kembali ke daftar</Link>
          </div>
        </main>
      </>
    );
  }

  const correctIdx = toIdx(q.correct, q.options.length);
  const mondai = q.mondai ?? 1;
  const mondaiName = MONDAI_NAMES[mondai] ?? "";
  const transcriptOpen = showScript || learnMode || submitted;

  const doSubmit = () => {
    if (picked == null) return;
    setSubmitted(true);
    setAnswers(s => ({ ...s, [idx]: { picked, correct: picked === correctIdx } }));
  };

  const go = (delta: number) => {
    const n = Math.max(0, Math.min(questions.length - 1, idx + delta));
    setIdx(n);
  };

  const answeredCount = Object.keys(answers).length;
  const mondaiGroups: Record<number, number[]> = {};
  questions.forEach((qq, i) => {
    const m = qq.mondai ?? 1;
    (mondaiGroups[m] ||= []).push(i);
  });
  const mondaiOrder = Object.keys(mondaiGroups).map(Number).sort((a, b) => a - b);

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />

      <main className="app-shell ch-page">
        <UserBar
          streakDays={streak}
          xp={stats.xp}
          xpTarget={stats.xpTarget}
          avatarLetter={userInitial}
          isPro={stats.isPro}
         
        />

        <header className="ch-header">
          <div>
            <Breadcrumb items={[
              { label: "Beranda", href: "/" },
              { label: "Choukai", href: "/choukai" },
              { label: session.title || "Sesi" },
            ]} />
            <h1 className="ch-title">
              Choukai <span className="ch-title-jp">聴解</span>
              <span className={`lv-tag lv-${session.level.toLowerCase()}`}>{session.level}</span>
            </h1>
          </div>
          <div className="ch-head-actions">
            <button
              type="button"
              className={`ch-toggle${showTranslation ? " on" : ""}`}
              onClick={() => setShowTranslation(v => !v)}
            >
              <span className="furi-jp">あ</span> Terjemahan
              {showTranslation && <Check size={11} strokeWidth={2.4} />}
            </button>
            <button
              type="button"
              className={`ch-toggle${learnMode ? " on" : ""}`}
              onClick={() => setLearnMode(v => !v)}
            >
              <Lightbulb size={12} strokeWidth={1.8} /> Mode Belajar
              {learnMode && <Check size={11} strokeWidth={2.4} />}
            </button>
            <button type="button" className="ch-toggle" onClick={() => setShowMap(true)}>
              <Grid3x3 size={12} strokeWidth={1.8} /> Peta Soal
            </button>
          </div>
        </header>

        <div className="ch-mondai-bar glass-card">
          <div className="chm-info">
            <span className="chm-no">問題{mondai}</span>
            <span className="chm-name">{mondaiName}</span>
            <span className="chm-count">
              soal {idx + 1} <span className="muted">/ {questions.length}</span>
            </span>
          </div>
          <div className="chm-track">
            <div
              className="chm-fill"
              style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
            />
          </div>
          <div className="chm-mondai-pills">
            {mondaiOrder.map(m => (
              <span key={m} className={`chm-pill${m === mondai ? " on" : ""}`}>{m}</span>
            ))}
          </div>
        </div>

        <div className="ch-grid">
          <article className="glass-card ch-card">
            <div className="ch-qbody">
              <div className="ch-situation">
                <span className="ch-sit-tag">問題{mondai}</span>
                <p>{q.question}</p>
              </div>

              {/* key di-base ke src audio (bukan idx) → 1 file utuh per tes:
                  player gak remount/reset pas pindah soal, posisi audio kebawa. */}
              <AudioPlayer key={q.audio ?? sessionId} src={q.audio} />

              {q.image && (
                <div className="ch-soal-img-fixed">
                  <img src={q.image} alt={`Soal ${idx + 1}`} />
                </div>
              )}

              {q.prompt && (
                <div className="ch-prompt ch-prompt-instr">
                  <p>{q.prompt}</p>
                </div>
              )}

              <div className="ch-opts">
                {q.options.map((opt, i) => {
                  const st = stateFor(i, picked, submitted, correctIdx);
                  return (
                    <button
                      type="button"
                      key={i}
                      className={`ch-opt${st ? ` ${st}` : ""}`}
                      onClick={() => !submitted && setPicked(i)}
                    >
                      <span className="ch-opt-k">{i + 1}</span>
                      <span className="ch-opt-t">{stripOptionPrefix(opt)}</span>
                      {submitted && st === "correct" && (
                        <Check size={17} strokeWidth={2.4} style={{ color: "var(--accent-emerald)" }} />
                      )}
                      {submitted && st === "wrong" && (
                        <X size={17} strokeWidth={2.4} style={{ color: "var(--accent-rose)" }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {q.transcript && q.transcript.length > 0 && (
                <div className={`ch-script${transcriptOpen ? " open" : ""}`}>
                  <button
                    type="button"
                    className="ch-script-toggle"
                    onClick={() => setShowScript(s => !s)}
                  >
                    <span>
                      <Lightbulb size={13} strokeWidth={1.8} />{" "}
                      {transcriptOpen ? "Sembunyikan transkrip" : "Lihat transkrip"}
                    </span>
                    <ChevronDown size={14} className="ch-script-chev" />
                  </button>
                  {transcriptOpen && (
                    <div className="ch-script-body">
                      {q.transcript.map((line, i) => (
                        <div className="ch-line" key={i}>
                          <span className="ch-line-sp">{line.sp}</span>
                          <div className="ch-line-text">
                            <span className="ch-line-jp">{line.jp}</span>
                            {showTranslation && line.id && (
                              <span className="ch-line-id">{line.id}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!submitted ? (
                <div className="ch-submit-row">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(1)}>
                    Lewati soal
                  </button>
                  <button
                    type="button"
                    className={`ch-submit${picked == null ? " disabled" : ""}`}
                    disabled={picked == null}
                    onClick={doSubmit}
                  >
                    Jawab <Check size={14} strokeWidth={2.4} />
                  </button>
                </div>
              ) : (
                <Pembahasan q={q} correct={picked === correctIdx} correctNum={correctIdx + 1} />
              )}
            </div>

            <div className="ch-nav">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={idx === 0}
                onClick={() => go(-1)}
              >
                <ChevronLeft size={14} /> Sebelumnya
              </button>
              <span className="ch-nav-mid">{idx + 1} dari {questions.length}</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={idx === questions.length - 1}
                onClick={() => go(1)}
              >
                Selanjutnya <ChevronRight size={14} />
              </button>
            </div>
            {/* Overlay coret — nutupin kartu soal pas draw mode (per-soal) */}
            <StabiloLayer
              strokes={highlights[`c-${idx}`] ?? []}
              active={drawMode}
              color={stabiloColor}
              onCommit={(s) => commitStroke(`c-${idx}`, s)}
            />
          </article>

          <aside className="ch-side">
            <div className="glass-card ch-side-card">
              <div className="ch-side-head">
                <Grid3x3 size={13} strokeWidth={1.8} style={{ color: "var(--accent-iris)" }} />{" "}
                Peta Soal{" "}
                <span className="ch-side-meta">
                  <b>{answeredCount}</b>/{questions.length}
                </span>
              </div>
              <div className="ch-num-grid">
                {questions.map((_, i) => {
                  const a = answers[i];
                  let cls = "";
                  if (i === idx) cls = "on";
                  else if (a) cls = a.correct ? "correct" : "wrong";
                  return (
                    <button
                      type="button"
                      key={i}
                      className={`ch-cell${cls ? ` ${cls}` : ""}`}
                      onClick={() => setIdx(i)}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="ch-legend">
                <span><i className="lg on" />Sekarang</span>
                <span><i className="lg correct" />Benar</span>
                <span><i className="lg wrong" />Salah</span>
                <span><i className="lg" />Belum</span>
              </div>
            </div>

            <div className="glass-card ch-side-card ch-tip">
              <div className="ch-side-head">
                <Sparkles size={12} fill="var(--accent-amber)" stroke="var(--accent-amber)" strokeWidth={1.2} />{" "}
                Tip 問題{mondai}
              </div>
              <p>{MONDAI_TIPS[mondai] ?? "Dengar audio sampai habis sebelum jawab — opsi sering muncul di kalimat akhir."}</p>
            </div>

            <button
              type="button"
              className="ch-pause-btn"
              onClick={() => router.push("/choukai")}
            >
              <Pause size={13} strokeWidth={2} /> Jeda &amp; kembali
            </button>
          </aside>
        </div>
      </main>

      {showMap && (
        <div className="ch-map-mask" onClick={() => setShowMap(false)}>
          <div className="ch-map glass-card" onClick={e => e.stopPropagation()}>
            <div className="ch-map-head">
              <h3>Peta Soal — {questions.length} soal · {mondaiOrder.length} mondai</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowMap(false)}
                aria-label="Tutup"
              >
                <X size={14} />
              </button>
            </div>
            <div className="ch-map-body">
              {mondaiOrder.map(m => (
                <div className="ch-map-mondai" key={m}>
                  <div className="ch-map-mlabel">
                    <span className="chm-no">問題{m}</span>{" "}
                    <span>{MONDAI_NAMES[m]}</span>{" "}
                    <span className="muted">· {mondaiGroups[m].length} soal</span>
                  </div>
                  <div className="ch-num-grid">
                    {mondaiGroups[m].map(qi => {
                      const a = answers[qi];
                      let cls = "";
                      if (qi === idx) cls = "on";
                      else if (a) cls = a.correct ? "correct" : "wrong";
                      return (
                        <button
                          type="button"
                          key={qi}
                          className={`ch-cell${cls ? ` ${cls}` : ""}`}
                          onClick={() => { setIdx(qi); setShowMap(false); }}
                        >
                          {qi + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dock coret-coret (stabilo) — sementara, gak ke DB */}
      <div className={`stabilo-dock${drawMode ? " open" : ""}`}>
        {drawMode && (
          <div className="stabilo-dock-tools">
            {STABILO_COLORS.map(c => (
              <button
                key={c.key}
                type="button"
                onClick={() => setStabiloColor(c.rgba)}
                className={`stabilo-swatch${stabiloColor === c.rgba ? " on" : ""}`}
                style={{ background: c.rgba }}
                title={c.key}
              />
            ))}
            <span className="stabilo-dock-sep" />
            <button
              type="button"
              onClick={undoLastStroke}
              disabled={!hasAnyStroke}
              className="stabilo-tool"
              title="Undo coretan terakhir"
            >
              <Undo2 size={13} strokeWidth={1.8} /> Undo
            </button>
            <button
              type="button"
              onClick={() => setHighlights({})}
              disabled={!hasAnyStroke}
              className="stabilo-tool"
              title="Hapus semua coretan"
            >
              <Trash2 size={13} strokeWidth={1.8} /> Hapus
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setDrawMode(v => !v)}
          className={`stabilo-fab${drawMode ? " on" : ""}`}
          title={drawMode ? "Selesai coret" : "Mode coret — corat-coret di soal"}
        >
          {drawMode ? <Check size={16} strokeWidth={2.4} /> : <Highlighter size={16} strokeWidth={1.8} />}
          {drawMode ? "Selesai" : "Coret"}
        </button>
      </div>
    </>
  );
}
