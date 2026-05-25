"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, BottomNav } from "@/components/Sidebar";
import KamusFlashCard from "@/components/KamusFlashCard";
import {
  Camera, Bell, Upload, ArrowUpRight,
  CheckCircle2, Circle, Sparkles,
  ChevronLeft, RotateCcw,
  X, Check, Send, Loader2, BookmarkPlus, BookmarkCheck,
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
interface AIResult {
  title: string;
  vocabulary?: VocabItem[];
  questions: AIQuestion[];
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
  const normDigit = (c: string) => ({ "１": "1", "２": "2", "３": "3", "４": "4" } as Record<string,string>)[c] ?? c;

  // A marker is a digit 1/2/3/4 (half- or full-width) at line-start OR
  // preceded by whitespace (incl. full-width). It must not be followed by
  // another digit, so "12" isn't a match.
  const markerRe = /(?:^|[\s　])([1-4１-４])(?![\d０-９])/g;
  const hits: { digitIdx: number; digit: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(text))) {
    hits.push({ digitIdx: m.index + m[0].length - 1, digit: normDigit(m[1]) });
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
  { label: "Soal dianalisis",  value: "24",  suffix: "",   color: "#6b9cda", glow: "rgba(74,122,191,0.15)"  },
  { label: "Akurasi rata-rata",value: "78%", suffix: "",   color: "#5ea87a", glow: "rgba(94,168,122,0.15)" },
  { label: "Hari streak",      value: "5",   suffix: "🔥", color: "#e07b4a", glow: "rgba(224,123,74,0.15)"  },
];

const recentAnalysis = [
  { kanji: "文法", label: "N2 文法問題 #14", date: "14 Apr", color: "#4a7abf" },
  { kanji: "読解", label: "N2 読解問題 #8",  date: "12 Apr", color: "#5ea87a" },
  { kanji: "語彙", label: "N2 語彙問題 #22", date: "10 Apr", color: "#8b5abf" },
  { kanji: "文法", label: "N2 文法問題 #9",  date: "8 Apr",  color: "#e07b4a" },
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
        style={{ background: "radial-gradient(circle,#4a7abf,transparent 70%)" }} />
      <div className="pointer-events-none absolute top-10 right-0 w-[250px] h-[250px] opacity-[0.04] blur-[60px]"
        style={{ background: "radial-gradient(circle,#8b5abf,transparent 70%)" }} />

      {/* Page title */}
      <div className="mb-5 relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          <span className="text-[10px] tracking-widest text-[#5ea87a] font-semibold"
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
              <p className="text-[#c08080] leading-relaxed">{error}</p>
            </div>
          </div>
        )}
        <h1 className="text-[2.4rem] font-extrabold leading-tight text-[#d7e2ff]"
          style={{ fontFamily: "var(--font-jakarta)" }}>
          Upload Soalmu,
          <br />
          <span style={{
            background: "linear-gradient(135deg,#bbc6e2 0%,#6b9cda 50%,#a67bd4 100%)",
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
            style={{ background: "#101b30" }}>
            <div className="absolute inset-0 opacity-60"
              style={{ background: `radial-gradient(circle at left,${glow},transparent 80%)` }} />
            <p className="relative text-lg font-extrabold leading-none" style={{ color, fontFamily: "var(--font-jakarta)" }}>
              {value}{suffix && <span className="ml-1">{suffix}</span>}
            </p>
            <p className="relative text-[11px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Drop zone — tall focal point */}
      <button
        onClick={onUpload}
        className="group w-full rounded-2xl flex flex-col items-center justify-center gap-4 transition-all hover:brightness-110 mb-5 relative overflow-hidden"
        style={{
          background: "#101b30",
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

        <Upload className="relative size-8 text-[#5ea87a] opacity-80" />

        <div className="relative text-center">
          <p className="font-bold text-[#d7e2ff] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>
            Seret & lepas foto soal JLPT di sini
          </p>
          <p className="text-xs text-[#4a5a7a]">PNG, JPG, PDF, Word (.docx) · Maks. 10MB</p>
        </div>

        <div className="relative flex items-center gap-2">
          <span className="text-[11px] px-5 py-1.5 rounded-full font-bold text-[#071327]"
            style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", fontFamily: "var(--font-space)" }}>
            PILIH FILE
          </span>
          <span onClick={e => { e.stopPropagation(); onCamera(); }}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full font-medium text-[#8a9bbf] border cursor-pointer hover:text-[#d7e2ff] hover:border-white/20 transition-colors"
            style={{ borderColor: "rgba(187,198,226,0.12)", fontFamily: "var(--font-space)" }}>
            <Camera className="size-3.5" /> KAMERA
          </span>
        </div>
      </button>

      {/* Bottom 2-col */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Riwayat analisis */}
        <div className="rounded-2xl p-5" style={{ background: "#101b30" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
              RIWAYAT ANALISIS TERBARU
            </p>
            <button className="flex items-center gap-1 text-[10px] text-[#4a5a7a] hover:text-[#bbc6e2] transition-colors"
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
                  style={{ background: "#1f2a3f" }}>
                  <div className="size-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                    style={{ background: `${color}20`, color, fontFamily: "var(--font-jakarta)" }}>
                    {kanji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#d7e2ff] truncate"
                      style={{ fontFamily: "var(--font-jakarta)" }}>{label}</p>
                  </div>
                  <span className="text-[10px] text-[#4a5a7a] shrink-0 group-hover:text-[#bbc6e2] transition-colors"
                    style={{ fontFamily: "var(--font-space)" }}>{date}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="size-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: "#1f2a3f" }}>📭</div>
              <p className="text-xs font-semibold text-[#4a5a7a] text-center"
                style={{ fontFamily: "var(--font-jakarta)" }}>Belum ada soal yang dianalisis</p>
              <p className="text-[11px] text-[#2a354b] text-center">Upload foto pertamamu di atas!</p>
            </div>
          )}
        </div>

        {/* Kolom kanan: Tips + XP Progress */}
        <div className="flex flex-col gap-4">

          {/* Tips foto */}
          <div className="rounded-2xl p-5" style={{ background: "#101b30" }}>
            <p className="text-xs font-bold text-[#4a5a7a] mb-3" style={{ fontFamily: "var(--font-space)" }}>
              TIPS FOTO YANG BAGUS
            </p>
            <div className="grid grid-cols-2 gap-2">
              {photoTips.map(({ no, text }) => (
                <div key={no} className="rounded-xl p-3 flex flex-col gap-2"
                  style={{ background: "#1f2a3f" }}>
                  <p className="text-[11px] text-[#8a9bbf] leading-relaxed">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded mr-1.5 text-[10px] font-bold text-[#071327] align-middle"
                      style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", fontFamily: "var(--font-space)", flexShrink: 0 }}>
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
            style={{ background: "#101b30" }}>
            <div className="absolute inset-0 opacity-15"
              style={{ background: "radial-gradient(circle at top right,#4a7abf,transparent 65%)" }} />
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
                  PROGRES N2 KAMU
                </p>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "#2f4865", color: "#8ab4e8", fontFamily: "var(--font-space)" }}>
                  LEVEL 4
                </span>
              </div>

              <p className="text-3xl font-extrabold text-[#d7e2ff] mt-2 mb-0.5"
                style={{ fontFamily: "var(--font-jakarta)" }}>
                520 <span className="text-base font-semibold text-[#4a5a7a]">/ 1000 XP</span>
              </p>
              <p className="text-[11px] text-[#8a9bbf] mb-3">52% menuju level berikutnya</p>

              <div className="h-2 rounded-full mb-4" style={{ background: "#1f2a3f" }}>
                <div className="h-2 rounded-full" style={{
                  width: "52%",
                  background: "linear-gradient(90deg,#3a8a5a,#5ea87a)",
                  boxShadow: "0 0 10px rgba(94,168,122,0.4)",
                }} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Tata Bahasa", pct: 72, color: "#6b9cda" },
                  { label: "Kosakata",    pct: 88, color: "#5ea87a" },
                  { label: "Reading",     pct: 54, color: "#e07b4a" },
                ].map(({ label, pct, color }) => (
                  <div key={label} className="rounded-lg p-2.5 text-center"
                    style={{ background: "#1f2a3f" }}>
                    <p className="text-sm font-bold mb-0.5" style={{ color, fontFamily: "var(--font-jakarta)" }}>
                      {pct}%
                    </p>
                    <p className="text-[9px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
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
        style={{ background: "radial-gradient(circle at 40% 40%,#4a7abf,transparent 60%)" }} />

      <div className="relative w-full max-w-lg flex flex-col gap-6">

        {/* Back */}
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] text-[#4a5a7a] hover:text-[#bbc6e2] transition-colors self-start"
          style={{ fontFamily: "var(--font-space)" }}>
          <ChevronLeft className="size-3.5" /> HAPUS SEMUA & ULANG
        </button>

        {/* Photos strip — multiple thumbnails + add button */}
        <div className="p-4 rounded-2xl flex flex-col gap-3"
          style={{ background: "#101b30", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
              FOTO SOAL
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: "rgba(107,156,218,0.15)", color: "#6b9cda", fontFamily: "var(--font-space)" }}>
              {files.length} {files.some(f => f.mimeType.includes("wordprocessingml")) ? "bagian" : "foto"}
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {files.map((f, idx) => (
              <div key={idx} className="relative shrink-0 group/thumb">
                <div className="size-16 rounded-xl overflow-hidden flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#1a2a3f,#0a1525)" }}>
                  {f.url
                    ? <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                    : f.mimeType.includes("wordprocessingml")
                      ? <span className="text-[10px] font-bold text-[#5ea87a] text-center px-1">DOC</span>
                      : <span className="text-[10px] font-bold text-[#6b9cda] text-center px-1">PDF</span>
                  }
                </div>
                <button
                  onClick={() => onRemoveFile(idx)}
                  className="absolute -top-1.5 -right-1.5 size-4.5 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                  style={{ background: "#dc5050" }}>
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
              style={{ background: "#1f2a3f", border: "1.5px dashed rgba(107,156,218,0.3)" }}>
              <span className="text-lg text-[#4a5a7a]">+</span>
              <span className="text-[8px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>TAMBAH</span>
            </button>
            {/* Camera button */}
            <button
              onClick={onCamera}
              className="size-16 rounded-xl shrink-0 flex flex-col items-center justify-center gap-1 transition-all hover:brightness-110"
              style={{ background: "#1f2a3f", border: "1.5px dashed rgba(107,156,218,0.2)" }}>
              <Camera className="size-5 text-[#4a5a7a]" />
              <span className="text-[8px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>KAMERA</span>
            </button>
          </div>
          <p className="text-[11px] text-[#5ea87a]" style={{ fontFamily: "var(--font-manrope)" }}>
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
          <p className="text-xs font-bold text-[#bbc6e2] mb-3"
            style={{ fontFamily: "var(--font-space)" }}>
            INI SOAL LEVEL BERAPA?
          </p>
          <div className="flex gap-2">
            {levels.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                style={level === l
                  ? { background: "linear-gradient(135deg,#1a3a6f,#2f5a9a)", color: "#d7e2ff", border: "1px solid rgba(107,156,218,0.4)" }
                  : { background: "#101b30", color: "#4a5a7a", border: "1px solid rgba(255,255,255,0.04)" }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <p className="text-xs font-bold text-[#bbc6e2] mb-1"
            style={{ fontFamily: "var(--font-space)" }}>
            KATEGORI SOALNYA APA?
          </p>
          <p className="text-[11px] text-[#4a5a7a] mb-3">
            Kalau tidak tahu, pilih "AI deteksi" — Sensei yang akan tentukan sendiri.
          </p>
          <div className="flex gap-2">
            {categories.map(({ value, label, sub }) => (
              <button key={value} onClick={() => setCategory(value)}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all"
                style={category === value
                  ? { background: value === "ai" ? "rgba(166,123,212,0.15)" : "rgba(107,156,218,0.12)", color: value === "ai" ? "#a67bd4" : "#6b9cda", border: `1px solid ${value === "ai" ? "rgba(166,123,212,0.4)" : "rgba(107,156,218,0.35)"}` }
                  : { background: "#101b30", color: "#4a5a7a", border: "1px solid rgba(255,255,255,0.04)" }}>
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
            ? { background: "linear-gradient(135deg,#1a3a6f,#2f5a9a)", color: "#d7e2ff", boxShadow: "0 0 20px rgba(74,122,191,0.25)" }
            : { background: "#101b30", color: "#2a354b", cursor: "not-allowed" }}>
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
          style={{ background: "radial-gradient(circle,#4a7abf,transparent 70%)" }} />

        {/* Image preview — real uploaded photo */}
        <div className="w-full max-w-[260px] aspect-[3/4] rounded-2xl relative overflow-hidden shrink-0"
          style={{ background: "linear-gradient(135deg,#1a2a3f,#0a1525)" }}>
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
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            <span className="text-[11px] text-[#5ea87a] font-semibold"
              style={{ fontFamily: "var(--font-space)" }}>AI ENGINE AKTIF</span>
            {total > 1 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: "rgba(107,156,218,0.15)", color: "#6b9cda", fontFamily: "var(--font-space)" }}>
                FOTO {currentIdx}/{total}
              </span>
            )}
          </div>
          <h2 className="text-[1.7rem] font-extrabold text-[#d7e2ff] leading-tight"
            style={{ fontFamily: "var(--font-jakarta)" }}>
            {total > 1 ? `Foto ${currentIdx} dari ${total}` : "Sensei sedang"}
            <br />
            <span style={{
              background: "linear-gradient(135deg,#d7e2ff,#6b8cba)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              menganalisis...
            </span>
          </h2>
        </div>

        {/* Timer + kata counter */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "#101b30" }}>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>WAKTU BERJALAN</span>
            <span className="text-2xl font-black tabular-nums"
              style={{ fontFamily: "var(--font-space)", color: elapsed > 60 ? "#e07b4a" : "#6b9cda" }}>
              {mm}:{ss}
            </span>
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span className="text-[10px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>FOTO</span>
            <span className="text-2xl font-black text-[#6b9cda]"
              style={{ fontFamily: "var(--font-space)" }}>
              {currentIdx}/{total}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-[11px] mb-2"
            style={{ fontFamily: "var(--font-space)" }}>
            <span className="text-[#4a5a7a]">Status Pemrosesan</span>
            <span className="text-[#bbc6e2] font-semibold">{Math.round(fakeProgress)}%</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: "#1f2a3f" }}>
            <div className="h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${fakeProgress}%`, background: "linear-gradient(90deg,#4a7abf,#bbc6e2)" }} />
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
                  ? <CheckCircle2 className="size-4 text-[#5ea87a] shrink-0" />
                  : active
                    ? <Loader2 className="size-4 text-[#4a7abf] shrink-0 animate-spin" />
                    : <Circle className="size-4 text-[#2a354b] shrink-0" />}
                <span className={`text-sm ${done ? "text-[#d7e2ff]" : active ? "text-[#8a9bbf]" : "text-[#4a5a7a]"}`}
                  style={{ fontFamily: "var(--font-manrope)" }}>
                  {label}
                </span>
                {active && (
                  <span className="ml-auto text-[10px] text-[#4a7abf] animate-pulse"
                    style={{ fontFamily: "var(--font-space)" }}>
                    PROSES...
                  </span>
                )}
              </div>
            );
          })}

          {/* rotating patience message */}
          <div className="mt-1 rounded-xl p-3 transition-all duration-500"
            style={{ background: "#1f2a3f", border: "1px solid rgba(107,156,218,0.08)" }}>
            <p className="text-base mb-1">{msg.icon}</p>
            <p className="text-[12px] text-[#bbc6e2] leading-relaxed"
              style={{ fontFamily: "var(--font-manrope)" }}>
              {msg.text}
            </p>
            <div className="flex gap-1 mt-2.5">
              {waitingMessages.map((_, i) => (
                <div key={i} className="h-0.5 flex-1 rounded-full transition-all duration-300"
                  style={{ background: i === msgIdx ? "#6b9cda" : "rgba(255,255,255,0.06)" }} />
              ))}
            </div>
          </div>

          {onCancel && (
            <button onClick={onCancel}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
              style={{ background: "rgba(220,80,80,0.1)", color: "#dc5050", border: "1px solid rgba(220,80,80,0.2)", fontFamily: "var(--font-space)" }}>
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
  const [answers,      setAnswers]      = useState<Record<number, string>>({});
  const [revealed,     setRevealed]     = useState<Set<number>>(new Set());
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
  const [kamusWords,   setKamusWords]   = useState<{id:string;kanji:string;reading:string|null;meaning:string}[]>([]);
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
          <rt style={{ color: "#8ab4e8", fontSize: "0.55em", fontWeight: 500, letterSpacing: 0 }}>{m[2]}</rt>
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
      if (data) setKamusWords(prev => [data as {id:string;kanji:string;reading:string|null;meaning:string}, ...prev]);
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
      const { data } = await supabase
        .from("saved_words")
        .select("id, kanji, reading, meaning")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setKamusWords((data ?? []) as {id:string;kanji:string;reading:string|null;meaning:string}[]);
      setKamusLoaded(true);
    })();
  }, [rightTab, kamusLoaded]);

  /* Save score + gain XP once all questions are revealed */
  useEffect(() => {
    const total = result.questions.length;
    if (revealed.size < total || scoreSaved || !sessionId) return;

    async function saveScoreAndXp() {
      const correctCount = result.questions.filter((q, qi) => {
        const userAns = answers[qi];
        return userAns && userAns === q.correct;
      }).length;

      const xpGain = correctCount * 10 + 5; // 10 per correct + 5 partisipasi

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles").select("xp").eq("id", user.id).single();
        const currentXp = profile?.xp ?? 0;

        await Promise.all([
          supabase.from("sessions")
            .update({ score: correctCount })
            .eq("id", sessionId),
          supabase.from("profiles")
            .update({ xp: currentXp + xpGain })
            .eq("id", user.id),
        ]);

        setScoreSaved(true);
        setToast({ text: `+${xpGain} XP — ${correctCount}/${total} benar`, ok: true });
        setTimeout(() => setToast(null), 3000);
      } catch {
        // gagal simpan skor — silent
      }
    }

    saveScoreAndXp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed.size, scoreSaved, sessionId]);

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
      setCatatanList(prev => [{ id: "temp", judul, isi, updated_at: new Date().toISOString() }, ...prev]);
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
        const w = inserted ?? { id: `local-${jp}`, kanji: jp, reading, meaning };
        return [w as {id:string;kanji:string;reading:string|null;meaning:string}, ...prev];
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
    if (revealed.has(qi) && !isReview) return;
    setAnswers(a => ({ ...a, [qi]: id }));
  };
  const reveal = (qi: number) => setRevealed(r => new Set([...r, qi]));

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
    <div className="flex-1 flex min-h-0 overflow-hidden relative">

      {/* Toast notification */}
      {toast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl text-sm font-semibold animate-fadeIn"
          style={{
            background: toast.ok ? "rgba(94,168,122,0.95)" : "rgba(192,80,80,0.95)",
            color: "#fff",
            backdropFilter: "blur(12px)",
            fontFamily: "var(--font-manrope)",
            boxShadow: toast.ok ? "0 4px 24px rgba(94,168,122,0.4)" : "0 4px 24px rgba(192,80,80,0.4)",
          }}>
          {toast.ok ? <BookmarkCheck className="size-4 shrink-0" /> : <X className="size-4 shrink-0" />}
          {toast.text}
        </div>
      )}

      {/* ── Left: All Questions ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pb-16 lg:pb-0"
        style={{ background: "transparent" }}>

        {/* Sticky header */}
        <div className="sticky top-0 z-10 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3 flex-wrap"
          style={{ background: "rgba(2,8,16,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(107,156,218,0.1)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>{result.title}</h2>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                style={{ background: "#1f2a3f", color: "#6b9cda", fontFamily: "var(--font-space)" }}>
                {result.questions.length} soal
              </span>
              {revealed.size > 0 && (
                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                  style={{ background: "rgba(94,168,122,0.15)", color: "#5ea87a", fontFamily: "var(--font-space)" }}>
                  {revealed.size} dijawab
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Timer + toggle */}
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
              style={{ background: "#1f2a3f" }}>
              <span className="text-[10px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>⏱</span>
              <span className="text-[13px] font-black text-[#6b9cda] tabular-nums w-[3.5rem]"
                style={{ fontFamily: "var(--font-jakarta)" }}>
                {timerOn ? formatTime(elapsed) : "—:——"}
              </span>
              <button
                onClick={() => setTimerOn(v => !v)}
                className="ml-1 text-[9px] px-1.5 py-0.5 rounded font-bold transition-colors"
                style={{
                  background: timerOn ? "rgba(107,156,218,0.2)" : "rgba(74,90,122,0.2)",
                  color: timerOn ? "#6b9cda" : "#4a5a7a",
                  fontFamily: "var(--font-space)",
                }}>
                {timerOn ? "ON" : "OFF"}
              </button>
            </div>
            {/* Saved badge */}
            {isSaved ? (
              <a href="/riwayat-soal"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:brightness-110"
                style={{
                  background: "rgba(94,168,122,0.15)",
                  color: "#5ea87a",
                  border: "1px solid rgba(94,168,122,0.3)",
                  fontFamily: "var(--font-space)",
                }}>
                <span className="size-1.5 rounded-full bg-[#5ea87a] shadow-[0_0_6px_#5ea87a]" />
                TERSIMPAN · LIHAT RIWAYAT →
              </a>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "#1f2a3f", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                <Loader2 className="size-3 animate-spin" /> Menyimpan...
              </div>
            )}
            <button onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#4a5a7a] hover:text-[#8a9bbf] transition-colors"
              style={{ fontFamily: "var(--font-space)" }}>
              <RotateCcw className="size-3" /> Upload Baru
            </button>
          </div>
        </div>

        {/* Category + review filters */}
        {(() => {
          const cats = ["全部", ...Array.from(new Set(result.questions.map(q => q.category).filter(Boolean)))];
          const reviewCount = result.questions.filter(q => q.needs_review).length;
          const hasCatFilter = cats.length > 2;
          if (!hasCatFilter && reviewCount === 0) return null;
          return (
            <div className="flex items-center gap-2 px-4 md:px-8 pt-4 md:pt-6 pb-0 flex-wrap">
              {hasCatFilter && cats.map(c => (
                <button key={c} onClick={() => setCatFilter(c!)}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  style={catFilter === c
                    ? { background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", color: "#071327", fontFamily: "var(--font-space)" }
                    : { background: "#101b30", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                  {c} {c !== "全部" && `(${result.questions.filter(q => q.category === c).length})`}
                </button>
              ))}
              {reviewCount > 0 && (
                <button onClick={() => setReviewOnly(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ml-auto"
                  style={reviewOnly
                    ? { background: "linear-gradient(135deg,#dc5050,#e07b4a)", color: "#fff", fontFamily: "var(--font-space)" }
                    : { background: "rgba(224,123,74,0.12)", color: "#e07b4a", border: "1px solid rgba(224,123,74,0.25)", fontFamily: "var(--font-space)" }}>
                  <Flag className="size-3" />
                  {reviewOnly ? "TAMPILKAN SEMUA" : `PERLU REVIEW (${reviewCount})`}
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
              const accentColors = ["#4a7abf","#8b5abf","#3a9a7a","#c0844a","#c05abf","#4a9abf","#7a8abf","#5a7abf"];
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
                  {showPassageCard && q.passage && (
                    <div className="rounded-2xl md:rounded-3xl overflow-hidden"
                      style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(94,168,122,0.25)", boxShadow: "0 0 30px rgba(94,168,122,0.06)" }}>
                      <div className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between border-b gap-2 flex-wrap"
                        style={{ borderColor: "rgba(94,168,122,0.15)" }}>
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-lg flex items-center justify-center"
                            style={{ background: "rgba(74,222,128,0.2)", boxShadow: "0 0 14px rgba(74,222,128,0.25)" }}>
                            <BookOpen className="size-3.5" style={{ color: "#4ade80" }} />
                          </div>
                          <span className="text-xs font-black tracking-wider"
                            style={{ fontFamily: "var(--font-space)", color: "#4ade80", textShadow: "0 0 10px rgba(74,222,128,0.4)" }}>
                            📖 TEKS BACAAN · 読解
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const pKey = `p-${qi}`;
                            return (
                              <button
                                onClick={() => toggleFurigana(pKey, q.passage!)}
                                disabled={furiganaLoading.has(pKey)}
                                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all disabled:opacity-50"
                                style={{ background: showFurigana.has(pKey) ? "rgba(138,180,232,0.18)" : "rgba(138,180,232,0.08)", color: "#8ab4e8", fontFamily: "var(--font-space)" }}>
                                {furiganaLoading.has(pKey) ? <Loader2 className="size-3 animate-spin" /> : "ふ"}
                                {furiganaLoading.has(pKey) ? "MEMUAT…" : showFurigana.has(pKey) ? "FURIGANA ✓" : "FURIGANA"}
                              </button>
                            );
                          })()}
                          <button
                            onClick={() => setExpandedPassages(s => { const n = new Set(s); n.has(qi) ? n.delete(qi) : n.add(qi); return n; })}
                            className="text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all"
                            style={{ background: "rgba(94,168,122,0.1)", color: "#5ea87a", fontFamily: "var(--font-space)" }}>
                            {isPassageCollapsed ? "TAMPILKAN ▼" : "SEMBUNYIKAN ▲"}
                          </button>
                        </div>
                      </div>
                      {!isPassageCollapsed && (() => {
                        const pKey = `p-${qi}`;
                        return (
                          <div className="px-4 md:px-6 py-4 md:py-5 whitespace-pre-wrap font-medium"
                            style={{ fontFamily: "var(--font-jakarta)", color: "#f0fdf4", fontSize: "clamp(14px,3.8vw,17px)", lineHeight: showFurigana.has(pKey) ? 2.6 : 2 }}>
                            {showFurigana.has(pKey) && furiganaMarked[pKey]
                              ? renderPassage(furiganaMarked[pKey])
                              : q.passage}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ── Question card ── */}
                  <div className="rounded-3xl overflow-hidden transition-all"
                    style={{
                      background: isRevealed ? `rgba(16,27,48,0.75)` : "rgba(16,27,48,0.55)",
                      backdropFilter: "blur(16px)",
                      WebkitBackdropFilter: "blur(16px)",
                      border: `1px solid ${isRevealed ? `${accent}45` : "rgba(107,156,218,0.12)"}`,
                      boxShadow: isRevealed ? `0 0 40px ${accent}20, 0 4px 24px rgba(0,0,0,0.3)` : "0 4px 16px rgba(0,0,0,0.2)",
                    }}>

                  {/* Question header strip */}
                  <div className="px-4 md:px-6 py-4 md:py-5 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.08]"
                      style={{ background: `radial-gradient(circle at top left,${accent},transparent 60%)` }} />
                    <div className="absolute top-0 left-0 w-1 h-full rounded-l-3xl"
                      style={{ background: `linear-gradient(180deg,${accent},${accent}40)` }} />

                    <div className="relative flex items-start gap-3 md:gap-4">
                      {/* Number badge */}
                      <div className="size-8 md:size-9 rounded-xl flex items-center justify-center text-xs md:text-sm font-black shrink-0 mt-0.5"
                        style={{ background: `${accent}20`, color: accent, fontFamily: "var(--font-space)" }}>
                        {qi + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {q.category && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold inline-block"
                              style={{ background: `${accent}20`, color: accent, fontFamily: "var(--font-space)" }}>
                              {q.category}
                            </span>
                          )}
                          {(() => {
                            const qKey = `q-${qi}`;
                            return (
                              <button
                                onClick={() => toggleFurigana(qKey, q.question)}
                                disabled={furiganaLoading.has(qKey)}
                                className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold transition-all disabled:opacity-50"
                                style={{ background: showFurigana.has(qKey) ? "rgba(138,180,232,0.22)" : "rgba(138,180,232,0.1)", color: "#8ab4e8", fontFamily: "var(--font-space)" }}>
                                {furiganaLoading.has(qKey) ? <Loader2 className="size-2.5 animate-spin" /> : "ふ"}
                                {furiganaLoading.has(qKey) ? "SOAL…" : showFurigana.has(qKey) ? "SOAL ✓" : "SOAL"}
                              </button>
                            );
                          })()}
                          {(() => {
                            const optKeys = q.options.map((_, oi) => `o-${qi}-${oi}`);
                            const allShowing = optKeys.every(k => showFurigana.has(k));
                            const anyLoading = optKeys.some(k => furiganaLoading.has(k));
                            return (
                              <button
                                onClick={() => toggleAllOptions(qi, q.options)}
                                disabled={anyLoading}
                                className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold transition-all disabled:opacity-50"
                                style={{ background: allShowing ? "rgba(166,123,212,0.22)" : "rgba(166,123,212,0.1)", color: "#a67bd4", fontFamily: "var(--font-space)" }}>
                                {anyLoading ? <Loader2 className="size-2.5 animate-spin" /> : "ふ"}
                                {anyLoading ? "OPSI…" : allShowing ? "OPSI ✓" : "OPSI"}
                              </button>
                            );
                          })()}
                          <div className="flex items-center gap-1.5 ml-auto">
                            <button onClick={() => toggleReviewFlag(qi)}
                              disabled={savingFlagIdx === qi}
                              title={q.needs_review ? "Sudah ditandai perlu review — klik untuk lepas" : "Tandai soal ini perlu direview/diedit"}
                              className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold transition-all hover:brightness-110 disabled:opacity-50"
                              style={q.needs_review
                                ? { background: "rgba(224,123,74,0.2)", color: "#e07b4a", border: "1px solid rgba(224,123,74,0.35)", fontFamily: "var(--font-space)" }
                                : { background: "rgba(74,90,122,0.12)", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                              <Flag className="size-2.5" />
                              {q.needs_review ? "REVIEW ✓" : "REVIEW"}
                            </button>
                            <button onClick={() => openEdit(qi)}
                              title="Edit soal manual"
                              className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold transition-all hover:brightness-110"
                              style={{ background: "rgba(107,156,218,0.12)", color: "#6b9cda", fontFamily: "var(--font-space)" }}>
                              <Pencil className="size-2.5" /> EDIT
                            </button>
                            <button onClick={() => deleteQuestion(qi)}
                              title="Hapus soal ini"
                              className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold transition-all hover:brightness-110"
                              style={{ background: "rgba(220,80,80,0.12)", color: "#dc5050", fontFamily: "var(--font-space)" }}>
                              <Trash2 className="size-2.5" />
                            </button>
                          </div>
                        </div>
                        {/* Question text — blanks highlighted, with optional furigana */}
                        {(() => {
                          const qKey = `q-${qi}`;
                          const useFuri = showFurigana.has(qKey) && furiganaMarked[qKey];
                          return (
                            <p className="font-bold"
                              style={{ fontFamily: "var(--font-jakarta)", color: "#f8faff", fontSize: useFuri ? "clamp(15px,3.6vw,17px)" : "clamp(16px,4vw,18px)", lineHeight: useFuri ? 2.4 : 1.6 }}>
                              {useFuri ? renderPassage(furiganaMarked[qKey]) : renderQuestion(q.question, accent)}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                {/* Options */}
                <div className="px-4 md:px-6 pb-4 md:pb-5 flex flex-col gap-2 md:gap-2.5">
                  {q.options.map((opt, oi) => {
                    const id = opt.charAt(0);
                    const isSelected = userAns === id;
                    const isCorrect = id === q.correct;
                    const optText = opt.slice(2).trim();
                    const opKey = `o-${qi}-${oi}`;
                    const useFuri = showFurigana.has(opKey) && furiganaMarked[opKey];

                    let bg = "rgba(99,102,241,0.06)";
                    let border = "rgba(129,140,248,0.18)";
                    let textColor = "#e0e7ff";
                    let numBg = "rgba(129,140,248,0.18)";
                    let numColor = "#a5b4fc";
                    let shadow = "none";
                    let icon = null as React.ReactNode;

                    if (isRevealed && isCorrect) {
                      bg = "rgba(74,222,128,0.18)"; border = "rgba(74,222,128,0.55)";
                      textColor = "#f0fdf4"; numBg = "rgba(74,222,128,0.35)"; numColor = "#4ade80";
                      shadow = "0 0 24px rgba(74,222,128,0.25), inset 0 0 16px rgba(74,222,128,0.05)";
                      icon = <Check className="size-5 shrink-0" style={{ color: "#4ade80" }} />;
                    } else if (isRevealed && isSelected && !isCorrect) {
                      bg = "rgba(248,113,113,0.15)"; border = "rgba(248,113,113,0.5)";
                      textColor = "#fef2f2"; numBg = "rgba(248,113,113,0.3)"; numColor = "#f87171";
                      shadow = "0 0 20px rgba(248,113,113,0.2)";
                      icon = <X className="size-5 shrink-0" style={{ color: "#f87171" }} />;
                    } else if (isRevealed && !isCorrect) {
                      bg = "rgba(100,116,139,0.05)"; border = "rgba(100,116,139,0.15)";
                      textColor = "#94a3b8";
                    } else if (!isRevealed && isSelected) {
                      bg = `${accent}25`; border = `${accent}80`;
                      textColor = "#ffffff"; numBg = `${accent}50`; numColor = "#ffffff";
                      shadow = `0 0 24px ${accent}40, inset 0 0 12px ${accent}10`;
                    }

                    return (
                      <div key={opt} className="relative group/opt">
                        <button
                          onClick={() => pick(qi, id)}
                          disabled={isRevealed && !isReview}
                          className={`w-full flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 md:py-4 rounded-xl md:rounded-2xl text-left transition-all duration-200 ${(isRevealed && !isReview) ? "cursor-default" : "hover:brightness-125 hover:scale-[1.01] active:scale-[0.99]"}`}
                          style={{ background: bg, border: `1.5px solid ${border}`, color: textColor, boxShadow: shadow }}>
                          <span className="size-8 md:size-9 rounded-lg md:rounded-xl flex items-center justify-center text-sm md:text-base font-black shrink-0"
                            style={{ background: numBg, color: numColor, fontFamily: "var(--font-space)" }}>
                            {id}
                          </span>
                          <span className="flex-1 font-semibold pr-2 md:pr-8"
                            style={{ fontFamily: "var(--font-jakarta)", fontSize: useFuri ? "clamp(13px,3.4vw,15px)" : "clamp(14px,3.8vw,16px)", lineHeight: useFuri ? 2.2 : 1.5 }}>
                            {useFuri ? renderPassage(furiganaMarked[opKey]) : optText}
                          </span>
                          {icon}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(optText, `Opsi ${id} tersalin`); }}
                          title="Salin teks opsi ini"
                          className="absolute top-2 right-2 size-7 rounded-lg flex items-center justify-center opacity-0 group-hover/opt:opacity-100 transition-all hover:bg-white/10"
                          style={{ background: "rgba(8,16,36,0.6)" }}>
                          <Copy className="size-3 text-[#bbc6e2]" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Reveal CTA — locked until user picks an answer */}
                {!isRevealed && (
                  <div className="px-4 md:px-6 pb-4 md:pb-6 flex flex-col gap-2">
                    {!userAns && (
                      <p className="text-center text-[11px] font-semibold"
                        style={{ fontFamily: "var(--font-space)", color: "#94a3b8" }}>
                        💪 Pilih jawaban dulu sebelum lihat pembahasan
                      </p>
                    )}
                    <button
                      onClick={() => reveal(qi)}
                      className="w-full py-3 md:py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm font-black tracking-wider transition-all hover:brightness-125 hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        background: `linear-gradient(135deg,${accent}60,${accent}30)`,
                        color: "#ffffff",
                        border: `1.5px solid ${accent}90`,
                        boxShadow: `0 0 28px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.1)`,
                        fontFamily: "var(--font-space)",
                        textShadow: `0 0 12px ${accent}90`,
                        cursor: "pointer",
                      }}>
                      🔥 LIHAT JAWABAN &amp; PEMBAHASAN ↓
                    </button>
                  </div>
                )}

                {/* Explanation */}
                {isRevealed && (
                  <div className="mx-4 md:mx-6 mb-4 md:mb-6 rounded-xl md:rounded-2xl overflow-hidden"
                    style={{ border: "1px solid rgba(255,255,255,0.05)" }}>

                    {/* Jawaban benar */}
                    <div className="px-4 md:px-5 py-3.5 md:py-4 flex items-center gap-2.5 md:gap-3"
                      style={{ background: "rgba(74,222,128,0.12)", borderBottom: "1px solid rgba(74,222,128,0.2)" }}>
                      <div className="size-8 md:size-9 rounded-lg md:rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "rgba(74,222,128,0.25)", boxShadow: "0 0 16px rgba(74,222,128,0.3)" }}>
                        <Check className="size-4 md:size-5" style={{ color: "#4ade80" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black tracking-widest"
                          style={{ fontFamily: "var(--font-space)", color: "#4ade80", textShadow: "0 0 10px rgba(74,222,128,0.4)" }}>
                          ✨ JAWABAN BENAR
                        </p>
                        {(() => {
                          const correctOpt = q.options.find(o => o.startsWith(q.correct));
                          const correctText = correctOpt?.slice(2).trim() ?? "";
                          const correctIdx = q.options.findIndex(o => o.startsWith(q.correct));
                          const opKey = `o-${qi}-${correctIdx}`;
                          const useFuri = showFurigana.has(opKey) && furiganaMarked[opKey];
                          return (
                            <p className="font-bold" style={{ fontFamily: "var(--font-jakarta)", color: "#f8faff", fontSize: useFuri ? "clamp(13px,3.4vw,15px)" : "clamp(14px,3.8vw,16px)", lineHeight: useFuri ? 2.2 : 1.5 }}>
                              Pilihan {q.correct} — {useFuri ? renderPassage(furiganaMarked[opKey]) : correctText}
                            </p>
                          );
                        })()}
                      </div>
                      <button onClick={() => {
                        const correctOpt = q.options.find(o => o.startsWith(q.correct));
                        const correctText = correctOpt?.slice(2).trim() ?? "";
                        copyToClipboard(`Pilihan ${q.correct} — ${correctText}`, "Jawaban tersalin");
                      }}
                        title="Salin jawaban"
                        className="size-8 rounded-lg flex items-center justify-center shrink-0 transition-all hover:brightness-110"
                        style={{ background: "rgba(74,222,128,0.18)" }}>
                        <Copy className="size-3.5 text-[#4ade80]" />
                      </button>
                    </div>

                    {/* Kenapa benar */}
                    <div className="px-4 md:px-5 py-3.5 md:py-4" style={{ background: "rgba(20,60,35,0.32)", borderBottom: "1px solid rgba(74,222,128,0.15)" }}>
                      <p className="text-[11px] font-black mb-2 tracking-wider"
                        style={{ fontFamily: "var(--font-space)", color: "#4ade80", textShadow: "0 0 12px rgba(74,222,128,0.4)" }}>
                        💡 KENAPA BENAR?
                      </p>
                      <p className="leading-relaxed font-medium" style={{ color: "#ecfdf5", fontSize: "clamp(13px,3.6vw,15px)" }}>{q.explanation}</p>
                    </div>

                    {/* Kenapa salah */}
                    {q.why_wrong && (
                      <div className="px-4 md:px-5 py-3.5 md:py-4" style={{ background: "rgba(60,20,25,0.32)", borderBottom: "1px solid rgba(248,113,113,0.15)" }}>
                        <p className="text-[11px] font-black mb-2 tracking-wider"
                          style={{ fontFamily: "var(--font-space)", color: "#f87171", textShadow: "0 0 12px rgba(248,113,113,0.4)" }}>
                          ✗ KENAPA PILIHAN LAIN SALAH?
                        </p>
                        <p className="leading-relaxed font-medium" style={{ color: "#fef2f2", fontSize: "clamp(13px,3.6vw,15px)" }}>{q.why_wrong}</p>
                      </div>
                    )}

                    {/* Grammar points */}
                    {q.grammar_points && q.grammar_points.length > 0 && (
                      <div className="px-4 md:px-5 py-3.5 md:py-4" style={{ background: "rgba(25,40,80,0.4)", borderBottom: "1px solid rgba(129,140,248,0.18)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[11px] font-black tracking-wider"
                            style={{ fontFamily: "var(--font-space)", color: "#a5b4fc", textShadow: "0 0 12px rgba(129,140,248,0.4)" }}>
                            📚 POIN GRAMMAR / KOSAKATA
                          </p>
                          <span className="text-[10px] text-[#2a354b]" style={{ fontFamily: "var(--font-space)" }}>
                            + simpan ke kamus
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {q.grammar_points.map((gp, i) => {
                            const isSavedWord = savedWords.has(gp.jp);
                            const isSavingThis = savingWord === gp.jp;
                            return (
                            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl group/chip"
                              style={{ background: isSavedWord ? "rgba(94,168,122,0.12)" : "#1f2a3f",
                                border: isSavedWord ? "1px solid rgba(94,168,122,0.25)" : "1px solid transparent" }}>
                              <div className="flex flex-col leading-tight">
                                <span className="text-sm font-bold"
                                  style={{ fontFamily: "var(--font-jakarta)", color: isSavedWord ? "#5ea87a" : "#d7e2ff" }}>{gp.jp}</span>
                                {gp.reading && (
                                  <span className="text-[10px] text-[#4a5a7a]">{gp.reading}</span>
                                )}
                              </div>
                              <span className="text-xs text-[#4a5a7a]">=</span>
                              <span className="text-xs text-[#8a9bbf]">{gp.id}</span>
                              <button
                                onClick={() => saveWord(gp.jp, gp.id)}
                                disabled={isSavedWord || isSavingThis}
                                className="ml-1 transition-all disabled:opacity-50"
                                title={isSavedWord ? "Sudah di kamus" : "Simpan ke Kamus"}>
                                {isSavingThis
                                  ? <Loader2 className="size-3.5 text-[#4a5a7a] animate-spin" />
                                  : isSavedWord
                                    ? <BookmarkCheck className="size-3.5 text-[#5ea87a]" />
                                    : <BookmarkPlus className="size-3.5 text-[#4a5a7a] hover:text-[#6b9cda] transition-colors" />}
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Tip */}
                    {q.tip && (
                      <div className="px-4 md:px-5 py-3.5 md:py-4" style={{ background: "rgba(55,38,8,0.35)" }}>
                        <p className="text-[11px] font-black mb-2 tracking-wider"
                          style={{ fontFamily: "var(--font-space)", color: "#fbbf24", textShadow: "0 0 12px rgba(251,191,36,0.4)" }}>
                          🎯 TIPS & TRIK UJIAN
                        </p>
                        <p className="leading-relaxed font-medium" style={{ color: "#fef3c7", fontSize: "clamp(13px,3.6vw,15px)" }}>{q.tip}</p>
                      </div>
                    )}

                    {/* ── Simpan ke Catatan ── */}
                    <div className="px-4 md:px-5 py-3" style={{ borderTop: "1px solid rgba(107,156,218,0.06)" }}>
                      <button
                        onClick={() => saveNoteToCatatan(qi, q)}
                        disabled={savedNotes.has(qi) || savingNote === qi}
                        className="flex items-center gap-1.5 text-[11px] font-bold transition-all disabled:opacity-50 hover:brightness-110"
                        style={savedNotes.has(qi)
                          ? { color: "#5ea87a", fontFamily: "var(--font-space)" }
                          : { color: "#a67bd4", fontFamily: "var(--font-space)" }}>
                        {savingNote === qi
                          ? <Loader2 className="size-3 animate-spin" />
                          : savedNotes.has(qi) ? "✓" : "📝"}
                        {savedNotes.has(qi) ? "TERSIMPAN DI CATATAN" : savingNote === qi ? "MENYIMPAN…" : "SIMPAN KE CATATAN"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </div>
            );
          });
        })()}

        {/* ── Tambah soal: manual / dari file ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <input ref={addPhotoRef} type="file"
            accept="image/*,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden" onChange={onAddPhotoChange} />
          <button onClick={openAddManual} disabled={addingPhoto}
            className="flex items-center justify-center gap-2 py-3 md:py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
            style={{ background: "rgba(94,168,122,0.12)", color: "#5ea87a", border: "1px dashed rgba(94,168,122,0.35)", fontFamily: "var(--font-space)" }}>
            <Plus className="size-4" /> TAMBAH SOAL MANUAL
          </button>
          <button onClick={() => addPhotoRef.current?.click()}
            disabled={addingPhoto}
            title="Upload foto/PDF/Word — AI analisis & append ke sesi ini"
            className="flex items-center justify-center gap-2 py-3 md:py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
            style={{ background: "rgba(107,156,218,0.12)", color: "#6b9cda", border: "1px dashed rgba(107,156,218,0.35)", fontFamily: "var(--font-space)" }}>
            {addingPhoto
              ? <><Loader2 className="size-4 animate-spin" /> MENGANALISIS…</>
              : <><Upload className="size-4" /> TAMBAH DARI FILE</>}
          </button>
        </div>
        </div>

        {/* ── Kosakata dari Foto ── */}
        {result.vocabulary && result.vocabulary.length > 0 && (
          <div className="px-4 md:px-8 pb-8 md:pb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-bold text-[#4a5a7a]"
                style={{ fontFamily: "var(--font-space)" }}>KOSAKATA DARI FOTO</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: "#1f2a3f", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                {result.vocabulary.length} kata
              </span>
              <span className="text-[9px] text-[#2a354b]"
                style={{ fontFamily: "var(--font-space)" }}>— tersimpan otomatis ke Kamus</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.vocabulary.map((v, i) => (
                <div key={i} className="p-3 md:p-4 rounded-xl md:rounded-2xl flex flex-col gap-1.5 md:gap-2 relative"
                  style={{ background: "rgba(16,27,48,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(107,156,218,0.15)" }}>
                  {/* Level badge */}
                  {v.jlpt_level && (
                    <span className="absolute top-2.5 md:top-3 right-2.5 md:right-3 text-[9px] px-1.5 py-0.5 rounded font-bold"
                      style={{ background: "#1f2a3f", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                      {v.jlpt_level}
                    </span>
                  )}
                  {/* Furigana */}
                  <p className="text-[11px] text-[#4a5a7a] leading-none"
                    style={{ fontFamily: "var(--font-jakarta)" }}>{v.reading}</p>
                  {/* Word */}
                  <p className="text-xl md:text-2xl font-black text-[#d7e2ff] leading-none"
                    style={{ fontFamily: "var(--font-jakarta)" }}>{v.word}</p>
                  {/* Meaning */}
                  <p className="text-[13px] md:text-sm text-[#8a9bbf] leading-snug">{v.meaning}</p>
                  {/* Example */}
                  {v.example && (
                    <div className="mt-1 pl-2 border-l-2"
                      style={{ borderColor: "rgba(107,156,218,0.3)" }}>
                      <p className="text-xs text-[#4a5a7a] italic leading-relaxed"
                        style={{ fontFamily: "var(--font-jakarta)" }}>{v.example}</p>
                    </div>
                  )}
                  {/* Auto-saved indicator */}
                  <div className="flex items-center gap-1 mt-1">
                    <BookmarkCheck className="size-3 text-[#5ea87a]" />
                    <span className="text-[9px] text-[#5ea87a]"
                      style={{ fontFamily: "var(--font-space)" }}>TERSIMPAN</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>

      {/* ── Right: Chat + Kamus Panel (desktop only) ── */}
      <div className="hidden lg:flex w-[320px] shrink-0 flex-col border-l"
        style={{ background: "rgba(8,16,36,0.7)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderColor: "rgba(107,156,218,0.12)" }}>

        {/* Tab switcher */}
        <div className="flex border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <button onClick={() => setRightTab("chat")}
            className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[11px] font-bold transition-all"
            style={rightTab === "chat"
              ? { color: "#6b9cda", borderBottom: "2px solid #6b9cda", fontFamily: "var(--font-space)" }
              : { color: "#4a5a7a", borderBottom: "2px solid transparent", fontFamily: "var(--font-space)" }}>
            <MessageCircle className="size-3.5" /> SENSEI
          </button>
          <button onClick={() => setRightTab("kamus")}
            className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[11px] font-bold transition-all"
            style={rightTab === "kamus"
              ? { color: "#a67bd4", borderBottom: "2px solid #a67bd4", fontFamily: "var(--font-space)" }
              : { color: "#4a5a7a", borderBottom: "2px solid transparent", fontFamily: "var(--font-space)" }}>
            <BookOpen className="size-3.5" /> KAMUS
          </button>
          <button onClick={() => setRightTab("catatan")}
            className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[11px] font-bold transition-all"
            style={rightTab === "catatan"
              ? { color: "#5ea87a", borderBottom: "2px solid #5ea87a", fontFamily: "var(--font-space)" }
              : { color: "#4a5a7a", borderBottom: "2px solid transparent", fontFamily: "var(--font-space)" }}>
            <NotebookPen className="size-3.5" /> CATATAN
          </button>
        </div>

        {/* ── Tab: Chat ── */}
        {rightTab === "chat" && (<>
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {chatMsgs.length === 0 && (
              <div className="flex flex-col gap-2">
                {[
                  "Kenapa jawaban ini benar?",
                  "Kasih contoh kalimat lain",
                  "Jelasin grammar-nya lebih detail",
                ].map(s => (
                  <button key={s} onClick={() => { setChatInput(s); }}
                    className="text-left px-3 py-2 rounded-xl text-xs text-[#8a9bbf] hover:text-[#d7e2ff] hover:bg-white/5 transition-all"
                    style={{ background: "#1f2a3f", fontFamily: "var(--font-manrope)" }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {chatMsgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed"
                  style={m.role === "user"
                    ? { background: "linear-gradient(135deg,#2f4865,#1a2a3f)", color: "#d7e2ff", fontFamily: "var(--font-manrope)" }
                    : { background: "#1f2a3f", color: "#8a9bbf", fontFamily: "var(--font-manrope)" }}>
                  {m.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl" style={{ background: "#1f2a3f" }}>
                  <Loader2 className="size-3 text-[#4a5a7a] animate-spin" />
                </div>
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#1f2a3f" }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Tanya tentang soal ini..."
                className="flex-1 text-xs text-[#d7e2ff] placeholder-[#2a354b] bg-transparent outline-none"
                style={{ fontFamily: "var(--font-manrope)" }}
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                className="size-6 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:brightness-125"
                style={{ background: "linear-gradient(135deg,#2f4865,#4a7abf)" }}>
                <Send className="size-3 text-white" />
              </button>
            </div>
          </div>
        </>)}

        {/* ── Tab: Kamus ── */}
        {rightTab === "kamus" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search */}
            <div className="px-3 py-3 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#1f2a3f" }}>
                <Search className="size-3.5 text-[#4a5a7a] shrink-0" />
                <input
                  value={kamusQuery}
                  onChange={e => setKamusQuery(e.target.value)}
                  placeholder="Cari kata..."
                  className="flex-1 text-xs text-[#d7e2ff] placeholder-[#2a354b] bg-transparent outline-none"
                  style={{ fontFamily: "var(--font-manrope)" }}
                />
                {kamusQuery && <button onClick={() => setKamusQuery("")}><X className="size-3 text-[#4a5a7a]" /></button>}
              </div>
            </div>

            {/* Add word form */}
            <div className="px-3 py-3 border-b shrink-0 flex flex-col gap-2" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <div className="flex gap-1.5">
                <input
                  value={addKanji}
                  onChange={e => setAddKanji(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && generateWordInfo()}
                  placeholder="Ketik kata/kanji..."
                  className="flex-1 px-3 py-2 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none"
                  style={{ background: "#1f2a3f", fontFamily: "var(--font-jakarta)" }}
                />
                <button onClick={generateWordInfo} disabled={!addKanji.trim() || generating}
                  className="px-3 py-2 rounded-xl text-[10px] font-bold transition-all disabled:opacity-40 flex items-center gap-1 shrink-0"
                  style={{ background: "rgba(166,123,212,0.2)", color: "#a67bd4", fontFamily: "var(--font-space)" }}>
                  {generating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  {generating ? "" : "AUTO"}
                </button>
              </div>
              {(addReading || addMeaning) && (
                <div className="flex flex-col gap-1.5">
                  <input
                    value={addReading}
                    onChange={e => setAddReading(e.target.value)}
                    placeholder="Cara baca (hiragana)"
                    className="w-full px-3 py-1.5 rounded-lg text-xs text-[#a67bd4] placeholder-[#2a354b] outline-none"
                    style={{ background: "rgba(166,123,212,0.08)", fontFamily: "var(--font-jakarta)" }}
                  />
                  <input
                    value={addMeaning}
                    onChange={e => setAddMeaning(e.target.value)}
                    placeholder="Arti"
                    className="w-full px-3 py-1.5 rounded-lg text-xs text-[#d7e2ff] placeholder-[#2a354b] outline-none"
                    style={{ background: "#1f2a3f", fontFamily: "var(--font-manrope)" }}
                  />
                  <button onClick={saveNewWord} disabled={!addMeaning.trim() || savingNew}
                    className="w-full py-2 rounded-xl text-[10px] font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                    style={{ background: "rgba(94,168,122,0.2)", color: "#5ea87a", fontFamily: "var(--font-space)" }}>
                    {savingNew ? <Loader2 className="size-3 animate-spin" /> : <BookmarkPlus className="size-3" />}
                    SIMPAN KE KAMUS
                  </button>
                </div>
              )}
            </div>

            {/* Word list */}
            <div className="flex-1 overflow-y-auto">
              {!kamusLoaded ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="size-4 text-[#4a5a7a] animate-spin" />
                </div>
              ) : kamusWords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 px-4 text-center">
                  <BookOpen className="size-7 text-[#2a354b]" />
                  <p className="text-xs text-[#4a5a7a]">Kamus kosong. Simpan kata dari soal dulu.</p>
                </div>
              ) : (
                kamusWords
                  .filter(w => {
                    const q = kamusQuery.toLowerCase();
                    return !q || w.kanji.includes(kamusQuery) || (w.reading ?? "").includes(kamusQuery) || w.meaning.toLowerCase().includes(q);
                  })
                  .map(w => (
                    <div key={w.id} className="px-4 py-3 border-b hover:bg-white/[0.02] transition-colors"
                      style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-bold text-[#d7e2ff]"
                          style={{ fontFamily: "var(--font-jakarta)" }}>{w.kanji}</span>
                        {w.reading && (
                          <span className="text-[10px] text-[#a67bd4]">{w.reading}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#4a5a7a] leading-snug">{w.meaning.split(";")[0]}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Catatan ── */}
        {rightTab === "catatan" && (
          <div className="flex-1 flex flex-col min-h-0">

            {/* Header + tombol + */}
            <div className="px-3 py-2.5 border-b flex items-center justify-between shrink-0"
              style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <span className="text-[10px] font-bold text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
                {catatanList.length} catatan
              </span>
              <button onClick={() => { setNewNoteOpen(o => !o); setNewNoteText(""); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all hover:brightness-110"
                style={{ background: "rgba(94,168,122,0.15)", color: "#5ea87a", fontFamily: "var(--font-space)" }}>
                <Plus className="size-3" /> BARU
              </button>
            </div>

            {/* Form tambah catatan */}
            {newNoteOpen && (
              <div className="px-3 py-3 border-b flex flex-col gap-2 shrink-0"
                style={{ borderColor: "rgba(255,255,255,0.04)", background: "rgba(94,168,122,0.04)" }}>
                <textarea
                  autoFocus
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                  placeholder="Tulis catatanmu..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#d7e2ff] placeholder-[#2a354b] outline-none resize-none leading-relaxed"
                  style={{ background: "#101b30", border: "1px solid rgba(94,168,122,0.2)", fontFamily: "var(--font-manrope)" }}
                />
                <div className="flex gap-2">
                  <button onClick={() => { setNewNoteOpen(false); setNewNoteText(""); }}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                    style={{ background: "#101b30", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                    BATAL
                  </button>
                  <button onClick={addNewNote} disabled={!newNoteText.trim() || savingNewNote}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                    style={{ background: "rgba(94,168,122,0.2)", color: "#5ea87a", fontFamily: "var(--font-space)" }}>
                    {savingNewNote ? <Loader2 className="size-3 animate-spin" /> : null}
                    SIMPAN
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {!catatanLoaded ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="size-4 text-[#4a5a7a] animate-spin" />
                </div>
              ) : catatanList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 px-4 text-center">
                  <NotebookPen className="size-7 text-[#2a354b]" />
                  <p className="text-xs text-[#4a5a7a]">Belum ada catatan. Klik "Simpan ke Catatan" di tiap soal.</p>
                </div>
              ) : catatanList.map(c => (
                <div key={c.id} className="border-b" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                  <button
                    onClick={() => setExpandedNote(expandedNote === c.id ? null : c.id)}
                    className="w-full px-4 py-3 text-left flex items-start gap-2.5 hover:bg-white/[0.02] transition-colors">
                    <NotebookPen className="size-3.5 text-[#5ea87a] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#d7e2ff] truncate" style={{ fontFamily: "var(--font-jakarta)" }}>{c.judul || "Catatan"}</p>
                      <p className="text-[10px] text-[#4a5a7a] mt-0.5">
                        {new Date(c.updated_at).toLocaleDateString("id-ID", { day:"numeric", month:"short" })}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#4a5a7a] shrink-0">{expandedNote === c.id ? "▲" : "▼"}</span>
                  </button>
                  {expandedNote === c.id && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-[#8a9bbf] leading-relaxed whitespace-pre-wrap"
                        style={{ fontFamily: "var(--font-manrope)" }}>{c.isi}</p>
                      <a href="/catatan"
                        className="mt-2 inline-block text-[10px] text-[#5ea87a] hover:underline"
                        style={{ fontFamily: "var(--font-space)" }}>
                        Buka di Catatan →
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Edit Modal per Soal ─── */}
      {editIdx !== null && editDraft && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => !editSaving && closeEdit()} />
          <div className="fixed z-50 inset-0 flex items-center justify-center p-2 md:p-4 pointer-events-none">
            <div className="w-full max-w-2xl rounded-2xl md:rounded-3xl overflow-hidden pointer-events-auto shadow-2xl max-h-[94vh] md:max-h-[92vh] flex flex-col"
              style={{ background: "rgba(8,16,36,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}>

              {/* Header */}
              <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-5 border-b shrink-0"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 md:size-9 rounded-lg md:rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(107,156,218,0.18)" }}>
                    <Pencil className="size-3.5 md:size-4 text-[#6b9cda]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#d7e2ff]" style={{ fontFamily: "var(--font-jakarta)" }}>
                      {editIdx >= result.questions.length ? "Tambah Soal Manual" : `Edit Soal #${editIdx + 1}`}
                    </p>
                    <p className="text-[10px] text-[#4a5a7a]">
                      {editIdx >= result.questions.length
                        ? "Ketik soal + opsi + jawaban + penjelasan dari nol"
                        : "Perbaiki field manual kalau AI kurang akurat"}
                    </p>
                  </div>
                </div>
                <button onClick={closeEdit} disabled={editSaving}
                  className="size-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors disabled:opacity-30">
                  <X className="size-4 text-[#4a5a7a]" />
                </button>
              </div>

              {/* Form */}
              <div className="overflow-y-auto px-4 md:px-6 py-4 md:py-5 flex flex-col gap-3.5 md:gap-4">

                {/* Perlu review checkbox */}
                <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer"
                  style={{ background: editDraft.needs_review ? "rgba(224,123,74,0.12)" : "#101b30", border: `1px solid ${editDraft.needs_review ? "rgba(224,123,74,0.3)" : "rgba(255,255,255,0.04)"}` }}>
                  <input type="checkbox"
                    checked={!!editDraft.needs_review}
                    onChange={e => setEditDraft(d => d ? { ...d, needs_review: e.target.checked } : d)}
                    className="accent-[#e07b4a]"
                  />
                  <Flag className="size-3.5 text-[#e07b4a]" />
                  <span className="text-xs font-bold text-[#d7e2ff]" style={{ fontFamily: "var(--font-space)" }}>
                    TANDAI PERLU REVIEW
                  </span>
                </label>

                {/* Soal */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-[#bbc6e2]" style={{ fontFamily: "var(--font-space)" }}>
                      SOAL (TEKS PERTANYAAN)
                    </label>
                    {(() => {
                      const canSplit = !!splitInlineOptions(editDraft.question);
                      return (
                        <button
                          type="button"
                          disabled={!canSplit}
                          onClick={() => {
                            const split = splitInlineOptions(editDraft.question);
                            if (!split) return;
                            setEditDraft(d => d ? { ...d, question: split.question, options: split.options } : d);
                            setToast({ text: "Opsi dipisahkan dari soal", ok: true });
                            setTimeout(() => setToast(null), 1800);
                          }}
                          title={canSplit ? "Deteksi pola 1…2…3…4… di teks soal lalu pindahkan ke field opsi" : "Tidak ada pola opsi yang terdeteksi di teks soal"}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-30"
                          style={{
                            background: canSplit ? "rgba(107,156,218,0.12)" : "#101b30",
                            color: canSplit ? "#6b9cda" : "#4a5a7a",
                            border: `1px solid ${canSplit ? "rgba(107,156,218,0.3)" : "rgba(255,255,255,0.04)"}`,
                            fontFamily: "var(--font-space)",
                          }}>
                          PISAHKAN OPSI
                        </button>
                      );
                    })()}
                  </div>
                  <textarea
                    value={editDraft.question}
                    onChange={e => setEditDraft(d => d ? { ...d, question: e.target.value } : d)}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none resize-y"
                    style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-jakarta)" }}
                  />
                </div>

                {/* Options */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block" style={{ fontFamily: "var(--font-space)" }}>
                    PILIHAN JAWABAN
                  </label>
                  <div className="flex flex-col gap-2">
                    {editDraft.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button onClick={() => setEditDraft(d => d ? { ...d, correct: String(oi + 1) } : d)}
                          title={`Tandai sebagai jawaban benar`}
                          className="size-6 rounded-md flex items-center justify-center shrink-0 transition-all"
                          style={editDraft.correct === String(oi + 1)
                            ? { background: "#5ea87a", color: "#fff" }
                            : { background: "#101b30", color: "#4a5a7a", border: "1px solid rgba(255,255,255,0.06)" }}>
                          {editDraft.correct === String(oi + 1) ? <Check className="size-3.5" /> : oi + 1}
                        </button>
                        <input
                          value={opt}
                          onChange={e => setEditDraft(d => {
                            if (!d) return d;
                            const next = [...d.options];
                            next[oi] = e.target.value;
                            return { ...d, options: next };
                          })}
                          className="flex-1 px-3 py-2 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none"
                          style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-jakarta)" }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#4a5a7a] mt-1.5">Klik nomor di kiri buat tandai jawaban benar (sekarang: <span className="text-[#5ea87a] font-bold">{editDraft.correct}</span>)</p>
                </div>

                {/* Explanation */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block" style={{ fontFamily: "var(--font-space)" }}>
                    PENJELASAN
                  </label>
                  <textarea
                    value={editDraft.explanation}
                    onChange={e => setEditDraft(d => d ? { ...d, explanation: e.target.value } : d)}
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none resize-y leading-relaxed"
                    style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-manrope)" }}
                  />
                </div>

                {/* Why wrong */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block" style={{ fontFamily: "var(--font-space)" }}>
                    KENAPA PILIHAN LAIN SALAH
                  </label>
                  <textarea
                    value={editDraft.why_wrong ?? ""}
                    onChange={e => setEditDraft(d => d ? { ...d, why_wrong: e.target.value } : d)}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none resize-y leading-relaxed"
                    style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-manrope)" }}
                  />
                </div>

                {/* Tip */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block" style={{ fontFamily: "var(--font-space)" }}>
                    TIPS UJIAN
                  </label>
                  <textarea
                    value={editDraft.tip ?? ""}
                    onChange={e => setEditDraft(d => d ? { ...d, tip: e.target.value } : d)}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none resize-y leading-relaxed"
                    style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-manrope)" }}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block" style={{ fontFamily: "var(--font-space)" }}>
                    KATEGORI
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {(["文法","語彙","文字","読解"] as const).map(c => (
                      <button key={c} onClick={() => setEditDraft(d => d ? { ...d, category: c } : d)}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                        style={editDraft.category === c
                          ? { background: "linear-gradient(135deg,#1a3a6f,#2f5a9a)", color: "#d7e2ff", border: "1px solid rgba(107,156,218,0.4)", fontFamily: "var(--font-space)" }
                          : { background: "#101b30", color: "#4a5a7a", border: "1px solid rgba(255,255,255,0.04)", fontFamily: "var(--font-space)" }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-2.5 md:gap-3 px-4 md:px-6 py-3.5 md:py-4 border-t shrink-0"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <button onClick={closeEdit} disabled={editSaving}
                  className="flex-1 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all disabled:opacity-40"
                  style={{ background: "#101b30", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                  Batal
                </button>
                <button onClick={saveEdit}
                  disabled={editSaving || !editDraft.question.trim() || !editDraft.explanation.trim()}
                  className="flex-1 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 hover:brightness-110"
                  style={{ background: "linear-gradient(135deg,#1a3a6f,#2f5a9a)", color: "#d7e2ff", fontFamily: "var(--font-space)" }}>
                  {editSaving
                    ? <><Loader2 className="size-4 animate-spin" /> Menyimpan...</>
                    : <><Save className="size-4" /> SIMPAN</>}
                </button>
              </div>
            </div>
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
            <Camera className="size-4 text-[#6b9cda]" />
            <span className="text-sm font-bold text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>Ambil Foto dengan Kamera</span>
          </div>
          <button onClick={onClose}
            className="size-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
            <X className="size-4 text-[#8a9bbf]" />
          </button>
        </div>

        {/* Video / error */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          {camError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <Camera className="size-10 text-[#4a5a7a]" />
              <p className="text-sm text-[#8a9bbf]" style={{ fontFamily: "var(--font-manrope)" }}>{camError}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted
                className="w-full h-full object-cover" />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-8 text-[#4a7abf] animate-spin" />
                </div>
              )}
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Footer */}
        <div className="px-5 py-5 flex items-center justify-center gap-4">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#8a9bbf] hover:text-[#d7e2ff] transition-colors"
            style={{ background: "#1f2a3f", fontFamily: "var(--font-space)" }}>
            BATAL
          </button>
          <button onClick={capture} disabled={!ready || !!camError}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{
              background: ready && !camError ? "linear-gradient(135deg,#1a3a6f,#2f5a9a)" : "#1f2a3f",
              color: ready && !camError ? "#d7e2ff" : "#4a5a7a",
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
    icon: "🔥", color: "#e07b4a",
    title: "Streak dalam bahaya!",
    desc: "Kamu belum latihan hari ini. Streak 7 harimu akan putus tengah malam.",
    time: "1 jam lalu",
  },
  {
    id: 2, read: false,
    icon: "🗂️", color: "#6b9cda",
    title: "5 kata perlu direview",
    desc: "諦める・把握・一生懸命 dan 2 lainnya sudah waktunya diulang hari ini.",
    time: "3 jam lalu",
  },
  {
    id: 3, read: true,
    icon: "✨", color: "#a67bd4",
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
        setResult(data.ai_result as AIResult);
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
    <div className="flex flex-col h-screen overflow-hidden text-[#d7e2ff]"
      style={{ fontFamily: "var(--font-manrope)" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 shrink-0 border-b"
        style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-4 md:gap-8">
          <a href="/" className="flex items-center gap-2.5">
            <div className="relative size-7 flex items-center justify-center">
              <div className="absolute inset-0 rounded-lg opacity-60 blur-sm"
                style={{ background: "linear-gradient(135deg,#4a7abf,#8b5abf)" }} />
              <div className="relative size-7 rounded-lg flex items-center justify-center font-black text-[11px]"
                style={{ background: "linear-gradient(135deg,#1a3a6f,#3a1a6f)", border: "1px solid rgba(107,156,218,0.4)", color: "#bbc6e2" }}>先</div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-extrabold tracking-tight text-[#d7e2ff]"
                style={{ fontFamily: "var(--font-jakarta)" }}>Sensei</span>
              <span className="text-[9px] font-bold tracking-widest"
                style={{ fontFamily: "var(--font-space)", color: "#4a7abf" }}>JLPT · AI</span>
            </div>
          </a>
          <nav className="hidden md:flex items-center gap-0.5">
            {[
              { label: "Materi",  href: "/materi" },
              { label: "Latihan", href: "/lembar-tugas" },
              { label: "Pro",     href: "/premium" },
            ].map((item) => (
              <a key={item.label} href={item.href}
                className="px-3 py-1.5 text-sm rounded-lg text-[#8a9bbf] hover:text-[#d7e2ff] hover:bg-white/5 transition-colors">
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <a href="/premium" className="hidden sm:flex text-[11px] px-4 py-1.5 rounded-full font-medium border transition-colors hover:bg-white/5"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "#bbc6e2", fontFamily: "var(--font-space)" }}>
            Langganan
          </a>

          {/* Bell + dropdown */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(o => !o)}
              className="relative size-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
              <Bell className="size-4 text-[#8a9bbf]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 size-4 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                  style={{ background: "#e05a5a" }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />

                {/* Panel */}
                <div className="absolute right-0 top-10 z-50 w-[320px] rounded-2xl overflow-hidden shadow-2xl"
                  style={{ background: "rgba(8,16,36,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}>

                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="flex items-center gap-2">
                      <Bell className="size-3.5 text-[#6b9cda]" />
                      <span className="text-sm font-bold text-[#d7e2ff]"
                        style={{ fontFamily: "var(--font-jakarta)" }}>Notifikasi</span>
                      {unreadCount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: "rgba(224,90,90,0.2)", color: "#e05a5a", fontFamily: "var(--font-space)" }}>
                          {unreadCount} baru
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setReadIds(new Set(notifs.map(n => n.id)))}
                      className="text-[10px] text-[#4a5a7a] hover:text-[#bbc6e2] transition-colors"
                      style={{ fontFamily: "var(--font-space)" }}>
                      TANDAI SEMUA
                    </button>
                  </div>

                  {/* List */}
                  <div className="flex flex-col">
                    {notifs.map(n => {
                      const isRead = readIds.has(n.id);
                      return (
                        <button key={n.id}
                          onClick={() => setReadIds(prev => new Set([...prev, n.id]))}
                          className="flex items-start gap-3 px-4 py-3 text-left transition-all hover:bg-white/[0.03] w-full"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          {/* Dot unread */}
                          <div className="shrink-0 mt-1 size-1.5 rounded-full"
                            style={{ background: isRead ? "transparent" : "#6b9cda" }} />
                          {/* Icon */}
                          <span className="text-base shrink-0 leading-none mt-0.5">{n.icon}</span>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold mb-0.5 ${isRead ? "text-[#8a9bbf]" : "text-[#d7e2ff]"}`}
                              style={{ fontFamily: "var(--font-jakarta)" }}>
                              {n.title}
                            </p>
                            <p className="text-[11px] text-[#4a5a7a] leading-relaxed">{n.desc}</p>
                            <p className="text-[10px] mt-1" style={{ color: n.color, fontFamily: "var(--font-space)" }}>
                              {n.time}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 text-center"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <button className="text-[11px] text-[#4a5a7a] hover:text-[#6b9cda] transition-colors"
                      style={{ fontFamily: "var(--font-space)" }}>
                      LIHAT SEMUA NOTIFIKASI
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold text-[#071327] ring-2 ring-[#2f4865]"
            style={{ background: "linear-gradient(135deg,#bbc6e2,#4a7abf)" }}>A</div>
        </div>
      </header>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleFileChange} />
      <input ref={camInputRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      {/* Desktop camera modal */}
      {camModalOpen && (
        <CameraModal
          onCapture={processFile}
          onClose={() => setCamModalOpen(false)}
        />
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <Sidebar activeHref="/analisis-foto" />
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
          <div className="flex-1 flex items-center justify-center gap-3">
            <Loader2 className="size-6 text-[#4a7abf] animate-spin" />
            <span className="text-sm text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
              Memuat sesi...
            </span>
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
      </div>

      <BottomNav activeHref="/analisis-foto" />
    </div>
  );
}
