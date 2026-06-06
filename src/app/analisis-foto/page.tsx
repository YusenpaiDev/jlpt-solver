"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar } from "@/components/v2";
import KamusFlashCard from "@/components/KamusFlashCard";
import {
  Camera, Bell, Upload, ArrowUpRight,
  CheckCircle2, Circle, Sparkles,
  ChevronLeft, ChevronDown, RotateCcw, Clock,
  X, Check, Send, Loader2, BookmarkPlus, BookmarkCheck, Star,
  BookOpen, Search, MessageCircle, NotebookPen, Plus, Flag, Pencil, Save, Copy, Trash2,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
type Stage = "upload" | "setup" | "analyzing" | "result";
type Level = "N1" | "N2" | "N3" | "N4" | "N5";
type Category = "文法" | "語彙" | "文字" | "読解" | "ai";

interface AIQuestion {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  why_wrong?: string;
  grammar_points?: { jp: string; reading?: string; id: string }[];
  tip?: string;
  category?: "文法" | "語彙" | "文字" | "読解";
  passage?: string | null;
  needs_review?: boolean;
}
interface VocabItem {
  word: string;
  reading: string;
  meaning: string;
  example?: string;
  jlpt_level?: string;
}
interface UserProgress {
  answers: Record<number, string>;
  revealed: number[];
  xp_claimed?: boolean;
}
interface AIResult {
  title: string;
  vocabulary?: VocabItem[];
  questions: AIQuestion[];
  user_progress?: UserProgress;
}
interface FileData {
  base64: string;
  mimeType: string;
  name: string;
  url: string;
  textContent?: string; // for .docx — extracted text
}
interface ChatMsg {
  role: "user" | "model";
  text: string;
}

/* Sometimes the AI bundles options ("1xxx 2xxx 3xxx 4xxx") into the question
   text — usually for 読解 where the option lines sit directly under the prompt.
   Detect that pattern at the tail of `question` and split it out.

   Returns null if no clean 4-option pattern is found. */
function splitInlineOptions(question: string): { question: string; options: string[] } | null {
  const text = question.replace(/\r\n?/g, "\n");
  const normDigit = (c: string) => ({
    "１": "1", "２": "2", "３": "3", "４": "4",
    "①": "1", "②": "2", "③": "3", "④": "4",
  } as Record<string,string>)[c] ?? c;

  // A marker is a digit 1/2/3/4 (half-width, full-width, or circled ①-④) at
  // line-start OR preceded by whitespace (incl. full-width). Half/full-width
  // must not be followed by another digit (so "12" isn't a match); circled
  // digits are inherently single-glyph.
  const markerRe = /(?:^|[\s　])([1-4１-４])(?![\d０-９])|(?:^|[\s　])([①-④])/g;
  const hits: { digitIdx: number; digit: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(text))) {
    const digit = m[1] ?? m[2];
    hits.push({ digitIdx: m.index + m[0].length - 1, digit: normDigit(digit) });
  }
  if (hits.length < 4) return null;

  // Look for a trailing 1→2→3→4 run (search from the last possible start).
  for (let i = hits.length - 4; i >= 0; i--) {
    const run = hits.slice(i, i + 4);
    if (run[0].digit !== "1" || run[1].digit !== "2" || run[2].digit !== "3" || run[3].digit !== "4") continue;

    let qEnd = run[0].digitIdx;
    while (qEnd > 0 && /[\s　]/.test(text[qEnd - 1])) qEnd--;
    const newQuestion = text.slice(0, qEnd).replace(/[\s　]+$/u, "");
    if (newQuestion.trim().length === 0) return null;

    const opts: string[] = [];
    for (let k = 0; k < 4; k++) {
      const start = run[k].digitIdx + 1;
      const end = k < 3 ? run[k + 1].digitIdx : text.length;
      const body = text.slice(start, end).replace(/^[．.、:：\s　]+/u, "").replace(/[\s　]+$/u, "");
      if (body.length === 0) return null;
      opts.push(`${k + 1}. ${body}`);
    }
    return { question: newQuestion, options: opts };
  }
  return null;
}

/* Lightweight equality for "are these two option strings basically the same":
   strip the leading number/punctuation and compare normalized text. */
function sameOptionBody(a: string, b: string): boolean {
  const strip = (s: string) => s.replace(/^[1-4１-４][．.、:：\s　]*/u, "").replace(/[\s　]+/gu, "").trim();
  return strip(a) === strip(b) && strip(a).length > 0;
}

/* When the AI returns the inline pattern AND also populates options separately,
   the options usually match. In that case strip the duplicate from question
   silently. Otherwise leave question alone (user can hit the manual split
   button if they want). */
function sanitizeQuestion(q: { question: string; options: string[] }): { question: string; options: string[] } {
  const split = splitInlineOptions(q.question);
  if (!split) return q;
  const optsClean = q.options.filter(o => o && o.trim().length > 0);
  // Auto-strip only when existing options array looks like the inline ones.
  if (optsClean.length === 4 && split.options.every((s, i) => sameOptionBody(s, optsClean[i]))) {
    return { question: split.question, options: q.options };
  }
  // Or when options array is empty/short — pull options from the question.
  if (optsClean.length < 4) {
    return { question: split.question, options: split.options };
  }
  return q;
}


const uploadStats = [
  { label: "Soal dianalisis",  value: "24",  suffix: "",   color: "var(--text-secondary)", glow: "rgba(74,122,191,0.15)"  },
  { label: "Akurasi rata-rata",value: "78%", suffix: "",   color: "var(--success)", glow: "rgba(94,168,122,0.15)" },
  { label: "Hari streak",      value: "5",   suffix: "🔥", color: "var(--primary)", glow: "rgba(224,123,74,0.15)"  },
];

const recentAnalysis = [
  { kanji: "文法", label: "N2 文法問題 #14", date: "14 Apr", color: "var(--info)" },
  { kanji: "読解", label: "N2 読解問題 #8",  date: "12 Apr", color: "var(--success)" },
  { kanji: "語彙", label: "N2 語彙問題 #22", date: "10 Apr", color: "var(--n1)" },
  { kanji: "文法", label: "N2 文法問題 #9",  date: "8 Apr",  color: "var(--primary)" },
];

const photoTips = [
  { no: 1, text: "Foto dalam pencahayaan yang terang" },
  { no: 2, text: "Pastikan teks terbaca jelas" },
  { no: 3, text: "Satu soal per foto lebih akurat" },
  { no: 4, text: "Hindari bayangan di atas teks" },
];

