"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, BottomNav } from "@/components/Sidebar";
import {
  Camera, Bell, Upload, ArrowUpRight,
  CheckCircle2, Circle, Sparkles,
  ChevronLeft, RotateCcw,
  X, Check, Send, Loader2, BookmarkPlus, BookmarkCheck,
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
  grammar_points?: { jp: string; id: string }[];
  tip?: string;
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
}
interface ChatMsg {
  role: "user" | "model";
  text: string;
}


/* ─── Vocab data — sama persis dengan entri di halaman Kamus ─── */
const vocabList = [
  { kanji: "諦める",   reading: "あきらめる",         meaning: "Menyerah; berhenti mencoba; merelakan",        level: "N2", accent: "#4a7abf", example: "夢を諦めないでください。" },
  { kanji: "把握",     reading: "はあく",             meaning: "Memahami; menguasai; menggenggam",             level: "N2", accent: "#8b5abf", example: "状況を把握してください。" },
  { kanji: "一生懸命", reading: "いっしょうけんめい", meaning: "Dengan sepenuh hati; sekuat tenaga; bersungguh-sungguh", level: "N3", accent: "#5ea87a", example: "一生懸命勉強しました。" },
  { kanji: "雰囲気",   reading: "ふんいき",           meaning: "Suasana; atmosfer; aura",                      level: "N2", accent: "#e07b4a", example: "いい雰囲気のレストランだ。" },
  { kanji: "遠慮",     reading: "えんりょ",           meaning: "Sungkan; menahan diri; tidak mau merepotkan",  level: "N2", accent: "#c05abf", example: "遠慮しないでください。" },
  { kanji: "丁寧",     reading: "ていねい",           meaning: "Sopan; teliti; hati-hati",                     level: "N3", accent: "#6b9cda", example: "丁寧な言葉を使ってください。" },
  { kanji: "我慢",     reading: "がまん",             meaning: "Bersabar; menahan diri; tahan banting",        level: "N3", accent: "#bbc6e2", example: "もう我慢できない！" },
  { kanji: "複雑",     reading: "ふくざつ",           meaning: "Rumit; kompleks; pelik",                       level: "N2", accent: "#4a7abf", example: "気持ちが複雑です。" },
];



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
          <div className="mb-3 px-4 py-3 rounded-xl text-sm text-red-300"
            style={{ background: "rgba(192,80,80,0.12)", border: "1px solid rgba(192,80,80,0.2)" }}>
            {error}
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
          <p className="text-xs text-[#4a5a7a]">PNG, JPG, PDF · Maks. 10MB</p>
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
              {files.length} foto
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {files.map((f, idx) => (
              <div key={idx} className="relative shrink-0 group/thumb">
                <div className="size-16 rounded-xl overflow-hidden"
                  style={{ background: "linear-gradient(135deg,#1a2a3f,#0a1525)" }}>
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
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
function AnalyzingView({ imageUrl, currentIdx = 1, total = 1 }: { imageUrl?: string; currentIdx?: number; total?: number }) {
  const [vocabIdx,  setVocabIdx]  = useState(0);
  const [visible,   setVisible]   = useState(true);  // for fade transition
  const [stepsDone, setStepsDone] = useState(1);     // steps 0..3

  /* Animate steps finishing over time */
  useEffect(() => {
    const t = setTimeout(() => setStepsDone(2), 4000);
    const t2 = setTimeout(() => setStepsDone(3), 9000);
    const t3 = setTimeout(() => setStepsDone(4), 14000);
    return () => { clearTimeout(t); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  /* Vocab auto-rotate every 5 s with fade */
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setVocabIdx(i => (i + 1) % vocabList.length);
        setVisible(true);
      }, 350);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const steps = [
    "Membaca teks soal...",
    "Mendeteksi level JLPT...",
    "Menyusun penjelasan detail...",
    "Deteksi Multi-Soal...",
  ];

  /* Fake progress based on steps done */
  const fakeProgress = [15, 35, 65, 90][Math.min(stepsDone, 3)];

  const vocab = vocabList[vocabIdx];
  const accent = vocab.accent;

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

        {/* ── Vocab Flashcard ── */}
        <div className="w-full max-w-[320px] rounded-2xl overflow-hidden relative"
          style={{
            background: "#101b30",
            border: `1px solid ${accent}30`,
            boxShadow: `0 0 30px ${accent}10`,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.35s ease, transform 0.35s ease",
          }}>

          {/* card header */}
          <div className="px-4 py-2.5 flex items-center justify-between border-b"
            style={{ borderColor: "rgba(255,255,255,0.05)", background: "#0d1929" }}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: `${accent}20`, color: accent, fontFamily: "var(--font-space)" }}>
                JLPT {vocab.level}
              </span>
              <span className="text-[10px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
                KOSAKATA
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-[#2a354b]" style={{ fontFamily: "var(--font-space)" }}>
                {vocabIdx + 1}/{vocabList.length}
              </span>
              <button
                onClick={() => {
                  setVisible(false);
                  setTimeout(() => {
                    setVocabIdx(i => (i + 1) % vocabList.length);
                    setVisible(true);
                  }, 350);
                }}
                className="text-[9px] px-2 py-0.5 rounded-full text-[#4a5a7a] hover:text-[#8a9bbf] transition-colors"
                style={{ background: "#1f2a3f", fontFamily: "var(--font-space)" }}>
                NEXT →
              </button>
            </div>
          </div>

          {/* card body */}
          <div className="px-5 py-4">
            {/* Kanji large */}
            <p className="text-4xl font-black text-[#d7e2ff] mb-0.5"
              style={{ fontFamily: "var(--font-jakarta)", color: accent }}>
              {vocab.kanji}
            </p>
            {/* reading */}
            <p className="text-sm text-[#8a9bbf] mb-3"
              style={{ fontFamily: "var(--font-jakarta)" }}>
              {vocab.reading}
            </p>
            {/* meaning */}
            <p className="text-base font-semibold text-[#d7e2ff] mb-3"
              style={{ fontFamily: "var(--font-manrope)" }}>
              {vocab.meaning}
            </p>
            {/* example */}
            <div className="rounded-xl px-3 py-2.5"
              style={{ background: "#1f2a3f", borderLeft: `3px solid ${accent}60` }}>
              <p className="text-xs text-[#4a5a7a] mb-1" style={{ fontFamily: "var(--font-space)" }}>CONTOH</p>
              <p className="text-sm text-[#8a9bbf] leading-relaxed"
                style={{ fontFamily: "var(--font-jakarta)" }}>
                {vocab.example}
              </p>
            </div>
          </div>

          {/* progress dots */}
          <div className="px-5 pb-4 flex items-center gap-1">
            {vocabList.map((_, i) => (
              <div key={i}
                className="h-0.5 rounded-full flex-1 transition-all duration-300"
                style={{ background: i === vocabIdx ? accent : "rgba(255,255,255,0.07)" }} />
            ))}
          </div>
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

        {/* Kata counter */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "#101b30" }}>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>KATA DIHAFAL</span>
            <span className="text-2xl font-black text-[#5ea87a]"
              style={{ fontFamily: "var(--font-jakarta)" }}>
              {vocabIdx + 1} <span className="text-sm font-semibold text-[#4a5a7a]">/ {vocabList.length}</span>
            </span>
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span className="text-[10px] text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>KATA SAAT INI</span>
            <span className="text-lg font-black"
              style={{ fontFamily: "var(--font-jakarta)", color: accent }}>
              {vocab.kanji}
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

          {/* tip */}
          <div className="mt-1 rounded-xl p-3" style={{ background: "#1f2a3f" }}>
            <p className="text-[10px] font-bold text-[#bbc6e2] mb-1"
              style={{ fontFamily: "var(--font-space)" }}>
              Sambil tunggu, hafal dulu yuk 👈
            </p>
            <p className="text-[11px] text-[#8a9bbf] leading-relaxed">
              Sensei menampilkan kosakata di kiri — 1 kata tiap 5 detik. Klik NEXT kalau mau lanjut.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Result State ──────────────────────────────────────────── */
function ResultView({ onReset, result, chatMsgs, setChatMsgs, isSaved, sessionId }: {
  onReset: () => void;
  result: AIResult;
  chatMsgs: ChatMsg[];
  setChatMsgs: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  isSaved: boolean;
  sessionId: string | null;
}) {
  const [answers,      setAnswers]      = useState<Record<number, string>>({});
  const [revealed,     setRevealed]     = useState<Set<number>>(new Set());
  const [chatInput,    setChatInput]    = useState("");
  const [chatLoading,  setChatLoading]  = useState(false);
  const [elapsed,      setElapsed]      = useState(0);
  const [timerOn,      setTimerOn]      = useState(true);
  const [savedWords,   setSavedWords]   = useState<Set<string>>(new Set());
  const [savingWord,   setSavingWord]   = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ text: string; ok: boolean } | null>(null);
  const [scoreSaved,   setScoreSaved]   = useState(false);

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
      const { error } = await supabase.from("saved_words").insert({
        user_id: user.id,
        kanji: jp,
        meaning,
      });
      if (error && error.code !== "23505") throw error; // 23505 = unique violation (already saved)
      setSavedWords(s => new Set([...s, jp]));
      showToast(`${jp} ditambahkan ke Kamus ✓`, true);
    } catch {
      showToast("Gagal menyimpan, coba lagi", false);
    } finally {
      setSavingWord(null);
    }
  };

  const pick = (qi: number, id: string) => {
    if (revealed.has(qi)) return;
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
        style={{ background: "#080f1e" }}>

        {/* Sticky header */}
        <div className="sticky top-0 z-10 px-8 py-4 flex items-center justify-between"
          style={{ background: "rgba(8,15,30,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
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

        {/* Questions list */}
        <div className="flex flex-col gap-6 px-8 py-6">
          {result.questions.map((q, qi) => {
            const isRevealed = revealed.has(qi);
            const userAns = answers[qi];
            const accentColors = ["#4a7abf","#8b5abf","#3a9a7a","#c0844a","#c05abf","#4a9abf","#7a8abf","#5a7abf"];
            const accent = accentColors[qi % accentColors.length];

            return (
              <div key={qi} className="rounded-3xl overflow-hidden transition-all"
                style={{
                  background: "#101b30",
                  border: `1px solid ${isRevealed ? `${accent}30` : "rgba(255,255,255,0.05)"}`,
                  boxShadow: isRevealed ? `0 0 30px ${accent}10` : "none",
                }}>

                {/* Question header strip */}
                <div className="px-6 py-5 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-[0.04]"
                    style={{ background: `radial-gradient(circle at top left,${accent},transparent 60%)` }} />
                  <div className="absolute top-0 left-0 w-1 h-full rounded-l-3xl"
                    style={{ background: `linear-gradient(180deg,${accent},${accent}40)` }} />

                  <div className="relative flex items-start gap-4">
                    {/* Number badge */}
                    <div className="size-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 mt-0.5"
                      style={{ background: `${accent}20`, color: accent, fontFamily: "var(--font-space)" }}>
                      {qi + 1}
                    </div>

                    {/* Question text — blanks highlighted */}
                    <p className="text-[17px] font-bold text-[#d7e2ff] leading-relaxed flex-1"
                      style={{ fontFamily: "var(--font-jakarta)" }}>
                      {renderQuestion(q.question, accent)}
                    </p>
                  </div>
                </div>

                {/* Options */}
                <div className="px-6 pb-5 flex flex-col gap-2.5">
                  {q.options.map((opt) => {
                    const id = opt.charAt(0);
                    const isSelected = userAns === id;
                    const isCorrect = id === q.correct;

                    let bg = "rgba(187,198,226,0.03)";
                    let border = "rgba(187,198,226,0.07)";
                    let textColor = "#8a9bbf";
                    let numBg = "#1f2a3f";
                    let numColor = "#4a5a7a";
                    let icon = null as React.ReactNode;

                    if (isRevealed && isCorrect) {
                      bg = "rgba(94,168,122,0.12)"; border = "rgba(94,168,122,0.35)";
                      textColor = "#d7e2ff"; numBg = "rgba(94,168,122,0.25)"; numColor = "#5ea87a";
                      icon = <Check className="size-4 text-[#5ea87a] shrink-0" />;
                    } else if (isRevealed && isSelected && !isCorrect) {
                      bg = "rgba(220,80,80,0.08)"; border = "rgba(220,80,80,0.2)";
                      textColor = "#dc8080"; numBg = "rgba(220,80,80,0.2)"; numColor = "#dc5050";
                      icon = <X className="size-4 text-[#dc5050] shrink-0" />;
                    } else if (isRevealed && !isCorrect) {
                      bg = "rgba(187,198,226,0.02)"; border = "rgba(187,198,226,0.05)";
                      textColor = "#4a5a7a";
                    } else if (!isRevealed && isSelected) {
                      bg = `${accent}15`; border = `${accent}50`;
                      textColor = "#d7e2ff"; numBg = `${accent}30`; numColor = accent;
                    }

                    return (
                      <button key={opt}
                        onClick={() => pick(qi, id)}
                        disabled={isRevealed}
                        className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 ${isRevealed ? "cursor-default" : "hover:brightness-110 active:scale-[0.99]"}`}
                        style={{ background: bg, border: `1px solid ${border}`, color: textColor }}>
                        <span className="size-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                          style={{ background: numBg, color: numColor, fontFamily: "var(--font-space)" }}>
                          {id}
                        </span>
                        <span className="flex-1 text-[15px]"
                          style={{ fontFamily: "var(--font-jakarta)" }}>
                          {opt.slice(2).trim()}
                        </span>
                        {icon}
                      </button>
                    );
                  })}
                </div>

                {/* Reveal CTA — locked until user picks an answer */}
                {!isRevealed && (
                  <div className="px-6 pb-6 flex flex-col gap-2">
                    {!userAns && (
                      <p className="text-center text-[11px] text-[#4a5a7a]"
                        style={{ fontFamily: "var(--font-space)" }}>
                        Pilih jawaban dulu sebelum lihat pembahasan
                      </p>
                    )}
                    <button
                      onClick={() => userAns && reveal(qi)}
                      disabled={!userAns}
                      className="w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.99]"
                      style={userAns ? {
                        background: `linear-gradient(135deg,${accent}30,${accent}15)`,
                        color: accent, border: `1px solid ${accent}40`,
                        fontFamily: "var(--font-space)",
                        cursor: "pointer",
                      } : {
                        background: "rgba(187,198,226,0.04)",
                        color: "#2a354b", border: "1px solid rgba(187,198,226,0.06)",
                        fontFamily: "var(--font-space)",
                        cursor: "not-allowed",
                      }}>
                      {userAns ? "Lihat Jawaban & Pembahasan ↓" : "🔒 Pilih jawaban dulu"}
                    </button>
                  </div>
                )}

                {/* Explanation */}
                {isRevealed && (
                  <div className="mx-6 mb-6 rounded-2xl overflow-hidden"
                    style={{ border: "1px solid rgba(255,255,255,0.05)" }}>

                    {/* Jawaban benar */}
                    <div className="px-5 py-4 flex items-center gap-3"
                      style={{ background: "rgba(94,168,122,0.1)", borderBottom: "1px solid rgba(94,168,122,0.15)" }}>
                      <div className="size-8 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(94,168,122,0.2)" }}>
                        <Check className="size-4 text-[#5ea87a]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#5ea87a]" style={{ fontFamily: "var(--font-space)" }}>
                          JAWABAN BENAR
                        </p>
                        <p className="text-sm font-bold text-[#d7e2ff]" style={{ fontFamily: "var(--font-jakarta)" }}>
                          Pilihan {q.correct} — {q.options.find(o => o.startsWith(q.correct))?.slice(2).trim()}
                        </p>
                      </div>
                    </div>

                    {/* Kenapa benar */}
                    <div className="px-5 py-4" style={{ background: "#0d1929", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <p className="text-[11px] font-bold text-[#5ea87a] mb-2" style={{ fontFamily: "var(--font-space)" }}>
                        💡 KENAPA BENAR?
                      </p>
                      <p className="text-sm text-[#8a9bbf] leading-relaxed">{q.explanation}</p>
                    </div>

                    {/* Kenapa salah */}
                    {q.why_wrong && (
                      <div className="px-5 py-4" style={{ background: "#0d1929", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <p className="text-[11px] font-bold text-[#dc5050] mb-2" style={{ fontFamily: "var(--font-space)" }}>
                          ✗ KENAPA PILIHAN LAIN SALAH?
                        </p>
                        <p className="text-sm text-[#8a9bbf] leading-relaxed">{q.why_wrong}</p>
                      </div>
                    )}

                    {/* Grammar points */}
                    {q.grammar_points && q.grammar_points.length > 0 && (
                      <div className="px-5 py-4" style={{ background: "#0d1929", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[11px] font-bold text-[#6b9cda]" style={{ fontFamily: "var(--font-space)" }}>
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
                              <span className="text-sm font-bold"
                                style={{ fontFamily: "var(--font-jakarta)", color: isSavedWord ? "#5ea87a" : "#d7e2ff" }}>{gp.jp}</span>
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
                      <div className="px-5 py-4" style={{ background: "#0a1525" }}>
                        <p className="text-[11px] font-bold text-[#e0b45a] mb-2" style={{ fontFamily: "var(--font-space)" }}>
                          🎯 TIPS & TRIK UJIAN
                        </p>
                        <p className="text-sm text-[#8a9bbf] leading-relaxed">{q.tip}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Kosakata dari Foto ── */}
        {result.vocabulary && result.vocabulary.length > 0 && (
          <div className="px-8 pb-10">
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
                <div key={i} className="p-4 rounded-2xl flex flex-col gap-2 relative"
                  style={{ background: "#0d1929", border: "1px solid rgba(255,255,255,0.05)" }}>
                  {/* Level badge */}
                  {v.jlpt_level && (
                    <span className="absolute top-3 right-3 text-[9px] px-1.5 py-0.5 rounded font-bold"
                      style={{ background: "#1f2a3f", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                      {v.jlpt_level}
                    </span>
                  )}
                  {/* Furigana */}
                  <p className="text-[11px] text-[#4a5a7a] leading-none"
                    style={{ fontFamily: "var(--font-jakarta)" }}>{v.reading}</p>
                  {/* Word */}
                  <p className="text-2xl font-black text-[#d7e2ff] leading-none"
                    style={{ fontFamily: "var(--font-jakarta)" }}>{v.word}</p>
                  {/* Meaning */}
                  <p className="text-sm text-[#8a9bbf] leading-snug">{v.meaning}</p>
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

      {/* ── Right: Chat Panel (desktop only) ── */}
      <div className="hidden lg:flex w-[320px] shrink-0 flex-col border-l"
        style={{ background: "#0d1929", borderColor: "rgba(255,255,255,0.04)" }}>

        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#6b9cda]" />
            <p className="text-sm font-bold text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>Tanya Sensei</p>
          </div>
          <p className="text-[11px] text-[#4a5a7a] mt-0.5">
            Ada yang kurang jelas? Tanya langsung.
          </p>
        </div>

        {/* Messages */}
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

        {/* Input */}
        <div className="px-4 py-3 border-t shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "#1f2a3f" }}>
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
      </div>
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
        style={{ background: "#0d1929", border: "1px solid rgba(255,255,255,0.08)" }}>

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
  const [apiError,            setApiError]            = useState<string | null>(null);
  const [chatMsgs,            setChatMsgs]            = useState<ChatMsg[]>([]);
  const [savedSessionId,      setSavedSessionId]      = useState<string | null>(null);
  const [loadingSession,      setLoadingSession]      = useState(false);
  const [currentAnalyzingIdx, setCurrentAnalyzingIdx] = useState(0);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const camInputRef    = useRef<HTMLInputElement>(null);
  const [camModalOpen, setCamModalOpen] = useState(false);

  /* Shared: process a File object into FileData and add to state */
  const processFile = (file: File) => {
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
        .select("ai_result")
        .eq("id", id)
        .single();
      if (data?.ai_result) {
        setResult(data.ai_result as AIResult);
        setSavedSessionId(id);
        setChatMsgs([]);
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

  const handleStart = async (level: Level, category: Category) => {
    if (files.length === 0) return;
    setStage("analyzing");
    setApiError(null);
    setCurrentAnalyzingIdx(1);

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
          body: JSON.stringify({ imageBase64: fd.base64, mimeType: fd.mimeType, level, category }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Analisis gagal");
        const data: AIResult = json.data;
        if (i === 0) mainTitle = data.title;
        allQuestions.push(...data.questions);
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
      setApiError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setStage("upload");
    }
  };

  const handleReset = () => {
    setStage("upload");
    setFiles([]);
    setResult(null);
    setApiError(null);
    setChatMsgs([]);
    setSavedSessionId(null);
    setCurrentAnalyzingIdx(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.history.replaceState({}, "", "/analisis-foto");
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[#d7e2ff]"
      style={{ background: "#071327", fontFamily: "var(--font-manrope)" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 shrink-0 border-b"
        style={{ background: "#071327", borderColor: "rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-4 md:gap-8">
          <a href="/" className="flex items-center gap-2">
            <div className="size-6 rounded-md flex items-center justify-center text-[10px] font-black text-[#071327]"
              style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)" }}>S</div>
            <span className="text-sm font-bold tracking-tight text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>Sensei JLPT</span>
          </a>
          <nav className="hidden md:flex items-center gap-0.5">
            {["Materi", "Latihan", "Pro"].map((item) => (
              <button key={item}
                className="px-3 py-1.5 text-sm rounded-lg text-[#8a9bbf] hover:text-[#d7e2ff] hover:bg-white/5 transition-colors">
                {item}
              </button>
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
                  style={{ background: "#0d1929", border: "1px solid rgba(255,255,255,0.07)" }}>

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
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
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
          />
        )}
        {!loadingSession && stage === "result" && result && (
          <ResultView
            result={result}
            chatMsgs={chatMsgs}
            setChatMsgs={setChatMsgs}
            onReset={handleReset}
            isSaved={!!savedSessionId}
            sessionId={savedSessionId}
          />
        )}
      </div>

      <BottomNav activeHref="/analisis-foto" />
    </div>
  );
}