/* ─── Upload State ──────────────────────────────────────────── */
function UploadView({ onUpload, onCamera, onOpenResult, error }: { onUpload: () => void; onCamera: () => void; onOpenResult: () => void; error?: string | null }) {
  const hasHistory = recentAnalysis.length > 0;
  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 md:py-7 pb-20 lg:pb-7 relative">

      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute top-0 left-1/3 w-[400px] h-[300px] opacity-[0.06] blur-[70px]"
        style={{ background: "radial-gradient(circle,var(--info),transparent 70%)" }} />
      <div className="pointer-events-none absolute top-10 right-0 w-[250px] h-[250px] opacity-[0.04] blur-[60px]"
        style={{ background: "radial-gradient(circle,var(--n1),transparent 70%)" }} />

      {/* Page title */}
      <div className="mb-5 relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_var(--success)]" />
          <span className="text-[10px] tracking-widest text-[var(--success)] font-semibold"
            style={{ fontFamily: "var(--font-space)" }}>
            AI ENGINE AKTIF · ANALISIS FOTO
          </span>
        </div>
        {error && (
          <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-2xl text-sm animate-fade-in"
            style={{ background: "rgba(192,80,80,0.08)", border: "1px solid rgba(192,80,80,0.18)", backdropFilter: "blur(8px)" }}>
            <span className="text-lg shrink-0">⚠️</span>
            <div>
              <p className="font-semibold text-red-300 mb-0.5" style={{ fontFamily: "var(--font-space)", fontSize: "11px" }}>ANALISIS GAGAL</p>
              <p className="text-[var(--danger)] leading-relaxed">{error}</p>
            </div>
          </div>
        )}
        <h1 className="text-[2.4rem] font-extrabold leading-tight text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-jakarta)" }}>
          Upload Soalmu,
          <br />
          <span style={{
            background: "linear-gradient(135deg,var(--text-primary) 0%,var(--text-secondary) 50%,var(--n1) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Sensei yang Jawab.
          </span>
        </h1>
      </div>

      {/* Stats — compact inline row with color accents */}
      <div className="flex items-center gap-2 md:gap-3 mb-5 overflow-x-auto pb-1">
        {uploadStats.map(({ label, value, suffix, color, glow }) => (
          <div key={label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl relative overflow-hidden"
            style={{ background: "var(--surface)" }}>
            <div className="absolute inset-0 opacity-60"
              style={{ background: `radial-gradient(circle at left,${glow},transparent 80%)` }} />
            <p className="relative text-lg font-extrabold leading-none" style={{ color, fontFamily: "var(--font-jakarta)" }}>
              {value}{suffix && <span className="ml-1">{suffix}</span>}
            </p>
            <p className="relative text-[11px] text-[var(--text-tertiary)]" style={{ fontFamily: "var(--font-space)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Drop zone — tall focal point */}
      <button
        onClick={onUpload}
        className="group w-full rounded-2xl flex flex-col items-center justify-center gap-4 transition-all hover:brightness-110 mb-5 relative overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1.5px dashed rgba(94,168,122,0.35)",
          minHeight: "172px",
          boxShadow: "0 0 40px rgba(94,168,122,0.06) inset",
        }}
      >
        {/* ambient glow */}
        <div className="absolute inset-0 opacity-100"
          style={{ background: "radial-gradient(ellipse at 50% 120%,rgba(94,168,122,0.07),transparent 65%)" }} />
        {/* hover boost */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "radial-gradient(circle at 50% 50%,rgba(94,168,122,0.09),transparent 70%)" }} />

        <Upload className="relative size-8 text-[var(--success)] opacity-80" />

        <div className="relative text-center">
          <p className="font-bold text-[var(--text-primary)] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>
            Seret & lepas foto soal JLPT di sini
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">PNG, JPG, PDF, Word (.docx) · Maks. 10MB</p>
        </div>

        <div className="relative flex items-center gap-2">
          <span className="text-[11px] px-5 py-1.5 rounded-full font-bold text-[var(--bg)]"
            style={{ background: "linear-gradient(135deg,var(--text-primary),var(--text-secondary))", fontFamily: "var(--font-space)" }}>
            PILIH FILE
          </span>
          <span onClick={e => { e.stopPropagation(); onCamera(); }}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full font-medium text-[var(--text-secondary)] border cursor-pointer hover:text-[var(--text-primary)] hover:border-white/20 transition-colors"
            style={{ borderColor: "rgba(187,198,226,0.12)", fontFamily: "var(--font-space)" }}>
            <Camera className="size-3.5" /> KAMERA
          </span>
        </div>
      </button>

      {/* Bottom 2-col */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Riwayat analisis */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-[var(--text-tertiary)]" style={{ fontFamily: "var(--font-space)" }}>
              RIWAYAT ANALISIS TERBARU
            </p>
            <button className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              style={{ fontFamily: "var(--font-space)" }}>
              SEMUA <ArrowUpRight className="size-3" />
            </button>
          </div>
          {hasHistory ? (
            <div className="flex flex-col gap-2">
              {recentAnalysis.map(({ kanji, label, date, color }) => (
                <button key={label}
                  onClick={onOpenResult}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:brightness-110 group"
                  style={{ background: "var(--surface-2)" }}>
                  <div className="size-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                    style={{ background: `${color}20`, color, fontFamily: "var(--font-jakarta)" }}>
                    {kanji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate"
                      style={{ fontFamily: "var(--font-jakarta)" }}>{label}</p>
                  </div>
                  <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 group-hover:text-[var(--text-primary)] transition-colors"
                    style={{ fontFamily: "var(--font-space)" }}>{date}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="size-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: "var(--surface-2)" }}>📭</div>
              <p className="text-xs font-semibold text-[var(--text-tertiary)] text-center"
                style={{ fontFamily: "var(--font-jakarta)" }}>Belum ada soal yang dianalisis</p>
              <p className="text-[11px] text-[var(--text-dim)] text-center">Upload foto pertamamu di atas!</p>
            </div>
          )}
        </div>

        {/* Kolom kanan: Tips + XP Progress */}
        <div className="flex flex-col gap-4">

          {/* Tips foto */}
          <div className="rounded-2xl p-5" style={{ background: "var(--surface)" }}>
            <p className="text-xs font-bold text-[var(--text-tertiary)] mb-3" style={{ fontFamily: "var(--font-space)" }}>
              TIPS FOTO YANG BAGUS
            </p>
            <div className="grid grid-cols-2 gap-2">
              {photoTips.map(({ no, text }) => (
                <div key={no} className="rounded-xl p-3 flex flex-col gap-2"
                  style={{ background: "var(--surface-2)" }}>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded mr-1.5 text-[10px] font-bold text-[var(--bg)] align-middle"
                      style={{ background: "linear-gradient(135deg,var(--text-primary),var(--text-secondary))", fontFamily: "var(--font-space)", flexShrink: 0 }}>
                      {no}
                    </span>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* XP Progress N2 */}
          <div className="rounded-2xl p-5 relative overflow-hidden flex-1"
            style={{ background: "var(--surface)" }}>
            <div className="absolute inset-0 opacity-15"
              style={{ background: "radial-gradient(circle at top right,var(--info),transparent 65%)" }} />
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-[var(--text-tertiary)]" style={{ fontFamily: "var(--font-space)" }}>
                  PROGRES N2 KAMU
                </p>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "var(--surface-3)", color: "var(--info)", fontFamily: "var(--font-space)" }}>
                  LEVEL 4
                </span>
              </div>

              <p className="text-3xl font-extrabold text-[var(--text-primary)] mt-2 mb-0.5"
                style={{ fontFamily: "var(--font-jakarta)" }}>
                520 <span className="text-base font-semibold text-[var(--text-tertiary)]">/ 1000 XP</span>
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] mb-3">52% menuju level berikutnya</p>

              <div className="h-2 rounded-full mb-4" style={{ background: "var(--surface-2)" }}>
                <div className="h-2 rounded-full" style={{
                  width: "52%",
                  background: "linear-gradient(90deg,var(--success),var(--success))",
                  boxShadow: "0 0 10px rgba(94,168,122,0.4)",
                }} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Tata Bahasa", pct: 72, color: "var(--text-secondary)" },
                  { label: "Kosakata",    pct: 88, color: "var(--success)" },
                  { label: "Reading",     pct: 54, color: "var(--primary)" },
                ].map(({ label, pct, color }) => (
                  <div key={label} className="rounded-lg p-2.5 text-center"
                    style={{ background: "var(--surface-2)" }}>
                    <p className="text-sm font-bold mb-0.5" style={{ color, fontFamily: "var(--font-jakarta)" }}>
                      {pct}%
                    </p>
                    <p className="text-[9px] text-[var(--text-tertiary)]" style={{ fontFamily: "var(--font-space)" }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Setup State ───────────────────────────────────────────── */
function SetupView({
  onStart, onBack, files, onAddFile, onCamera, onRemoveFile,
}: {
  onStart: (level: Level, category: Category) => void;
  onBack: () => void;
  files: FileData[];
  onAddFile: () => void;
  onCamera: () => void;
  onRemoveFile: (idx: number) => void;
}) {
  const [level,    setLevel]    = useState<Level | null>(null);
  const [category, setCategory] = useState<Category | null>(null);

  const levels: Level[]       = ["N1", "N2", "N3", "N4", "N5"];
  const categories: { value: Category; label: string; sub: string }[] = [
    { value: "文法", label: "文法", sub: "Tata Bahasa" },
    { value: "語彙", label: "語彙", sub: "Kosakata" },
    { value: "文字", label: "文字", sub: "Kanji" },
    { value: "読解", label: "読解", sub: "Reading" },
    { value: "ai",   label: "🤖",  sub: "AI deteksi" },
  ];

  const canStart = level !== null && category !== null && files.length > 0;

  return (
    <div className="flex-1 flex items-center justify-center px-8 py-10 relative">
      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] blur-[80px]"
        style={{ background: "radial-gradient(circle at 40% 40%,var(--info),transparent 60%)" }} />

      <div className="relative w-full max-w-lg flex flex-col gap-6">

        {/* Back */}
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors self-start"
          style={{ fontFamily: "var(--font-space)" }}>
          <ChevronLeft className="size-3.5" /> HAPUS SEMUA & ULANG
        </button>

        {/* Photos strip — multiple thumbnails + add button */}
        <div className="p-4 rounded-2xl flex flex-col gap-3"
          style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-[var(--text-tertiary)]" style={{ fontFamily: "var(--font-space)" }}>
              FOTO SOAL
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: "rgba(107,156,218,0.15)", color: "var(--text-secondary)", fontFamily: "var(--font-space)" }}>
              {files.length} {files.some(f => f.mimeType.includes("wordprocessingml")) ? "bagian" : "foto"}
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {files.map((f, idx) => (
              <div key={idx} className="relative shrink-0 group/thumb">
                <div className="size-16 rounded-xl overflow-hidden flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,var(--surface),var(--bg))" }}>
                  {f.url
                    ? <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                    : f.mimeType.includes("wordprocessingml")
                      ? <span className="text-[10px] font-bold text-[var(--success)] text-center px-1">DOC</span>
                      : <span className="text-[10px] font-bold text-[var(--text-secondary)] text-center px-1">PDF</span>
                  }
                </div>
                <button
                  onClick={() => onRemoveFile(idx)}
                  className="absolute -top-1.5 -right-1.5 size-4.5 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                  style={{ background: "var(--danger)" }}>
                  <X className="size-2.5 text-white" />
                </button>
                <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-white/60 bg-black/40 rounded-b-xl px-1 truncate"
                  style={{ fontFamily: "var(--font-space)" }}>
                  {idx + 1}
                </span>
              </div>
            ))}
            {/* Add more button */}
            <button
              onClick={onAddFile}
              className="size-16 rounded-xl shrink-0 flex flex-col items-center justify-center gap-1 transition-all hover:brightness-110"
              style={{ background: "var(--surface-2)", border: "1.5px dashed rgba(107,156,218,0.3)" }}>
              <span className="text-lg text-[var(--text-tertiary)]">+</span>
              <span className="text-[8px] text-[var(--text-tertiary)]" style={{ fontFamily: "var(--font-space)" }}>TAMBAH</span>
            </button>
            {/* Camera button */}
            <button
              onClick={onCamera}
              className="size-16 rounded-xl shrink-0 flex flex-col items-center justify-center gap-1 transition-all hover:brightness-110"
              style={{ background: "var(--surface-2)", border: "1.5px dashed rgba(107,156,218,0.2)" }}>
              <Camera className="size-5 text-[var(--text-tertiary)]" />
              <span className="text-[8px] text-[var(--text-tertiary)]" style={{ fontFamily: "var(--font-space)" }}>KAMERA</span>
            </button>
          </div>
          <p className="text-[11px] text-[var(--success)]" style={{ fontFamily: "var(--font-manrope)" }}>
            <Check className="size-3 inline mr-1" />
            {files.length === 1
              ? `${files[0].name} berhasil diunggah`
              : files.some(f => f.mimeType.includes("wordprocessingml"))
                ? `Dokumen dibagi menjadi ${files.length} bagian — setiap bagian dianalisis terpisah`
                : `${files.length} foto siap dianalisis bersama`}
          </p>
        </div>

        {/* Level */}
        <div>
          <p className="text-xs font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: "var(--font-space)" }}>
            INI SOAL LEVEL BERAPA?
          </p>
          <div className="flex gap-2">
            {levels.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                style={level === l
                  ? { background: "linear-gradient(135deg,var(--surface-2),var(--surface-3))", color: "var(--text-primary)", border: "1px solid rgba(107,156,218,0.4)" }
                  : { background: "var(--surface)", color: "var(--text-tertiary)", border: "1px solid rgba(255,255,255,0.04)" }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <p className="text-xs font-bold text-[var(--text-primary)] mb-1"
            style={{ fontFamily: "var(--font-space)" }}>
            KATEGORI SOALNYA APA?
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)] mb-3">
            Kalau tidak tahu, pilih &ldquo;AI deteksi&rdquo; — Sensei yang akan tentukan sendiri.
          </p>
          <div className="flex gap-2">
            {categories.map(({ value, label, sub }) => (
              <button key={value} onClick={() => setCategory(value)}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all"
                style={category === value
                  ? { background: value === "ai" ? "rgba(166,123,212,0.15)" : "rgba(107,156,218,0.12)", color: value === "ai" ? "var(--n1)" : "var(--text-secondary)", border: `1px solid ${value === "ai" ? "rgba(166,123,212,0.4)" : "rgba(107,156,218,0.35)"}` }
                  : { background: "var(--surface)", color: "var(--text-tertiary)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-base font-black"
                  style={{ fontFamily: "var(--font-jakarta)" }}>{label}</span>
                <span className="text-[9px]" style={{ fontFamily: "var(--font-space)" }}>{sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => canStart && onStart(level!, category!)}
          disabled={!canStart}
          className="w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
          style={canStart
            ? { background: "linear-gradient(135deg,var(--surface-2),var(--surface-3))", color: "var(--text-primary)", boxShadow: "0 0 20px rgba(74,122,191,0.25)" }
            : { background: "var(--surface)", color: "var(--text-dim)", cursor: "not-allowed" }}>
          <Sparkles className="size-4" />
          {canStart
            ? `Analisis Soal ${level} · ${category === "ai" ? "AI Deteksi Kategori" : category}`
            : "Pilih level dan kategori dulu"}
        </button>

      </div>
    </div>
  );
}

/* ─── Analyzing State ───────────────────────────────────────── */
const waitingMessages = [
  { icon: "📖", text: "Nih sambil nunggu, ulang hafalan kosakata kamu yang ada di kiri! Itu kata-kata dari kamus kamu sendiri lho." },
  { icon: "☕", text: "Santai dulu, ini emang butuh waktu. Soalnya lagi dibedah satu per satu sama Sensei." },
  { icon: "📚", text: "Banyak soal = analisis makin panjang. Tapi hasilnya juga makin lengkap, janji!" },
  { icon: "🎴", text: "Sambil nunggu, review hafalan kamu di kiri yuk — kata-kata itu dari kamus yang udah kamu kumpulin!" },
  { icon: "🤖", text: "AI lagi nulis penjelasan detail tiap soal — ini yang bikin lama, tapi bermanfaat banget." },
  { icon: "💪", text: "Sabar adalah kunci belajar JLPT. Latihan terus, pasti tembus! Sambil tunggu, hafal dulu." },
  { icon: "🐢", text: "Pelan tapi pasti — persis kayak kamu belajar kanji. Manfaatin waktu ini buat review vocab!" },
  { icon: "🎯", text: "Klik NEXT di kartu kiri buat ganti kata. Itu semua dari kamus kamu — gratis ulangan!" },
];

function AnalyzingView({ imageUrl, currentIdx = 1, total = 1, onCancel }: { imageUrl?: string; currentIdx?: number; total?: number; onCancel?: () => void }) {
  const [stepsDone, setStepsDone] = useState(1);
  const [elapsed,   setElapsed]   = useState(0);
  const [msgIdx,    setMsgIdx]    = useState(0);

  /* Animate steps finishing over time */
  useEffect(() => {
    const t  = setTimeout(() => setStepsDone(2), 4000);
    const t2 = setTimeout(() => setStepsDone(3), 9000);
    const t3 = setTimeout(() => setStepsDone(4), 14000);
    return () => { clearTimeout(t); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  /* Timer: count up every second */
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* Rotate patience message every 18 s */
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % waitingMessages.length), 18000);
    return () => clearInterval(t);
  }, []);

  const steps = [
    "Membaca teks soal...",
    "Mendeteksi level JLPT...",
    "Menyusun penjelasan detail...",
    "Deteksi Multi-Soal...",
  ];

  const fakeProgress = [15, 35, 65, 90][Math.min(stepsDone, 3)];
  const mm  = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss  = String(elapsed % 60).padStart(2, "0");
  const msg = waitingMessages[msgIdx];

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">

      {/* ── Top/Left: image preview + flashcard ── */}
      <div className="flex-1 flex flex-col items-center justify-start gap-5 p-4 md:p-8 relative overflow-hidden lg:overflow-visible">
        {/* ambient */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] opacity-[0.04] blur-[80px]"
          style={{ background: "radial-gradient(circle,var(--info),transparent 70%)" }} />

        {/* Image preview — real uploaded photo */}
        <div className="w-full max-w-[260px] aspect-[3/4] rounded-2xl relative overflow-hidden shrink-0"
          style={{ background: "linear-gradient(135deg,var(--surface),var(--bg))" }}>
          {imageUrl
            ? <img src={imageUrl} alt="soal" className="w-full h-full object-cover" />
            : (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-7xl font-black text-white/5"
                    style={{ fontFamily: "var(--font-jakarta)" }}>僕は</span>
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="absolute w-3/4 h-px mx-auto left-0 right-0"
                    style={{ top: `${20 + i * 10}%`, background: "rgba(187,198,226,0.05)" }} />
                ))}
              </>
            )
          }
          {/* scan line overlay */}
          <div className="analyzing-scan-line" />
        </div>

        {/* ── Kamus Flashcard ── */}
        <div className="w-full max-w-[340px]">
          <KamusFlashCard />
        </div>
      </div>

      {/* ── Bottom/Right: progress panel ── */}
      <div className="w-full lg:w-[360px] shrink-0 flex flex-col justify-center gap-7 px-4 md:px-8 py-6 md:py-10 lg:border-l"
        style={{ borderColor: "rgba(255,255,255,0.04)" }}>

        {/* heading */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_var(--success)]" />
            <span className="text-[11px] text-[var(--success)] font-semibold"
              style={{ fontFamily: "var(--font-space)" }}>AI ENGINE AKTIF</span>
            {total > 1 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: "rgba(107,156,218,0.15)", color: "var(--text-secondary)", fontFamily: "var(--font-space)" }}>
                FOTO {currentIdx}/{total}
              </span>
            )}
          </div>
          <h2 className="text-[1.7rem] font-extrabold text-[var(--text-primary)] leading-tight"
            style={{ fontFamily: "var(--font-jakarta)" }}>
            {total > 1 ? `Foto ${currentIdx} dari ${total}` : "Sensei sedang"}
            <br />
            <span style={{
              background: "linear-gradient(135deg,var(--text-primary),var(--text-secondary))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              menganalisis...
            </span>
          </h2>
        </div>

        {/* Timer + kata counter */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "var(--surface)" }}>
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--text-tertiary)]" style={{ fontFamily: "var(--font-space)" }}>WAKTU BERJALAN</span>
            <span className="text-2xl font-black tabular-nums"
              style={{ fontFamily: "var(--font-space)", color: elapsed > 60 ? "var(--primary)" : "var(--text-secondary)" }}>
              {mm}:{ss}
            </span>
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span className="text-[10px] text-[var(--text-tertiary)]" style={{ fontFamily: "var(--font-space)" }}>FOTO</span>
            <span className="text-2xl font-black text-[var(--text-secondary)]"
              style={{ fontFamily: "var(--font-space)" }}>
              {currentIdx}/{total}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-[11px] mb-2"
            style={{ fontFamily: "var(--font-space)" }}>
            <span className="text-[var(--text-tertiary)]">Status Pemrosesan</span>
            <span className="text-[var(--text-primary)] font-semibold">{Math.round(fakeProgress)}%</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
            <div className="h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${fakeProgress}%`, background: "linear-gradient(90deg,var(--info),var(--text-primary))" }} />
          </div>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3">
          {steps.map((label, i) => {
            const done = i < stepsDone;
            const active = i === stepsDone;
            return (
              <div key={i} className="flex items-center gap-3">
                {done
                  ? <CheckCircle2 className="size-4 text-[var(--success)] shrink-0" />
                  : active
                    ? <Loader2 className="size-4 text-[var(--info)] shrink-0 animate-spin" />
                    : <Circle className="size-4 text-[var(--text-dim)] shrink-0" />}
                <span className={`text-sm ${done ? "text-[var(--text-primary)]" : active ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]"}`}
                  style={{ fontFamily: "var(--font-manrope)" }}>
                  {label}
                </span>
                {active && (
                  <span className="ml-auto text-[10px] text-[var(--info)] animate-pulse"
                    style={{ fontFamily: "var(--font-space)" }}>
                    PROSES...
                  </span>
                )}
              </div>
            );
          })}

          {/* rotating patience message */}
          <div className="mt-1 rounded-xl p-3 transition-all duration-500"
            style={{ background: "var(--surface-2)", border: "1px solid rgba(107,156,218,0.08)" }}>
            <p className="text-base mb-1">{msg.icon}</p>
            <p className="text-[12px] text-[var(--text-primary)] leading-relaxed"
              style={{ fontFamily: "var(--font-manrope)" }}>
              {msg.text}
            </p>
            <div className="flex gap-1 mt-2.5">
              {waitingMessages.map((_, i) => (
                <div key={i} className="h-0.5 flex-1 rounded-full transition-all duration-300"
                  style={{ background: i === msgIdx ? "var(--text-secondary)" : "rgba(255,255,255,0.06)" }} />
              ))}
            </div>
          </div>

          {onCancel && (
            <button onClick={onCancel}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
              style={{ background: "rgba(220,80,80,0.1)", color: "var(--danger)", border: "1px solid rgba(220,80,80,0.2)", fontFamily: "var(--font-space)" }}>
              <X className="size-3.5" /> BATAL ANALISIS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Result State ──────────────────────────────────────────── */
function ResultView({ onReset, result, setResult, chatMsgs, setChatMsgs, isSaved, sessionId, isReview, sessionLevel, sessionCategory }: {
  onReset: () => void;
  result: AIResult;
  setResult: React.Dispatch<React.SetStateAction<AIResult | null>>;
  chatMsgs: ChatMsg[];
  setChatMsgs: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  isSaved: boolean;
  sessionId: string | null;
  isReview?: boolean;
  sessionLevel?: Level | null;
  sessionCategory?: Category | null;
}) {
  const [answers,      setAnswers]      = useState<Record<number, string>>(
    () => result.user_progress?.answers ?? {}
  );
  const [revealed,     setRevealed]     = useState<Set<number>>(
    () => new Set(result.user_progress?.revealed ?? [])
  );

  /* Exit confirmation — kalau user udah jawab/reveal minimal 1 soal,
     intercept browser exit + in-app navigation buat tanya "yakin keluar?".
     Data udah auto-saved di DB, ini pure UX safety net. */
  const hasProgress = revealed.size > 0 || Object.keys(answers).length > 0;
  useEffect(() => {
    if (!hasProgress) return;

    // Browser back / close / refresh — native dialog
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    // In-app NavRail / Link click interceptor — intercept anchor click bubbling up to document
    const onDocClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      // Skip external, hash, dan link ke halaman yang sama
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      const currentPath = window.location.pathname + window.location.search;
      if (href === currentPath || href === window.location.pathname) return;
      // Skip kalau user pakai modifier key (ctrl-click buka tab baru — gak ngubah halaman ini)
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;

      const ok = window.confirm("Progress kamu udah otomatis ke-save di Riwayat. Yakin mau keluar dari sesi ini?");
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onDocClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocClick, true);
    };
  }, [hasProgress]);
  const [catFilter,    setCatFilter]    = useState<string>("全部");
  const [reviewOnly,   setReviewOnly]   = useState(false);
  const [editIdx,      setEditIdx]      = useState<number | null>(null);
  const [editDraft,    setEditDraft]    = useState<AIQuestion | null>(null);
  const [editSaving,   setEditSaving]   = useState(false);
  const [savingFlagIdx, setSavingFlagIdx] = useState<number | null>(null);
  const [expandedPassages, setExpandedPassages] = useState<Set<number>>(new Set());
  const [furiganaMarked,   setFuriganaMarked]   = useState<Record<string, string>>({});
  const [showFurigana,     setShowFurigana]     = useState<Set<string>>(new Set());
  const [furiganaLoading,  setFuriganaLoading]  = useState<Set<string>>(new Set());
  const [chatInput,    setChatInput]    = useState("");
  const [chatLoading,  setChatLoading]  = useState(false);
  const [elapsed,      setElapsed]      = useState(0);
  const [timerOn,      setTimerOn]      = useState(true);
  const [savedWords,   setSavedWords]   = useState<Set<string>>(new Set());
  const [savingWord,   setSavingWord]   = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ text: string; ok: boolean } | null>(null);
  const [scoreSaved,   setScoreSaved]   = useState(false);
  const [savedNotes,   setSavedNotes]   = useState<Set<number>>(new Set());
  const [savingNote,   setSavingNote]   = useState<number | null>(null);
  const [rightTab,     setRightTab]     = useState<"chat"|"kamus"|"catatan">("chat");
  const [kamusWords,   setKamusWords]   = useState<{id:string;kanji:string;reading:string|null;meaning:string;favorite:boolean}[]>([]);
  const [kamusQuery,   setKamusQuery]   = useState("");
  const [kamusLoaded,  setKamusLoaded]  = useState(false);
  const [catatanList,  setCatatanList]  = useState<{id:string;judul:string;isi:string;updated_at:string}[]>([]);
  const [catatanLoaded,setCatatanLoaded]= useState(false);
  const [expandedNote, setExpandedNote] = useState<string|null>(null);
  const [newNoteOpen,  setNewNoteOpen]  = useState(false);
  const [newNoteText,  setNewNoteText]  = useState("");
  const [savingNewNote,setSavingNewNote]= useState(false);
  const [addKanji,     setAddKanji]     = useState("");
  const [addReading,   setAddReading]   = useState("");
  const [addMeaning,   setAddMeaning]   = useState("");
  const [generating,   setGenerating]   = useState(false);
  const [savingNew,    setSavingNew]    = useState(false);

  /* ── Persist & edit helpers (Phase 1) ── */
  const persistResultJsonb = async (next: AIResult) => {
    if (!sessionId) return;
    const supabase = createClient();
    await supabase.from("sessions").update({ ai_result: next }).eq("id", sessionId);
  };

  const updateQuestionAt = (qi: number, patch: Partial<AIQuestion>) => {
    const next: AIResult = {
      ...result,
      questions: result.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)),
    };
    setResult(next);
    // Fire-and-forget persistence; UI already updated optimistically.
    persistResultJsonb(next).catch(() => { /* swallow */ });
  };

  const toggleReviewFlag = async (qi: number) => {
    if (savingFlagIdx !== null) return;
    setSavingFlagIdx(qi);
    try {
      const flipped = !result.questions[qi].needs_review;
      updateQuestionAt(qi, { needs_review: flipped });
    } finally {
      setSavingFlagIdx(null);
    }
  };

  const openEdit = (qi: number) => {
    setEditIdx(qi);
    setEditDraft({ ...result.questions[qi] });
  };

  const closeEdit = () => {
    setEditIdx(null);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (editIdx === null || !editDraft || editSaving) return;
    setEditSaving(true);
    try {
      const isNew = editIdx >= result.questions.length;
      const next: AIResult = {
        ...result,
        questions: isNew
          ? [...result.questions, editDraft]
          : result.questions.map((q, i) => (i === editIdx ? editDraft : q)),
      };
      setResult(next);
      persistResultJsonb(next).catch(() => { /* swallow */ });
      closeEdit();
    } finally {
      setEditSaving(false);
    }
  };

  /* Open the modal with a blank draft → manual-add new question */
  const openAddManual = () => {
    setEditIdx(result.questions.length);
    setEditDraft({
      question: "",
      options: ["1. ", "2. ", "3. ", "4. "],
      correct: "1",
      explanation: "",
      why_wrong: "",
      tip: "",
      category: "文法",
    });
  };

  /* Re-photo: upload a new image, send to /api/analisis with the session's
     level/category, append returned questions to current session. */
  const addPhotoRef = useRef<HTMLInputElement>(null);
  const [addingPhoto, setAddingPhoto] = useState(false);

  /* Ensure we know the session level/category — re-fetch lazily if state is empty
     (happens for sessions loaded before this feature shipped, or via a stale tab). */
  const ensureSessionMeta = async (): Promise<{ level: Level; category: Category } | null> => {
    if (sessionLevel) return { level: sessionLevel, category: sessionCategory ?? "ai" };
    if (!sessionId) return null;
    const supabase = createClient();
    const { data } = await supabase
      .from("sessions")
      .select("level, category")
      .eq("id", sessionId)
      .single();
    if (!data?.level) return null;
    return {
      level: data.level as Level,
      category: ((data.category === "AI" ? "ai" : data.category) ?? "ai") as Category,
    };
  };

  const handleAddFromPhoto = async (file: File) => {
    setAddingPhoto(true);
    try {
      const meta = await ensureSessionMeta();
      if (!meta) {
        setToast({ text: "Level sesi nggak ketahuan. Save sesi dulu lalu coba lagi.", ok: false });
        setTimeout(() => setToast(null), 2500);
        return;
      }

      // Dispatch by file type so each format is sent the way /api/analisis expects.
      const isDocx = file.name.toLowerCase().endsWith(".docx") ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isPdf  = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      let body: Record<string, unknown>;
      if (isDocx) {
        const mammoth = (await import("mammoth")).default;
        const buf = await file.arrayBuffer();
        const ext = await mammoth.extractRawText({ arrayBuffer: buf });
        if (!ext.value.trim()) throw new Error("Dokumen Word kosong / tidak ada teks");
        body = {
          textContent: ext.value,
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          level: meta.level,
          category: meta.category,
        };
      } else {
        const reader = new FileReader();
        const base64: string = await new Promise((resolve, reject) => {
          reader.onload  = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = () => reject(new Error("Gagal baca file"));
          reader.readAsDataURL(file);
        });
        body = {
          imageBase64: base64,
          mimeType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
          level: meta.level,
          category: meta.category,
        };
      }

      const res = await fetch("/api/analisis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analisis gagal");

      const data: AIResult = json.data;
      const newQs = (data.questions ?? []).map(q => ({ ...q, ...sanitizeQuestion(q) }));
      if (newQs.length === 0) {
        setToast({ text: "Nggak ada soal yang ke-detect di file", ok: false });
        setTimeout(() => setToast(null), 2000);
        return;
      }

      // Merge: append questions, dedupe vocab by word.
      const mergedVocab = Array.from(
        new Map([...(result.vocabulary ?? []), ...(data.vocabulary ?? [])].map(v => [v.word, v])).values(),
      );
      const next: AIResult = {
        ...result,
        vocabulary: mergedVocab,
        questions: [...result.questions, ...newQs],
      };
      setResult(next);
      persistResultJsonb(next).catch(() => { /* swallow */ });
      setToast({ text: `+${newQs.length} soal ditambah`, ok: true });
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal tambah dari file";
      setToast({ text: msg, ok: false });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setAddingPhoto(false);
    }
  };

  const onAddPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleAddFromPhoto(file);
    e.target.value = "";
  };

  /* Copy text to clipboard, with toast confirmation */
  const copyToClipboard = async (text: string, label = "Tersalin!") => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ text: label, ok: true });
      setTimeout(() => setToast(null), 1500);
    } catch {
      setToast({ text: "Gagal menyalin", ok: false });
      setTimeout(() => setToast(null), 1500);
    }
  };

  /* Toggle furigana for all 4 options of a question at once */
  const toggleAllOptions = async (qi: number, opts: string[]) => {
    const keys = opts.map((_, oi) => `o-${qi}-${oi}`);
    const allShowing = keys.every(k => showFurigana.has(k));
    if (allShowing) {
      setShowFurigana(s => {
        const n = new Set(s);
        keys.forEach(k => n.delete(k));
        return n;
      });
    } else {
      // Toggle each option that's not already showing (in parallel).
      await Promise.all(
        opts.map((opt, oi) => {
          const k = `o-${qi}-${oi}`;
          if (!showFurigana.has(k)) return toggleFurigana(k, opt.slice(2).trim());
          return Promise.resolve();
        }),
      );
    }
  };

  /* Delete a question from the session (with confirm) */
  const deleteQuestion = async (qi: number) => {
    if (!confirm(`Hapus soal #${qi + 1}? Aksi ini permanen.`)) return;
    const next: AIResult = {
      ...result,
      questions: result.questions.filter((_, i) => i !== qi),
    };
    setResult(next);
    persistResultJsonb(next).catch(() => { /* swallow */ });
    setToast({ text: "Soal dihapus", ok: true });
    setTimeout(() => setToast(null), 1500);
  };

  const generateWordInfo = async () => {
    if (!addKanji.trim() || generating) return;
    setGenerating(true);
    setAddReading(""); setAddMeaning("");
    try {
      const res = await fetch("/api/furigana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: addKanji.trim(), withMeaning: true }),
      });
      const json = await res.json();
      setAddReading(json.reading ?? "");
      setAddMeaning(json.meaning ?? "");
    } catch { /* ignore */ }
    finally { setGenerating(false); }
  };

  /* Toggle furigana for any Japanese text; fetches & caches on first show.
     `key` lets callers namespace e.g. "p-0" (passage 0) vs "q-0" (question 0). */
  const toggleFurigana = async (key: string, text: string) => {
    if (showFurigana.has(key)) {
      setShowFurigana(s => { const n = new Set(s); n.delete(key); return n; });
      return;
    }
    if (furiganaMarked[key]) {
      setShowFurigana(s => new Set(s).add(key));
      return;
    }
    setFuriganaLoading(s => new Set(s).add(key));
    try {
      const res = await fetch("/api/furigana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage: text }),
      });
      const json = await res.json();
      if (json.marked) {
        setFuriganaMarked(m => ({ ...m, [key]: json.marked }));
        setShowFurigana(s => new Set(s).add(key));
      }
    } catch { /* ignore */ }
    finally {
      setFuriganaLoading(s => { const n = new Set(s); n.delete(key); return n; });
    }
  };

  /* Render a passage string with optional [[KANJI|FURIGANA]] markup as <ruby> tags */
  const renderPassage = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;
    let last = 0, m: RegExpExecArray | null, key = 0;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) parts.push(<span key={key++}>{text.slice(last, m.index)}</span>);
      parts.push(
        <ruby key={key++} style={{ rubyAlign: "center" }}>
          {m[1]}
          <rt style={{ color: "var(--info)", fontSize: "0.55em", fontWeight: 500, letterSpacing: 0 }}>{m[2]}</rt>
        </ruby>
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
    return parts;
  };

  const saveNewWord = async () => {
    if (!addKanji.trim() || !addMeaning.trim() || savingNew) return;
    setSavingNew(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showToast("Login dulu", false); return; }
      const { data, error } = await supabase.from("saved_words").insert({
        user_id: user.id,
        kanji: addKanji.trim(),
        reading: addReading.trim() || null,
        meaning: addMeaning.trim(),
      }).select("id, kanji, reading, meaning").single();
      if (error && error.code !== "23505") throw error;
      if (data) setKamusWords(prev => [{ ...(data as {id:string;kanji:string;reading:string|null;meaning:string}), favorite: false }, ...prev]);
      setSavedWords(s => new Set([...s, addKanji.trim()]));
      setAddKanji(""); setAddReading(""); setAddMeaning("");
      showToast(`${addKanji} disimpan ke Kamus ✓`, true);
    } catch (err) {
      showToast(`Gagal: ${err instanceof Error ? err.message : (err as {message?:string})?.message ?? JSON.stringify(err)}`, false);
    } finally { setSavingNew(false); }
  };

  const addNewNote = async () => {
    if (!newNoteText.trim() || savingNewNote) return;
    setSavingNewNote(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showToast("Login dulu", false); return; }
      const { data, error } = await supabase.from("catatan").insert({
        user_id: user.id,
        judul: newNoteText.trim().split("\n")[0].slice(0, 60) || "Catatan",
        isi: newNoteText.trim(),
        source: result.title,
      }).select("id, judul, isi, updated_at").single();
      if (error) throw error;
      setCatatanList(prev => [data as {id:string;judul:string;isi:string;updated_at:string}, ...prev]);
      setNewNoteText("");
      setNewNoteOpen(false);
      showToast("Catatan disimpan ✓", true);
    } catch (err) {
      showToast(`Gagal: ${err instanceof Error ? err.message : (err as {message?:string})?.message ?? JSON.stringify(err)}`, false);
    } finally { setSavingNewNote(false); }
  };

  useEffect(() => {
    if (rightTab !== "catatan" || catatanLoaded) return;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("catatan")
        .select("id, judul, isi, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      setCatatanList((data ?? []) as {id:string;judul:string;isi:string;updated_at:string}[]);
      setCatatanLoaded(true);
    })();
  }, [rightTab, catatanLoaded]);

  useEffect(() => {
    if (rightTab !== "kamus" || kamusLoaded) return;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Graceful: kolom `favorite` mungkin belum di-migrate di project lama
      const primary = await supabase
        .from("saved_words")
        .select("id, kanji, reading, meaning, favorite")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (primary.error && /column .*favorite.* does not exist/i.test(primary.error.message)) {
        const fb = await supabase
          .from("saved_words")
          .select("id, kanji, reading, meaning")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setKamusWords((fb.data ?? []).map(w => ({ ...w, favorite: false })) as typeof kamusWords);
      } else {
        setKamusWords((primary.data ?? []).map(w => ({ ...w, favorite: w.favorite ?? false })) as typeof kamusWords);
      }
      setKamusLoaded(true);
    })();
  }, [rightTab, kamusLoaded]);

  /* Auto-save: tiap user jawab/reveal, debounce 600ms, persist user_progress
     + sessions.score continuous biar statistik kebaca + resume jalan. */
  useEffect(() => {
    if (!sessionId || isReview) return;
    if (revealed.size === 0 && Object.keys(answers).length === 0) return;

    const handle = setTimeout(async () => {
      try {
        const correctCount = result.questions.filter((q, qi) => {
          if (!revealed.has(qi)) return false;
          const userAns = answers[qi];
          return userAns && userAns === q.correct;
        }).length;

        const nextProgress: UserProgress = {
          answers,
          revealed: Array.from(revealed),
          xp_claimed: scoreSaved,
        };
        const nextResult: AIResult = { ...result, user_progress: nextProgress };

        const supabase = createClient();
        await supabase
          .from("sessions")
          .update({ ai_result: nextResult, score: correctCount })
          .eq("id", sessionId);
      } catch {
        // silent — UI tetap responsif walau save gagal
      }
    }, 600);

    return () => clearTimeout(handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, revealed, sessionId, isReview]);

  /* XP gain — sekali aja per sesi, pas semua soal ke-reveal. xp_claimed
     dipersist di ai_result.user_progress biar refresh gak double-award. */
  useEffect(() => {
    const total = result.questions.length;
    if (revealed.size < total || scoreSaved || !sessionId || isReview) return;
    if (result.user_progress?.xp_claimed) {
      setScoreSaved(true);
      return;
    }

    async function awardXp() {
      const correctCount = result.questions.filter((q, qi) => {
        const userAns = answers[qi];
        return userAns && userAns === q.correct;
      }).length;
      const xpGain = correctCount * 10 + 5;

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles").select("xp").eq("id", user.id).single();
        const currentXp = profile?.xp ?? 0;

        await supabase.from("profiles")
          .update({ xp: currentXp + xpGain })
          .eq("id", user.id);

        setScoreSaved(true);
        setToast({ text: `+${xpGain} XP — ${correctCount}/${total} benar`, ok: true });
        setTimeout(() => setToast(null), 3000);
      } catch {
        // silent
      }
    }

    awardXp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed.size, scoreSaved, sessionId, isReview]);

  /* Timer — hanya jalan saat timerOn = true */
  useEffect(() => {
    if (!timerOn) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerOn]);

  const saveNoteToCatatan = async (qi: number, q: AIResult["questions"][number]) => {
    if (savedNotes.has(qi) || savingNote === qi) return;
    setSavingNote(qi);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showToast("Login dulu", false); return; }
      const judul = q.question.slice(0, 60);
      const isi = `❓ ${q.question}\n\n✅ Jawaban: Pilihan ${q.correct}\n\n💡 ${q.explanation}${q.why_wrong ? `\n\n❌ ${q.why_wrong}` : ""}${q.tip ? `\n\n🎯 ${q.tip}` : ""}`;
      const { error } = await supabase.from("catatan").insert({
        user_id: user.id,
        judul,
        isi,
        source: result.title,
      });
      if (error) throw error;
      setSavedNotes(prev => new Set([...prev, qi]));
      setCatatanList(prev => [{ id: `temp-${Date.now()}-${qi}`, judul, isi, updated_at: new Date().toISOString() }, ...prev]);
      showToast("Disimpan ke Catatan ✓", true);
    } catch (err) {
      showToast(`Gagal: ${err instanceof Error ? err.message : (err as {message?:string})?.message ?? JSON.stringify(err)}`, false);
    } finally { setSavingNote(null); }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  /* Highlight blanks like （　）（　　）in question text */
  const renderQuestion = (text: string, accent: string) => {
    const parts = text.split(/(（[　\u3000 ]+）|\( *\))/g);
    return parts.map((part, i) => {
      if (/^（[　\u3000 ]+）$/.test(part) || /^\( *\)$/.test(part)) {
        return (
          <span key={i}
            className="inline-block mx-1 px-4 py-0.5 rounded-lg font-black align-baseline"
            style={{
              color: accent,
              background: `${accent}18`,
              border: `1.5px solid ${accent}`,
              borderBottom: `3px solid ${accent}`,
              minWidth: "3.5rem",
              textAlign: "center",
              letterSpacing: "0.1em",
            }}>
            ＿＿
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const showToast = (text: string, ok: boolean) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const saveWord = async (jp: string, meaning: string) => {
    if (savedWords.has(jp) || savingWord === jp) return;
    setSavingWord(jp);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showToast("Login dulu untuk simpan kata", false); return; }
      let reading: string | null = null;
      try {
        const r = await fetch("/api/furigana", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: jp }),
        });
        const rj = await r.json();
        if (rj.reading) reading = rj.reading;
      } catch { /* furigana optional */ }

      const { data: inserted, error } = await supabase.from("saved_words").insert({
        user_id: user.id,
        kanji: jp,
        reading,
        meaning,
      }).select("id, kanji, reading, meaning").single();
      if (error && error.code !== "23505") throw error;
      setSavedWords(s => new Set([...s, jp]));
      setKamusWords(prev => {
        if (prev.find(w => w.kanji === jp)) return prev;
        const base = inserted ?? { id: `local-${jp}`, kanji: jp, reading, meaning };
        return [{ ...(base as {id:string;kanji:string;reading:string|null;meaning:string}), favorite: false }, ...prev];
      });
      showToast(`${jp} ditambahkan ke Kamus ✓`, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Gagal: ${msg}`, false);
    } finally {
      setSavingWord(null);
    }
  };

  const pick = (qi: number, id: string) => {
    if (revealed.has(qi)) return;
    setAnswers(a => ({ ...a, [qi]: id }));
  };
  const reveal = (qi: number) => setRevealed(r => new Set([...r, qi]));

  /* Toggle favorite di kamus sidebar — nyambung ke saved_words.favorite
     yang dipakai /kamus page. Klik bintang = same effect as star di /kamus. */
  const toggleKamusFavorite = async (id: string) => {
    const w = kamusWords.find(x => x.id === id);
    if (!w) return;
    const next = !w.favorite;
    setKamusWords(prev => prev.map(x => x.id === id ? { ...x, favorite: next } : x));
    try {
      const { error } = await createClient().from("saved_words").update({ favorite: next }).eq("id", id);
      if (error) throw error;
    } catch {
      setKamusWords(prev => prev.map(x => x.id === id ? { ...x, favorite: !next } : x));
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    const newMsgs: ChatMsg[] = [...chatMsgs, { role: "user", text: msg }];
    setChatMsgs(newMsgs);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context: result,
          history: chatMsgs.map(m => ({ role: m.role, text: m.text })),
        }),
      });
      const json = await res.json();
      setChatMsgs([...newMsgs, { role: "model", text: json.reply || "Maaf, gagal membalas." }]);
    } catch {
      setChatMsgs([...newMsgs, { role: "model", text: "Maaf, terjadi kesalahan. Coba lagi." }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="af-grid" style={{ position: "relative" }}>

      {/* Toast notification */}
      {toast && (
        <div className={`af-toast ${toast.ok ? "ok" : "bad"}`}>
          {toast.ok ? <BookmarkCheck className="size-4 shrink-0" /> : <X className="size-4 shrink-0" />}
          {toast.text}
        </div>
      )}

      {/* ── Left: All Questions ── */}
      <main className="af-main">

        {/* Topbar v2 */}
        <header className="af-topbar">
          <div className="af-title-block">
            <h1 className="af-title">
              <span className="af-title-jp">{result.title}</span>
            </h1>
            <div className="af-meta-row">
              <span className="meta-chip">
                <span className="meta-num">{result.questions.length}</span> soal
              </span>
              {revealed.size > 0 && (
                <span className="meta-chip">
                  <span className="meta-dot" style={{ background: "var(--accent-emerald)" }} />
                  <span className="meta-num">{revealed.size}</span> dijawab
                </span>
              )}
              {isSaved && (
                <a href="/riwayat-soal" className="meta-chip status-saved">
                  <Check className="size-3" />
                  Tersimpan otomatis · <span className="meta-link">Lihat riwayat →</span>
                </a>
              )}
              {!isSaved && (
                <span className="meta-chip">
                  <Loader2 className="size-3 animate-spin" /> Menyimpan...
                </span>
              )}
            </div>
          </div>

          <div className="af-actions">
            <div className="af-timer">
              <Clock size={13} strokeWidth={2} />
              <span className="af-timer-val">{timerOn ? formatTime(elapsed) : "—:——"}</span>
              <button
                type="button"
                onClick={() => setTimerOn(v => !v)}
                className={`af-timer-status${timerOn ? "" : " off"}`}
                style={{ cursor: "pointer", border: "none" }}
              >
                {timerOn ? "ON" : "OFF"}
              </button>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>
              <Upload size={14} /> Upload Baru
            </button>
          </div>
        </header>

        {/* Category + review filters v2 */}
        {(() => {
          const cats = ["全部", ...Array.from(new Set(result.questions.map(q => q.category).filter(Boolean)))];
          const reviewCount = result.questions.filter(q => q.needs_review).length;
          const hasCatFilter = cats.length > 2;
          if (!hasCatFilter && reviewCount === 0) return null;
          return (
            <div className="af-filter-row">
              {hasCatFilter && cats.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`af-filter-chip${catFilter === c ? " on" : ""}`}
                  onClick={() => setCatFilter(c!)}
                >
                  {c} {c !== "全部" && `(${result.questions.filter(q => q.category === c).length})`}
                </button>
              ))}
              {reviewCount > 0 && (
                <button
                  type="button"
                  className={`af-filter-chip review${reviewOnly ? " on" : ""}`}
                  onClick={() => setReviewOnly(v => !v)}
                >
                  <Flag size={12} strokeWidth={1.8} />
                  {reviewOnly ? "Tampilkan semua" : `Perlu review (${reviewCount})`}
                </button>
              )}
            </div>
          );
        })()}

        {/* Questions list */}
        <div className="flex flex-col gap-5 md:gap-6 px-4 md:px-8 py-5 md:py-6">
          {(() => {
            let lastPassageText = "";
            let passageCardIdx = -1;
            return result.questions.map((q, qi) => {
              if (catFilter !== "全部" && q.category && q.category !== catFilter) return null;
              if (reviewOnly && !q.needs_review) return null;
              const isRevealed = revealed.has(qi);
              const userAns = answers[qi];
              const accentColors = ["var(--info)","var(--n1)","var(--success)","var(--warning)","var(--n1)","var(--info)","var(--info)","var(--info)"];
              const accent = accentColors[qi % accentColors.length];

              // New passage encountered → show passage card before this question
              const showPassageCard = !!(q.passage && q.passage !== lastPassageText);
              if (showPassageCard && q.passage) {
                lastPassageText = q.passage;
                passageCardIdx = qi;
              }
              const isPassageCollapsed = expandedPassages.has(passageCardIdx);

              return (
                <div key={qi} className="flex flex-col gap-4">

                  {/* ── Standalone passage card ── */}
                  {showPassageCard && q.passage && (() => {
                    const pKey = `p-${qi}`;
                    const furiOn = showFurigana.has(pKey);
                    const furiLoading = furiganaLoading.has(pKey);
                    return (
                      <section className="glass-card af-reading">
                        <div className="reading-head">
                          <h3 className="reading-title">
                            <BookOpen size={14} strokeWidth={1.8} style={{ color: "var(--accent-emerald)" }} />
                            Teks Bacaan · 読解
                          </h3>
                          <div className="reading-actions">
                            <button
                              type="button"
                              onClick={() => toggleFurigana(pKey, q.passage!)}
                              disabled={furiLoading}
                              className={`toggle-chip${furiOn ? " on" : ""}`}
                            >
                              {furiLoading
                                ? <Loader2 size={11} className="animate-spin" />
                                : <span className="toggle-jp">ふ</span>}
                              {furiLoading ? "Memuat..." : "Furigana"}
                              {furiOn && !furiLoading && <Check size={11} strokeWidth={2.4} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedPassages(s => { const n = new Set(s); if (n.has(qi)) n.delete(qi); else n.add(qi); return n; })}
                              className="toggle-chip"
                            >
                              {isPassageCollapsed ? "Tampilkan ▼" : "Sembunyikan ▲"}
                            </button>
                          </div>
                        </div>
                        {!isPassageCollapsed && (
                          <div className="reading-body">
                            <p>
                              {furiOn && furiganaMarked[pKey]
                                ? renderPassage(furiganaMarked[pKey])
                                : q.passage}
                            </p>
                          </div>
                        )}
                      </section>
                    );
                  })()}

                  {/* ── Question card v2 ── */}
                  <article className="glass-card qc-v2">
                    <div className="qc-v2-head">
                      <span className="qc-v2-num">{qi + 1}</span>
                      {q.category && (
                        <span className="qc-v2-cat-tag">{q.category}</span>
                      )}
                      {(() => {
                        const qKey = `q-${qi}`;
                        const on = showFurigana.has(qKey);
                        const loading = furiganaLoading.has(qKey);
                        return (
                          <button
                            type="button"
                            onClick={() => toggleFurigana(qKey, q.question)}
                            disabled={loading}
                            className={`qc-furi-toggle${on ? " on" : ""}`}
                            title="Toggle furigana di soal"
                          >
                            {loading
                              ? <Loader2 className="size-2.5 animate-spin" />
                              : <span className="furi-jp">ふ</span>}
                            SOAL
                            {on && !loading && <Check size={10} strokeWidth={2.4} />}
                          </button>
                        );
                      })()}
                      {(() => {
                        const optKeys = q.options.map((_, oi) => `o-${qi}-${oi}`);
                        const allOn = optKeys.every(k => showFurigana.has(k));
                        const anyLoading = optKeys.some(k => furiganaLoading.has(k));
                        return (
                          <button
                            type="button"
                            onClick={() => toggleAllOptions(qi, q.options)}
                            disabled={anyLoading}
                            className={`qc-furi-toggle furi-opsi${allOn ? " on" : ""}`}
                            title="Toggle furigana di semua pilihan"
                          >
                            {anyLoading
                              ? <Loader2 className="size-2.5 animate-spin" />
                              : <span className="furi-jp">ふ</span>}
                            OPSI
                            {allOn && !anyLoading && <Check size={10} strokeWidth={2.4} />}
                          </button>
                        );
                      })()}
                      <div className="qc-v2-actions">
                        <button
                          type="button"
                          onClick={() => toggleReviewFlag(qi)}
                          disabled={savingFlagIdx === qi}
                          title={q.needs_review ? "Lepas tanda review" : "Tandai perlu review"}
                          className={`qc-act review${q.needs_review ? " on" : ""}`}
                        >
                          <Flag size={12} strokeWidth={1.8} /> REVIEW
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(qi)}
                          title="Edit soal manual"
                          className="qc-act edit"
                        >
                          <Pencil size={12} strokeWidth={1.8} /> EDIT
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(qi)}
                          title="Hapus soal"
                          className="qc-act delete"
                        >
                          <Trash2 size={12} strokeWidth={1.8} />
                        </button>
                      </div>
                    </div>

                    {(() => {
                      const qKey = `q-${qi}`;
                      const useFuri = showFurigana.has(qKey) && furiganaMarked[qKey];
                      return (
                        <p className="qc-v2-prompt font-jp-sans">
                          {useFuri
                            ? renderPassage(furiganaMarked[qKey])
                            : renderQuestion(q.question, accent)}
                        </p>
                      );
                    })()}

                    <div className="qc-v2-options">
                      {q.options.map((opt, oi) => {
                        const id = opt.charAt(0);
                        const isSelected = userAns === id;
                        const isCorrect = id === q.correct;
                        const optText = opt.slice(2).trim();
                        const opKey = `o-${qi}-${oi}`;
                        const useFuri = showFurigana.has(opKey) && furiganaMarked[opKey];

                        let cls = "";
                        if (isRevealed) {
                          if (isCorrect) cls = "correct";
                          else if (isSelected) cls = "wrong";
                          else cls = "dim";
                        } else if (isSelected) cls = "picked";

                        return (
                          <div
                            key={opt}
                            role="button"
                            tabIndex={0}
                            className={`qc-v2-option ${cls}`}
                            onClick={() => { if (!isRevealed) pick(qi, id); }}
                            onKeyDown={(e) => {
                              if ((e.key === "Enter" || e.key === " ") && !isRevealed) {
                                e.preventDefault();
                                pick(qi, id);
                              }
                            }}
                          >
                            <span className="qc-v2-bullet">{id}</span>
                            <span className="qc-v2-opt-text font-jp-sans">
                              {useFuri ? renderPassage(furiganaMarked[opKey]) : optText}
                            </span>
                            {isRevealed && isCorrect && (
                              <svg
                                width={16} height={16} viewBox="0 0 24 24" fill="none"
                                stroke="var(--accent-emerald)" strokeWidth={2.4}
                                strokeLinecap="round" strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <polyline className="qc-check-draw" points="20 6 9 17 4 12" />
                              </svg>
                            )}
                            {isRevealed && isSelected && !isCorrect && (
                              <X size={16} strokeWidth={2.4} style={{ color: "var(--accent-rose)" }} />
                            )}
                            <span
                              className="qc-opt-copy"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(optText, `Opsi ${id} tersalin`); }}
                              role="button"
                              tabIndex={-1}
                              title="Salin teks opsi"
                            >
                              <Copy size={12} />
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {!isRevealed && (
                      <>
                        <div className="qc-v2-hint">
                          <span className="qc-hint-emoji">💪</span>
                          Pilih jawaban dulu sebelum lihat pembahasan
                        </div>
                        <button
                          type="button"
                          className="qc-reveal-btn"
                          onClick={() => reveal(qi)}
                          disabled={!userAns}
                        >
                          <span className="reveal-emoji">🔥</span>
                          <span>LIHAT JAWABAN &amp; PEMBAHASAN</span>
                          <ChevronDown size={14} strokeWidth={2.4} />
                        </button>
                      </>
                    )}

                    {isRevealed && (() => {
                      const correctOpt = q.options.find(o => o.startsWith(q.correct));
                      const correctText = correctOpt?.slice(2).trim() ?? "";
                      const correctIdx = q.options.findIndex(o => o.startsWith(q.correct));
                      const correctOpKey = `o-${qi}-${correctIdx}`;
                      const useFuri = showFurigana.has(correctOpKey) && furiganaMarked[correctOpKey];
                      const isUserCorrect = userAns === q.correct;
                      return (
                        <section className="qc-pembahasan">
                          <div className="pb-result-badge">
                            <span className={`prb-icon ${isUserCorrect ? "good" : "bad"}`}>
                              {isUserCorrect
                                ? <Check size={14} strokeWidth={2.6} />
                                : <X size={14} strokeWidth={2.6} />}
                            </span>
                            <div className="prb-text">
                              <strong>
                                {isUserCorrect
                                  ? "Mantap, kamu benar!"
                                  : `Coba lagi — yang benar nomor ${q.correct}`}
                              </strong>
                              <span>
                                Jawaban: <em>Pilihan {q.correct} — {useFuri ? renderPassage(furiganaMarked[correctOpKey]) : correctText}</em>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`Pilihan ${q.correct} — ${correctText}`, "Jawaban tersalin")}
                              title="Salin jawaban"
                              className="qc-opt-copy"
                              style={{ opacity: 1 }}
                            >
                              <Copy size={12} />
                            </button>
                          </div>

                          <div className="qc-pb-section pb-good">
                            <div className="qc-pb-head">
                              <Sparkles size={13} strokeWidth={1.8} fill="currentColor" /> KENAPA BENAR
                            </div>
                            <p className="qc-pb-body">{q.explanation}</p>
                          </div>

                          {q.why_wrong && (
                            <div className="qc-pb-section pb-bad">
                              <div className="qc-pb-head">
                                <X size={13} strokeWidth={2} /> PILIHAN LAIN SALAH
                              </div>
                              <p className="qc-pb-body">{q.why_wrong}</p>
                            </div>
                          )}

                          {q.grammar_points && q.grammar_points.length > 0 && (
                            <div className="qc-pb-section pb-info">
                              <div className="qc-pb-head">
                                <BookOpen size={12} strokeWidth={1.8} /> POIN GRAMMAR / KOSAKATA
                              </div>
                              <div className="qc-pb-grammar">
                                {q.grammar_points.map((gp, i) => {
                                  const isSavedWord = savedWords.has(gp.jp);
                                  const isSavingThis = savingWord === gp.jp;
                                  return (
                                    <div key={i} className="qc-pb-grammar-row">
                                      <span className="qc-pb-grammar-jp">{gp.jp}</span>
                                      {gp.reading && <span className="qc-pb-grammar-reading">{gp.reading}</span>}
                                      <span className="qc-pb-grammar-meaning">{gp.id}</span>
                                      <button
                                        type="button"
                                        onClick={() => saveWord(gp.jp, gp.id)}
                                        disabled={isSavedWord || isSavingThis}
                                        className="dh-icon-btn"
                                        style={{ width: 26, height: 26 }}
                                        title={isSavedWord ? "Sudah di Kamus" : "Simpan ke Kamus"}
                                      >
                                        {isSavingThis
                                          ? <Loader2 className="size-3 animate-spin" />
                                          : isSavedWord
                                            ? <BookmarkCheck size={12} style={{ color: "var(--accent-emerald)" }} />
                                            : <BookmarkPlus size={12} />}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {q.tip && (
                            <div className="qc-pb-section pb-tips">
                              <div className="qc-pb-head">
                                <Sparkles size={12} strokeWidth={1} fill="currentColor" /> TIPS UJIAN
                              </div>
                              <p className="qc-pb-body">{q.tip}</p>
                            </div>
                          )}

                          <div className="qc-pb-footer">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => saveNoteToCatatan(qi, q)}
                              disabled={savedNotes.has(qi) || savingNote === qi}
                            >
                              {savingNote === qi
                                ? <Loader2 className="size-3 animate-spin" />
                                : savedNotes.has(qi)
                                  ? <Check size={12} />
                                  : <BookmarkPlus size={12} />}
                              {savedNotes.has(qi) ? "Tersimpan di Catatan" : savingNote === qi ? "Menyimpan..." : "Simpan ke Catatan"}
                            </button>
                          </div>
                        </section>
                      );
                    })()}
                  </article>
              </div>
            );
          });
        })()}

        {/* ── Tambah soal v2: manual / dari file ── */}
        <div className="af-add-row">
          <input
            ref={addPhotoRef}
            type="file"
            accept="image/*,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={onAddPhotoChange}
          />
          <button
            type="button"
            className="af-add-btn manual"
            onClick={openAddManual}
            disabled={addingPhoto}
          >
            <Plus size={14} strokeWidth={2.2} /> Tambah soal manual
          </button>
          <button
            type="button"
            className="af-add-btn from-file"
            onClick={() => addPhotoRef.current?.click()}
            disabled={addingPhoto}
            title="Upload foto/PDF/Word — AI analisis & append ke sesi ini"
          >
            {addingPhoto
              ? <><Loader2 size={14} className="animate-spin" /> Menganalisis...</>
              : <><Upload size={14} strokeWidth={1.8} /> Tambah dari file</>}
          </button>
        </div>
        </div>

        {/* ── Kosakata dari Foto v2 ── */}
        {result.vocabulary && result.vocabulary.length > 0 && (
          <section className="af-vocab-section">
            <div className="af-vocab-head">
              <span>Kosakata dari foto</span>
              <span className="meta-chip" style={{ padding: "2px 8px", fontSize: 10.5 }}>
                {result.vocabulary.length} kata
              </span>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: 0 }}>
                — tersimpan otomatis ke Kamus
              </span>
            </div>
            <div className="af-vocab-grid">
              {result.vocabulary.map((v, i) => (
                <article key={i} className="af-vocab-card">
                  {v.jlpt_level && <span className="af-vocab-level">{v.jlpt_level}</span>}
                  {v.reading && <span className="af-vocab-reading">{v.reading}</span>}
                  <span className="af-vocab-word">{v.word}</span>
                  <p className="af-vocab-meaning" style={{ margin: 0 }}>{v.meaning}</p>
                  {v.example && (
                    <p className="af-vocab-example" style={{ margin: 0 }}>{v.example}</p>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 10, color: "var(--accent-emerald)" }}>
                    <BookmarkCheck size={11} strokeWidth={1.8} />
                    <span style={{ letterSpacing: "0.08em", fontWeight: 600 }}>Tersimpan</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="h-8" />
      </main>

      {/* ── Right: Sensei / Kamus / Catatan sidebar (v2 markup) ── */}
      <aside className="af-side hidden lg:flex">
        <div className="glass-card side-tabs">
          <button
            type="button"
            className={`side-tab${rightTab === "chat" ? " on" : ""}`}
            onClick={() => setRightTab("chat")}
          >
            <MessageCircle size={13} strokeWidth={1.8} fill={rightTab === "chat" ? "currentColor" : "none"} />
            SENSEI
          </button>
          <button
            type="button"
            className={`side-tab${rightTab === "kamus" ? " on" : ""}`}
            onClick={() => setRightTab("kamus")}
          >
            <BookOpen size={13} strokeWidth={1.8} />
            KAMUS
          </button>
          <button
            type="button"
            className={`side-tab${rightTab === "catatan" ? " on" : ""}`}
            onClick={() => setRightTab("catatan")}
          >
            <NotebookPen size={13} strokeWidth={1.8} />
            CATATAN
            {catatanList.length > 0 && <span className="side-tab-badge">{catatanList.length}</span>}
          </button>
        </div>

        {/* ── Tab: Sensei chat ── */}
        {rightTab === "chat" && (
          <div className="glass-card side-card sensei-card">
            <div className="sensei-intro">
              <div className="sensei-avatar">先</div>
              <div>
                <div className="sensei-name">Sensei AI</div>
                <div className="sensei-status">Online · siap bantu</div>
              </div>
            </div>

            {chatMsgs.length === 0 ? (
              <div className="sensei-suggest">
                {[
                  "Kenapa jawaban ini benar?",
                  "Kasih contoh kalimat lain",
                  "Jelasin grammar-nya lebih detail",
                ].map(s => (
                  <button
                    key={s}
                    type="button"
                    className="suggest-pill"
                    onClick={() => setChatInput(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <div className="sensei-msgs">
                {chatMsgs.map((m, i) => (
                  <div key={i} className={`sensei-msg ${m.role === "user" ? "user" : "bot"}`}>
                    {m.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="sensei-msg bot">
                    <Loader2 size={12} className="animate-spin" />
                  </div>
                )}
              </div>
            )}

            <div className="sensei-input">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Tanya tentang soal ini..."
              />
              <button
                type="button"
                className="sensei-send"
                onClick={sendChat}
                disabled={!chatInput.trim() || chatLoading}
                aria-label="Kirim"
              >
                <Send size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Kamus ── */}
        {rightTab === "kamus" && (
          <div className="glass-card side-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "var(--surface-1)", border: "1px solid var(--edge-soft)" }}>
              <Search size={13} strokeWidth={1.6} style={{ color: "var(--text-tertiary)" }} />
              <input
                value={kamusQuery}
                onChange={e => setKamusQuery(e.target.value)}
                placeholder="Cari kata..."
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "var(--text-primary)", fontSize: 12.5, fontFamily: "var(--font-sans)",
                }}
              />
              {kamusQuery && (
                <button
                  type="button"
                  onClick={() => setKamusQuery("")}
                  style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
                  aria-label="Hapus"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Add word form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
                <input
                  value={addKanji}
                  onChange={e => setAddKanji(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && generateWordInfo()}
                  placeholder="Ketik kata/kanji..."
                  className="font-jp-sans"
                  style={{
                    flex: 1, minWidth: 0, padding: "8px 12px", borderRadius: 10,
                    background: "var(--surface-1)", border: "1px solid var(--edge-default)",
                    color: "var(--text-primary)", fontSize: 14, outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={generateWordInfo}
                  disabled={!addKanji.trim() || generating}
                  className="btn btn-magic btn-sm"
                  style={{ whiteSpace: "nowrap" }}
                >
                  {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {generating ? "" : "Auto"}
                </button>
              </div>
              {(addReading || addMeaning) && (
                <>
                  <input
                    value={addReading}
                    onChange={e => setAddReading(e.target.value)}
                    placeholder="Cara baca (hiragana)"
                    style={{
                      padding: "8px 12px", borderRadius: 8,
                      background: "rgba(139, 90, 140, 0.08)", border: "1px solid rgba(139, 90, 140, 0.2)",
                      color: "var(--n1)", fontSize: 12.5, outline: "none",
                      fontFamily: "var(--font-sans-jp)",
                    }}
                  />
                  <input
                    value={addMeaning}
                    onChange={e => setAddMeaning(e.target.value)}
                    placeholder="Arti"
                    style={{
                      padding: "8px 12px", borderRadius: 8,
                      background: "var(--surface-1)", border: "1px solid var(--edge-soft)",
                      color: "var(--text-primary)", fontSize: 12.5, outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={saveNewWord}
                    disabled={!addMeaning.trim() || savingNew}
                    style={{ justifyContent: "center" }}
                  >
                    {savingNew ? <Loader2 size={12} className="animate-spin" /> : <BookmarkPlus size={12} />}
                    Simpan ke Kamus
                  </button>
                </>
              )}
            </div>

            {/* Word list */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {!kamusLoaded ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
                </div>
              ) : kamusWords.length === 0 ? (
                <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0", margin: 0 }}>
                  Kamus kosong. Simpan kata dari soal dulu.
                </p>
              ) : (
                kamusWords
                  .filter(w => {
                    const q = kamusQuery.toLowerCase();
                    return !q || w.kanji.includes(kamusQuery) || (w.reading ?? "").includes(kamusQuery) || w.meaning.toLowerCase().includes(q);
                  })
                  .map(w => (
                    <div
                      key={w.id}
                      style={{
                        padding: "8px 10px", borderRadius: 8,
                        background: "var(--surface-1)", border: "1px solid var(--edge-soft)",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span className="font-jp-sans" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5 }}>{w.kanji}</span>
                        {w.reading && (
                          <span className="font-jp-sans" style={{ fontSize: 10.5, color: "var(--text-tertiary)", lineHeight: 1.5 }}>{w.reading}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleKamusFavorite(w.id)}
                          aria-label={w.favorite ? "Hapus dari favorit" : "Tandai favorit"}
                          title={w.favorite ? "Favorit ✓" : "Tandai favorit"}
                          style={{
                            marginLeft: "auto", flexShrink: 0,
                            width: 22, height: 22, borderRadius: 6,
                            display: "grid", placeItems: "center",
                            background: "transparent", border: "none", cursor: "pointer",
                            color: w.favorite ? "var(--accent-amber)" : "var(--text-tertiary)",
                            transition: "color .14s, transform .14s",
                          }}
                        >
                          <Star size={13} strokeWidth={1.8} fill={w.favorite ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <p style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: "2px 0 0", lineHeight: 1.4 }}>{w.meaning.split(";")[0]}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Catatan ── */}
        {rightTab === "catatan" && (
          <div className="glass-card side-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid var(--edge-soft)" }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-tertiary)" }}>
                {catatanList.length} catatan
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => { setNewNoteOpen(o => !o); setNewNoteText(""); }}
              >
                <Plus size={11} strokeWidth={2.4} /> Baru
              </button>
            </div>

            {newNoteOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 10, background: "rgba(107, 142, 63, 0.06)", border: "1px solid rgba(107, 142, 63, 0.2)" }}>
                <textarea
                  autoFocus
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                  placeholder="Tulis catatanmu..."
                  rows={4}
                  style={{
                    padding: "8px 10px", borderRadius: 8,
                    background: "var(--surface-1)", border: "1px solid var(--edge-soft)",
                    color: "var(--text-primary)", fontSize: 12.5, outline: "none",
                    resize: "vertical", lineHeight: 1.5,
                    fontFamily: "var(--font-sans)",
                  }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setNewNoteOpen(false); setNewNoteText(""); }}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={addNewNote}
                    disabled={!newNoteText.trim() || savingNewNote}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    {savingNewNote ? <Loader2 size={12} className="animate-spin" /> : "Simpan"}
                  </button>
                </div>
              </div>
            )}

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {!catatanLoaded ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
                </div>
              ) : catatanList.length === 0 ? (
                <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0", margin: 0 }}>
                  Belum ada catatan. Klik &ldquo;Simpan ke Catatan&rdquo; di soal.
                </p>
              ) : catatanList.map(c => {
                const isExpanded = expandedNote === c.id;
                return (
                  <div
                    key={c.id}
                    style={{
                      borderRadius: 8,
                      background: isExpanded ? "var(--surface-2)" : "var(--surface-1)",
                      border: "1px solid var(--edge-soft)",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedNote(isExpanded ? null : c.id)}
                      style={{
                        width: "100%", padding: "10px 12px",
                        display: "flex", alignItems: "flex-start", gap: 10,
                        background: "transparent", border: "none",
                        textAlign: "left", cursor: "pointer",
                        color: "inherit", fontFamily: "var(--font-sans)",
                      }}
                    >
                      <NotebookPen size={14} strokeWidth={1.6} style={{ color: "var(--accent-emerald)", marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.5 }}>
                          {c.judul || "Catatan"}
                        </p>
                        <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", margin: "2px 0 0", lineHeight: 1.5 }}>
                          {new Date(c.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{isExpanded ? "▲" : "▼"}</span>
                    </button>
                    {isExpanded && (
                      <div style={{ padding: "0 12px 12px" }}>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>
                          {c.isi}
                        </p>
                        <a
                          href="/catatan"
                          style={{ marginTop: 8, display: "inline-block", fontSize: 10.5, color: "var(--accent-emerald)", fontWeight: 500 }}
                        >
                          Buka di Catatan →
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>


      {/* ─── Edit Modal per Soal (v2) ─── */}
      {editIdx !== null && editDraft && (
        <>
          <div className="af-modal-overlay" onClick={() => !editSaving && closeEdit()} />
          <div className="af-modal" role="dialog">
            <header className="af-modal-head">
              <div className="af-modal-head-left">
                <div className="af-modal-head-icon">
                  <Pencil size={16} strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="af-modal-title">
                    {editIdx >= result.questions.length ? "Tambah Soal Manual" : `Edit Soal #${editIdx + 1}`}
                  </h2>
                  <p className="af-modal-sub">
                    {editIdx >= result.questions.length
                      ? "Ketik soal + opsi + jawaban + penjelasan dari nol"
                      : "Perbaiki field manual kalau AI kurang akurat"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeEdit}
                disabled={editSaving}
                aria-label="Tutup"
              >
                <X size={14} />
              </button>
            </header>

            <div className="af-modal-body">
              <button
                type="button"
                className={`af-modal-flag-row${editDraft.needs_review ? " on" : ""}`}
                onClick={() => setEditDraft(d => d ? { ...d, needs_review: !d.needs_review } : d)}
              >
                <span className={`af-mfr-check${editDraft.needs_review ? " on" : ""}`}>
                  {editDraft.needs_review && <Check size={10} strokeWidth={3} style={{ color: "var(--bg)" }} />}
                </span>
                <Flag size={13} strokeWidth={1.8} />
                TANDAI PERLU REVIEW
              </button>

              <div className="af-modal-field">
                <div className="af-mf-head">
                  <label>SOAL (teks pertanyaan)</label>
                  {(() => {
                    const canSplit = !!splitInlineOptions(editDraft.question);
                    return (
                      <button
                        type="button"
                        className={`af-mf-action${canSplit ? " on" : ""}`}
                        disabled={!canSplit}
                        onClick={() => {
                          const split = splitInlineOptions(editDraft.question);
                          if (!split) return;
                          setEditDraft(d => d ? { ...d, question: split.question, options: split.options } : d);
                          setToast({ text: "Opsi dipisahkan dari soal", ok: true });
                          setTimeout(() => setToast(null), 1800);
                        }}
                        title={canSplit
                          ? "Deteksi pola 1…2…3…4… di teks soal lalu pindahkan ke field opsi"
                          : "Tidak ada pola opsi yang terdeteksi di teks soal"}
                      >
                        PISAHKAN OPSI
                      </button>
                    );
                  })()}
                </div>
                <textarea
                  className="af-modal-textarea font-jp-sans"
                  rows={3}
                  value={editDraft.question}
                  onChange={e => setEditDraft(d => d ? { ...d, question: e.target.value } : d)}
                />
              </div>

              <div className="af-modal-field">
                <label>PILIHAN JAWABAN</label>
                <p className="af-mf-hint">
                  Klik nomor di kiri buat tandai jawaban benar (sekarang:{" "}
                  <strong style={{ color: "var(--accent-emerald)" }}>{editDraft.correct}</strong>)
                </p>
                <div className="af-modal-opt-list">
                  {editDraft.options.map((opt, oi) => (
                    <div key={oi} className="af-modal-opt-row">
                      <button
                        type="button"
                        className={`af-modal-opt-num${editDraft.correct === String(oi + 1) ? " correct" : ""}`}
                        onClick={() => setEditDraft(d => d ? { ...d, correct: String(oi + 1) } : d)}
                        title="Tandai jawaban benar"
                      >
                        {editDraft.correct === String(oi + 1)
                          ? <Check size={11} strokeWidth={3} />
                          : oi + 1}
                      </button>
                      <input
                        className="af-modal-input font-jp-sans"
                        value={opt}
                        onChange={e => setEditDraft(d => {
                          if (!d) return d;
                          const next = [...d.options];
                          next[oi] = e.target.value;
                          return { ...d, options: next };
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="af-modal-field">
                <label>PENJELASAN</label>
                <textarea
                  className="af-modal-textarea"
                  rows={4}
                  value={editDraft.explanation}
                  onChange={e => setEditDraft(d => d ? { ...d, explanation: e.target.value } : d)}
                />
              </div>

              <div className="af-modal-field">
                <label>KENAPA PILIHAN LAIN SALAH</label>
                <textarea
                  className="af-modal-textarea"
                  rows={3}
                  value={editDraft.why_wrong ?? ""}
                  onChange={e => setEditDraft(d => d ? { ...d, why_wrong: e.target.value } : d)}
                />
              </div>

              <div className="af-modal-field">
                <label>TIPS UJIAN</label>
                <textarea
                  className="af-modal-textarea"
                  rows={2}
                  value={editDraft.tip ?? ""}
                  onChange={e => setEditDraft(d => d ? { ...d, tip: e.target.value } : d)}
                />
              </div>

              <div className="af-modal-field">
                <label>KATEGORI</label>
                <div className="af-modal-cat-row">
                  {(["文法", "語彙", "文字", "読解"] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`af-modal-cat-chip font-jp-sans${editDraft.category === c ? " on" : ""}`}
                      onClick={() => setEditDraft(d => d ? { ...d, category: c } : d)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <footer className="af-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeEdit}
                disabled={editSaving}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveEdit}
                disabled={editSaving || !editDraft.question.trim() || !editDraft.explanation.trim()}
              >
                {editSaving
                  ? <><Loader2 className="size-4 animate-spin" /> Menyimpan...</>
                  : <><Save size={13} strokeWidth={2.4} /> SIMPAN</>}
              </button>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Camera Modal (desktop webcam) ─────────────────────────── */
function CameraModal({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setCamError("Tidak bisa mengakses kamera. Periksa izin browser.");
      }
    }
    startCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file);
      onClose();
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: "rgba(8,16,36,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-[var(--text-secondary)]" />
            <span className="text-sm font-bold text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-jakarta)" }}>Ambil Foto dengan Kamera</span>
          </div>
          <button onClick={onClose}
            className="size-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
            <X className="size-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Video / error */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          {camError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <Camera className="size-10 text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-manrope)" }}>{camError}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted
                className="w-full h-full object-cover" />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-8 text-[var(--info)] animate-spin" />
                </div>
              )}
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Footer */}
        <div className="px-5 py-5 flex items-center justify-center gap-4">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            style={{ background: "var(--surface-2)", fontFamily: "var(--font-space)" }}>
            BATAL
          </button>
          <button onClick={capture} disabled={!ready || !!camError}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{
              background: ready && !camError ? "linear-gradient(135deg,var(--surface-2),var(--surface-3))" : "var(--surface-2)",
              color: ready && !camError ? "var(--text-primary)" : "var(--text-tertiary)",
              fontFamily: "var(--font-space)",
            }}>
            <Camera className="size-4" /> AMBIL FOTO
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Notif data ─────────────────────────────────────────────── */
const notifs = [
  {
    id: 1, read: false,
    icon: "🔥", color: "var(--primary)",
    title: "Streak dalam bahaya!",
    desc: "Kamu belum latihan hari ini. Streak 7 harimu akan putus tengah malam.",
    time: "1 jam lalu",
  },
  {
    id: 2, read: false,
    icon: "🗂️", color: "var(--text-secondary)",
    title: "5 kata perlu direview",
    desc: "諦める・把握・一生懸命 dan 2 lainnya sudah waktunya diulang hari ini.",
    time: "3 jam lalu",
  },
  {
    id: 3, read: true,
    icon: "✨", color: "var(--n1)",
    title: "Fitur baru: Favorit Kamus",
    desc: "Kamu sekarang bisa simpan kata favorit dan filter di tab Favorit.",
    time: "Kemarin",
  },
];

/* ─── Page ──────────────────────────────────────────────────── */
export default function AnalisisFoto() {
  const [stage,               setStage]               = useState<Stage>("upload");
  const [notifOpen,           setNotifOpen]           = useState(false);
  const [readIds,             setReadIds]             = useState<Set<number>>(new Set(notifs.filter(n => n.read).map(n => n.id)));
  const [files,               setFiles]               = useState<FileData[]>([]);
  const [result,              setResult]              = useState<AIResult | null>(null);
  const [resultLevel,         setResultLevel]         = useState<Level | null>(null);
  const [resultCategory,      setResultCategory]      = useState<Category | null>(null);
  const [apiError,            setApiError]            = useState<string | null>(null);
  const [chatMsgs,            setChatMsgs]            = useState<ChatMsg[]>([]);
  const [savedSessionId,      setSavedSessionId]      = useState<string | null>(null);
  const [loadingSession,      setLoadingSession]      = useState(false);
  const [isReviewMode,        setIsReviewMode]        = useState(false);
  const [currentAnalyzingIdx, setCurrentAnalyzingIdx] = useState(0);
  const abortRef       = useRef<AbortController | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const camInputRef    = useRef<HTMLInputElement>(null);
  const [camModalOpen, setCamModalOpen] = useState(false);
  const [userInitial, setUserInitial] = useState("Y");
  const [streak, setStreak] = useState(0);

  /* Load user info for v2 UserBar */
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
      const { data } = await supabase.from("profiles").select("streak").eq("id", user.id).single();
      if (data) setStreak(data.streak ?? 0);
    })();
  }, []);

  /* Split text at paragraph boundaries, max ~4000 chars per chunk */
  const chunkDocxText = (text: string, maxChars = 4000): string[] => {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let current = "";
    for (const para of paragraphs) {
      if (current.length + para.length > maxChars && current) {
        chunks.push(current.trim());
        current = para;
      } else {
        current += (current ? "\n\n" : "") + para;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(c => c.length > 50);
  };

  /* Convert raw bytes (ArrayBuffer / Uint8Array) → base64 string */
  const bytesToBase64 = (input: ArrayBuffer | Uint8Array): string => {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let binary = "";
    const CHUNK = 0x8000; // avoid call-stack overflow on large buffers
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    return btoa(binary);
  };

  /* Split a multi-page PDF into chunks of N pages each. Returns a list of FileData. */
  const splitPdfIntoChunks = async (file: File, pagesPerChunk = 2): Promise<FileData[]> => {
    const { PDFDocument } = await import("pdf-lib");
    const buffer = await file.arrayBuffer();
    const pdf    = await PDFDocument.load(buffer);
    const total  = pdf.getPageCount();

    // Small PDF → no split, ship as single chunk
    if (total <= pagesPerChunk) {
      return [{
        base64: bytesToBase64(buffer),
        mimeType: "application/pdf",
        name: file.name,
        url: "",
      }];
    }

    const chunks: FileData[] = [];
    for (let i = 0; i < total; i += pagesPerChunk) {
      const newPdf  = await PDFDocument.create();
      const count   = Math.min(pagesPerChunk, total - i);
      const indices = Array.from({ length: count }, (_, j) => i + j);
      const copied  = await newPdf.copyPages(pdf, indices);
      copied.forEach(p => newPdf.addPage(p));
      const bytes   = await newPdf.save();
      chunks.push({
        base64: bytesToBase64(bytes),
        mimeType: "application/pdf",
        name: `${file.name} — hal ${i + 1}-${i + count}`,
        url: "",
      });
    }
    return chunks;
  };

  /* Shared: process a File object into FileData and add to state */
  const processFile = (file: File) => {
    const isDocx = file.name.toLowerCase().endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isPdf  = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isDocx) {
      const reader = new FileReader();
      reader.onload = async () => {
        const mammoth = (await import("mammoth")).default;
        const result  = await mammoth.extractRawText({ arrayBuffer: reader.result as ArrayBuffer });
        const chunks  = chunkDocxText(result.value);
        const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const newFiles: FileData[] = chunks.map((chunk, i) => ({
          base64: "",
          mimeType: DOCX_MIME,
          name: chunks.length > 1 ? `${file.name} — bagian ${i + 1}/${chunks.length}` : file.name,
          url: "",
          textContent: chunk,
        }));
        if (stage === "setup") {
          setFiles(prev => [...prev, ...newFiles]);
        } else {
          setFiles(newFiles);
          setStage("setup");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    if (isPdf) {
      (async () => {
        try {
          const newFiles = await splitPdfIntoChunks(file, 2);
          if (stage === "setup") setFiles(prev => [...prev, ...newFiles]);
          else { setFiles(newFiles); setStage("setup"); }
        } catch (err) {
          console.error("PDF split failed, falling back to single upload:", err);
          // Fallback: treat the PDF as one piece using the simple base64 path below.
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64  = dataUrl.split(",")[1];
            const newFile: FileData = { base64, mimeType: "application/pdf", name: file.name, url: "" };
            if (stage === "setup") setFiles(prev => [...prev, newFile]);
            else { setFiles([newFile]); setStage("setup"); }
          };
          reader.readAsDataURL(file);
        }
      })();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64  = dataUrl.split(",")[1];
      const newFile: FileData = { base64, mimeType: file.type || "image/jpeg", name: file.name, url: dataUrl };
      if (stage === "setup") {
        setFiles(prev => [...prev, newFile]);
      } else {
        setFiles([newFile]);
        setStage("setup");
      }
    };
    reader.readAsDataURL(file);
  };

  /* Camera button: mobile → native camera, desktop → getUserMedia modal */
  const handleCameraClick = () => {
    const isMobile = /Mobi|Android|iPad|iPhone/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
    if (isMobile) {
      camInputRef.current?.click();
    } else {
      setCamModalOpen(true);
    }
  };

  /* Load session from ?session=<id> URL param, or auto-trigger mode */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid  = params.get("session");
    const mode = params.get("mode");
    if (sid) {
      loadSession(sid);
    } else if (mode === "upload") {
      fileInputRef.current?.click();
    } else if (mode === "camera") {
      handleCameraClick();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSession = async (id: string) => {
    setLoadingSession(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("sessions")
        .select("ai_result, level, category")
        .eq("id", id)
        .single();
      if (data?.ai_result) {
        // Retroactively clean sessions saved before the inline-options fix
        // shipped — strip options from `question` field if they look duplicated.
        const raw = data.ai_result as AIResult;
        const cleaned: AIResult = {
          ...raw,
          questions: (raw.questions ?? []).map(q => ({ ...q, ...sanitizeQuestion(q) })),
        };
        setResult(cleaned);
        setResultLevel((data.level ?? null) as Level | null);
        setResultCategory(((data.category === "AI" ? "ai" : data.category) ?? null) as Category | null);
        setSavedSessionId(id);
        setChatMsgs([]);
        setIsReviewMode(true);
        setStage("result");
      }
    } catch {
      // stay on upload if fetch fails
    } finally {
      setLoadingSession(false);
    }
  };

  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;

  const handleUpload = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = "";
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStage("upload");
    setApiError(null);
  };

  const handleStart = async (level: Level, category: Category) => {
    if (files.length === 0) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStage("analyzing");
    setApiError(null);
    setCurrentAnalyzingIdx(1);
    setResultLevel(level);
    setResultCategory(category);

    const allQuestions: AIQuestion[] = [];
    const allVocab: VocabItem[] = [];
    let mainTitle = "";

    try {
      for (let i = 0; i < files.length; i++) {
        setCurrentAnalyzingIdx(i + 1);
        const fd = files[i];
        const res = await fetch("/api/analisis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: fd.base64, mimeType: fd.mimeType, level, category, textContent: fd.textContent }),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Analisis gagal");
        const data: AIResult = json.data;
        if (i === 0) mainTitle = data.title;
        allQuestions.push(...data.questions.map(q => ({ ...q, ...sanitizeQuestion(q) })));
        if (data.vocabulary) allVocab.push(...data.vocabulary);
      }

      // Deduplicate vocab by word
      const uniqueVocab = Array.from(new Map(allVocab.map(v => [v.word, v])).values());

      const combinedResult: AIResult = {
        title: files.length > 1 ? `${mainTitle} (+${files.length - 1} foto)` : mainTitle,
        vocabulary: uniqueVocab,
        questions: allQuestions,
      };

      setResult(combinedResult);
      setChatMsgs([]);
      setStage("result");

      // Save to Supabase (fire-and-forget)
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const categoryForDb = category === "ai" ? "AI" : category;
          const { data: session } = await supabase
            .from("sessions")
            .insert({
              user_id: user.id,
              level,
              category: categoryForDb,
              title: combinedResult.title,
              total: combinedResult.questions.length,
              ai_result: combinedResult,
            })
            .select("id")
            .single();

          if (session) {
            setSavedSessionId(session.id);
            await supabase.from("questions").insert(
              combinedResult.questions.map(q => ({
                session_id: session.id,
                user_id: user.id,
                question: q.question,
                options: q.options,
                correct_ans: q.correct,
                explanation: q.explanation,
              }))
            );
          }

          // Auto-save vocabulary dengan furigana ke saved_words
          if (uniqueVocab.length > 0) {
            await supabase.from("saved_words").upsert(
              uniqueVocab.map(v => ({
                user_id: user.id,
                kanji: v.word,
                reading: v.reading,
                meaning: v.meaning,
                example: v.example || null,
                level: v.jlpt_level || null,
              })),
              { onConflict: "user_id,kanji", ignoreDuplicates: true }
            );
          }
        }
      } catch {
        // saving failed silently
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return; // user cancelled
      setApiError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setStage("upload");
    } finally {
      abortRef.current = null;
    }
  };

  const handleReset = () => {
    setStage("upload");
    setFiles([]);
    setResult(null);
    setApiError(null);
    setChatMsgs([]);
    setSavedSessionId(null);
    setIsReviewMode(false);
    setCurrentAnalyzingIdx(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.history.replaceState({}, "", "/analisis-foto");
  };

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={camInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Desktop camera modal */}
      {camModalOpen && (
        <CameraModal
          onCapture={processFile}
          onClose={() => setCamModalOpen(false)}
        />
      )}

      <main className="app-shell">
        <UserBar
          streakDays={streak}
          xp={820}
          xpTarget={1000}
          avatarLetter={userInitial}
          isPro
          hasUnread={unreadCount > 0}
          onBellClick={() => setNotifOpen(o => !o)}
        />

        {stage === "upload" && (
          <UploadView
            onUpload={handleUpload}
            onCamera={handleCameraClick}
            onOpenResult={() => setStage("result")}
            error={apiError}
          />
        )}

        {stage === "setup" && (
          <SetupView
            onStart={handleStart}
            onBack={() => { setFiles([]); setStage("upload"); }}
            files={files}
            onAddFile={handleUpload}
            onCamera={handleCameraClick}
            onRemoveFile={(idx) => setFiles(prev => prev.filter((_, i) => i !== idx))}
          />
        )}

        {loadingSession && (
          <div className="af-analyzing">
            <div className="af-analyzing-spinner" />
            <p className="af-analyzing-title">Memuat sesi...</p>
          </div>
        )}

        {!loadingSession && stage === "analyzing" && (
          <AnalyzingView
            imageUrl={files[currentAnalyzingIdx - 1]?.url}
            currentIdx={currentAnalyzingIdx}
            total={files.length}
            onCancel={handleCancel}
          />
        )}

        {!loadingSession && stage === "result" && result && (
          <ResultView
            result={result}
            setResult={setResult}
            chatMsgs={chatMsgs}
            setChatMsgs={setChatMsgs}
            onReset={handleReset}
            isSaved={!!savedSessionId}
            sessionId={savedSessionId}
            isReview={isReviewMode}
            sessionLevel={resultLevel}
            sessionCategory={resultCategory}
          />
        )}
      </main>
    </>
  );
}

