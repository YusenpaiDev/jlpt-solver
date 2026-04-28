"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, BottomNav } from "@/components/Sidebar";
import {
  Bell, Search, BookOpen, Zap,
  X, Brain, RotateCcw, CheckCircle2, XCircle,
  Trash2, Loader2, Plus, BookmarkPlus, Filter,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────── */
interface SavedWord {
  id: string;
  kanji: string;
  reading: string | null;
  meaning: string;
  example: string | null;
  level: string | null;
  image_url: string | null;
  created_at: string;
}

/* ─── Accent palette ─────────────────────────────────────────── */
const ACCENTS = [
  "#4a7abf","#8b5abf","#5ea87a","#e07b4a","#c05abf",
  "#6b9cda","#a67bd4","#4a9abf","#bbc6e2","#3a9a7a",
];
const accentFor = (idx: number) => ACCENTS[idx % ACCENTS.length];

const LEVEL_FILTERS = ["ALL","N1","N2","N3","N4","N5"];

/* ─── QuizCepat ─────────────────────────────────────────────── */
function QuizCepat({ word, allWords }: { word: SavedWord; allWords: SavedWord[] }) {
  const [phase,   setPhase]   = useState<"idle"|"answer"|"done">("idle");
  const [picked,  setPicked]  = useState<number | null>(null);
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    const correct = word.meaning.split(";")[0].trim();
    const wrong = allWords
      .filter(w => w.id !== word.id)
      .map(w => w.meaning.split(";")[0].trim())
      .filter(m => m !== correct)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    setOptions([correct, ...wrong].sort(() => Math.random() - 0.5));
    setPhase("idle");
    setPicked(null);
  }, [word.id, allWords]);

  if (options.length < 2) return null;

  const correctIdx = options.indexOf(word.meaning.split(";")[0].trim());

  return (
    <div className="p-5 rounded-2xl" style={{ background: "#101b30" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-[#a67bd4]" />
          <p className="text-xs font-bold text-[#d7e2ff]"
            style={{ fontFamily: "var(--font-jakarta)" }}>Quiz Cepat</p>
        </div>
        {phase !== "idle" && (
          <button onClick={() => { setPhase("idle"); setPicked(null); }}
            className="flex items-center gap-1 text-[10px] text-[#4a5a7a] hover:text-[#bbc6e2] transition-colors"
            style={{ fontFamily: "var(--font-space)" }}>
            <RotateCcw className="size-3" /> ULANGI
          </button>
        )}
      </div>

      {phase === "idle" ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-sm text-[#8a9bbf] text-center">
            Apa arti dari{" "}
            <span className="font-bold text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>{word.kanji}</span>?
          </p>
          <button onClick={() => setPhase("answer")}
            className="px-5 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
            style={{ background: "rgba(166,123,212,0.2)", color: "#a67bd4", fontFamily: "var(--font-space)" }}>
            MULAI QUIZ
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#4a5a7a] mb-1" style={{ fontFamily: "var(--font-space)" }}>
            Pilih arti yang tepat:
          </p>
          {options.map((opt, i) => {
            const isCorrect  = i === correctIdx;
            const isPicked   = picked === i;
            const showResult = phase === "done";
            let bg = "#0d1929", color = "#8a9bbf", border = "transparent";
            if (showResult && isCorrect)             { bg = "rgba(94,168,122,0.12)";  color = "#5ea87a"; border = "rgba(94,168,122,0.3)"; }
            if (showResult && isPicked && !isCorrect){ bg = "rgba(224,90,90,0.1)";   color = "#e05a5a"; border = "rgba(224,90,90,0.3)"; }
            return (
              <button key={i} disabled={phase === "done"}
                onClick={() => { setPicked(i); setPhase("done"); }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-left transition-all"
                style={{ background: bg, color, border: `1px solid ${border}` }}>
                {showResult && isCorrect   && <CheckCircle2 className="size-3.5 shrink-0 text-[#5ea87a]" />}
                {showResult && isPicked && !isCorrect && <XCircle className="size-3.5 shrink-0 text-[#e05a5a]" />}
                {(!showResult || (!isCorrect && !isPicked)) && (
                  <span className="size-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                    style={{ background: "rgba(187,198,226,0.06)", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                    {["A","B","C","D"][i]}
                  </span>
                )}
                <span style={{ fontFamily: "var(--font-manrope)" }}>{opt}</span>
              </button>
            );
          })}
          {phase === "done" && (
            <p className={`text-[11px] mt-1 font-semibold ${picked === correctIdx ? "text-[#5ea87a]" : "text-[#e05a5a]"}`}>
              {picked === correctIdx ? "Benar! Kamu ingat kata ini." : "Salah. Coba review sekali lagi."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function Kamus() {
  const [query,        setQuery]       = useState("");
  const [activeLevel,  setLevel]       = useState("ALL");
  const [selected,     setSelected]    = useState<string | null>(null);
  const [words,        setWords]       = useState<SavedWord[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [deletingId,   setDeletingId]  = useState<string | null>(null);
  const [addOpen,      setAddOpen]     = useState(false);
  const [adding,       setAdding]      = useState(false);
  const [addError,     setAddError]    = useState<string | null>(null);
  const [form,         setForm]        = useState({ kanji:"", reading:"", meaning:"", example:"", level:"" });
  const [formImage,    setFormImage]   = useState<File | null>(null);
  const [imagePreview, setImagePreview]= useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  /* ── Load from Supabase ── */
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("saved_words")
          .select("id, kanji, reading, meaning, example, level, image_url, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        const ws = (data ?? []) as SavedWord[];
        setWords(ws);
        if (ws.length > 0) setSelected(ws[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Filtered list ── */
  const filtered = useMemo(() => words.filter(w => {
    const q = query.toLowerCase();
    const matchQ = q === "" ||
      w.kanji.includes(query) ||
      (w.reading ?? "").includes(query) ||
      w.meaning.toLowerCase().includes(q);
    const matchL = activeLevel === "ALL" || w.level === activeLevel;
    return matchQ && matchL;
  }), [words, query, activeLevel]);

  /* ── Detail ── */
  const detailIdx = words.findIndex(w => w.id === selected);
  const detail    = detailIdx >= 0 ? words[detailIdx] : null;
  const accent    = detail ? accentFor(detailIdx) : "#4a7abf";

  /* ── Photo handler ── */
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const closeAdd = () => {
    setAddOpen(false); setAddError(null); setFormImage(null); setImagePreview(null);
    setForm({ kanji:"", reading:"", meaning:"", example:"", level:"" });
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  /* ── Add word ── */
  const addWord = async () => {
    if (!form.kanji.trim() || !form.meaning.trim()) { setAddError("単語 dan 意味 wajib diisi."); return; }
    setAdding(true); setAddError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAddError("Login dulu untuk menyimpan kata."); return; }

      let imageUrl: string | null = null;
      if (formImage) {
        const ext  = formImage.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("kamus-images").upload(path, formImage, { contentType: formImage.type });
        if (upErr) throw upErr;
        imageUrl = supabase.storage.from("kamus-images").getPublicUrl(path).data.publicUrl;
      }

      const { data, error } = await supabase.from("saved_words").insert({
        user_id: user.id,
        kanji:   form.kanji.trim(),
        reading: form.reading.trim()  || null,
        meaning: form.meaning.trim(),
        example: form.example.trim()  || null,
        level:   form.level           || null,
        image_url: imageUrl,
      }).select("id, kanji, reading, meaning, example, level, image_url, created_at").single();

      if (error) {
        if (error.code === "23505") setAddError("Kata ini sudah ada di kamus."); else throw error;
        return;
      }
      const newWord = data as SavedWord;
      setWords(w => [newWord, ...w]);
      setSelected(newWord.id);
      closeAdd();
    } catch { setAddError("Gagal menyimpan. Coba lagi."); }
    finally  { setAdding(false); }
  };

  /* ── Delete word ── */
  const deleteWord = async (id: string) => {
    setDeletingId(id);
    try {
      await createClient().from("saved_words").delete().eq("id", id);
      setWords(prev => {
        const next = prev.filter(w => w.id !== id);
        if (selected === id) setSelected(next[0]?.id ?? null);
        return next;
      });
    } finally { setDeletingId(null); }
  };

  /* ── Render ── */
  return (
    <div className="flex flex-col h-screen overflow-hidden text-[#d7e2ff]"
      style={{ fontFamily: "var(--font-manrope)" }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
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

        <Sidebar activeHref="/kamus" />

        {/* ── Split: list + detail ── */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left: search + list ── */}
          <div className="w-[300px] md:w-[340px] shrink-0 flex flex-col border-r"
            style={{ background: "#0a1525", borderColor: "rgba(255,255,255,0.03)" }}>

            {/* Search + filters */}
            <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#4a5a7a]" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Cari kanji, kana, atau arti..."
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none transition-all"
                  style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-manrope)" }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(107,156,218,0.4)"}
                  onBlur={e  => e.currentTarget.style.borderColor = "rgba(187,198,226,0.08)"}
                />
                {query && (
                  <button onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5a7a] hover:text-[#8a9bbf]">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Level filter */}
              <div className="flex gap-1 flex-wrap">
                <Filter className="size-3.5 text-[#4a5a7a] mt-1 shrink-0" />
                {LEVEL_FILTERS.map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                    style={activeLevel === l
                      ? { background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", color: "#071327", fontFamily: "var(--font-space)" }
                      : { background: "#101b30", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Count + Add */}
            <div className="px-4 py-2 border-b flex items-center justify-between"
              style={{ borderColor: "rgba(255,255,255,0.03)", background: "#0a1525" }}>
              <span className="text-xs font-semibold text-[#8a9bbf]"
                style={{ fontFamily: "var(--font-space)" }}>
                {loading ? "Memuat…" : `${filtered.length} kata`}
              </span>
              <button onClick={() => { setAddOpen(true); setAddError(null); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all hover:brightness-110"
                style={{ background: "rgba(94,168,122,0.15)", color: "#5ea87a", fontFamily: "var(--font-space)" }}>
                <Plus className="size-3" /> TAMBAH
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-5 text-[#4a5a7a] animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 px-4 text-center">
                  <BookOpen className="size-8 text-[#2a354b]" />
                  <p className="text-xs text-[#4a5a7a]">
                    {words.length === 0
                      ? "Belum ada kata tersimpan.\nAnalisis foto soal untuk auto-simpan kosakata!"
                      : "Tidak ada hasil untuk pencarian ini."}
                  </p>
                  {words.length === 0 && (
                    <a href="/analisis-foto"
                      className="text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all hover:brightness-110"
                      style={{ background: "rgba(107,156,218,0.15)", color: "#6b9cda", fontFamily: "var(--font-space)" }}>
                      BUKA ANALISIS FOTO →
                    </a>
                  )}
                </div>
              ) : (
                filtered.map((w, idx) => {
                  const wordIdx = words.findIndex(x => x.id === w.id);
                  const ac = accentFor(wordIdx);
                  return (
                    <button key={w.id} onClick={() => setSelected(w.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b hover:bg-white/[0.02]"
                      style={{
                        borderColor: "rgba(255,255,255,0.03)",
                        background: selected === w.id ? "rgba(74,122,191,0.08)" : "transparent",
                        boxShadow: selected === w.id ? "inset 2px 0 0 #4a7abf" : "none",
                      }}>
                      <div className="size-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-black overflow-hidden"
                        style={{ background: `${ac}15`, color: ac, fontFamily: "var(--font-jakarta)" }}>
                        {w.image_url
                          ? <img src={w.image_url} alt={w.kanji} className="w-full h-full object-cover" />
                          : w.kanji.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-[#d7e2ff]"
                            style={{ fontFamily: "var(--font-jakarta)" }}>{w.kanji}</span>
                          {w.level && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: `${ac}20`, color: ac, fontFamily: "var(--font-space)" }}>
                              {w.level}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#4a5a7a] truncate">
                          {w.reading ? `${w.reading} · ` : ""}{w.meaning.split(";")[0]}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteWord(w.id); }}
                        disabled={deletingId === w.id}
                        className="p-1.5 rounded-lg opacity-0 hover:opacity-100 transition-all hover:bg-red-500/10 disabled:opacity-40 shrink-0"
                        title="Hapus dari kamus">
                        {deletingId === w.id
                          ? <Loader2 className="size-3 text-[#4a5a7a] animate-spin" />
                          : <Trash2 className="size-3 text-[#dc5050]" />}
                      </button>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right: detail panel ── */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 md:py-7 pb-20 lg:pb-7 relative"
            style={{}}>

            {/* ambient */}
            <div className="pointer-events-none absolute top-0 right-0 w-[400px] h-[300px] opacity-[0.05] blur-[80px]"
              style={{ background: "radial-gradient(circle,#4a7abf,transparent 70%)" }} />

            {!detail ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                <BookOpen className="size-12 text-[#4a5a7a]" />
                <p className="text-sm text-[#4a5a7a]">
                  {loading ? "Memuat kamus…" : "Pilih kata dari daftar"}
                </p>
              </div>
            ) : (
              <div className="relative flex flex-col gap-5 max-w-2xl">

                {/* ── Header entry ── */}
                <div className="p-6 rounded-2xl relative overflow-hidden"
                  style={{ background: "#101b30" }}>
                  <div className="absolute inset-0 opacity-15"
                    style={{ background: `radial-gradient(circle at top right,${accent}50,transparent 65%)` }} />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 md:gap-5 flex-1 min-w-0">
                      {/* Big kanji */}
                      <div className="size-20 md:size-28 rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden"
                        style={{ background: `${accent}18`, boxShadow: `0 0 40px ${accent}30` }}>
                        {detail.image_url ? (
                          <img src={detail.image_url} alt={detail.kanji} className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <div className="absolute inset-0"
                              style={{ background: `radial-gradient(circle,${accent}25,transparent 70%)` }} />
                            <span className="relative font-black leading-none select-none"
                              style={{ fontSize: "3.5rem", color: accent, fontFamily: "var(--font-jakarta)", textShadow: `0 0 30px ${accent}80` }}>
                              {detail.kanji.charAt(0)}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-[#d7e2ff] leading-none mb-2"
                          style={{ fontFamily: "var(--font-jakarta)" }}>{detail.kanji}</h2>
                        {detail.reading && (
                          <p className="text-base md:text-lg text-[#8a9bbf] mb-1">{detail.reading}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {detail.level && (
                            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                              style={{ background: `${accent}25`, color: accent, fontFamily: "var(--font-space)" }}>
                              JLPT {detail.level}
                            </span>
                          )}
                          <span className="text-[10px] px-2.5 py-1 rounded-full"
                            style={{ background: "#1f2a3f", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                            {new Date(detail.created_at).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Delete action */}
                    <button
                      onClick={() => deleteWord(detail.id)}
                      disabled={deletingId === detail.id}
                      className="size-9 rounded-xl flex items-center justify-center transition-all hover:bg-red-500/10 disabled:opacity-40 shrink-0"
                      style={{ background: "rgba(8,16,36,0.55)" }}
                      title="Hapus dari kamus">
                      {deletingId === detail.id
                        ? <Loader2 className="size-4 text-[#4a5a7a] animate-spin" />
                        : <Trash2 className="size-4 text-[#dc5050]" />}
                    </button>
                  </div>
                </div>

                {/* ── Arti ── */}
                <div className="p-5 rounded-2xl" style={{ background: "#101b30" }}>
                  <p className="text-[10px] font-bold text-[#4a5a7a] mb-2"
                    style={{ fontFamily: "var(--font-space)" }}>ARTI</p>
                  <p className="text-base text-[#d7e2ff] leading-relaxed"
                    style={{ fontFamily: "var(--font-jakarta)" }}>{detail.meaning}</p>
                </div>

                {/* ── Contoh kalimat (jika ada) ── */}
                {detail.example && (
                  <div className="p-5 rounded-2xl" style={{ background: "#101b30" }}>
                    <p className="text-[10px] font-bold text-[#4a5a7a] mb-3"
                      style={{ fontFamily: "var(--font-space)" }}>CONTOH KALIMAT</p>
                    <div className="p-4 rounded-2xl relative overflow-hidden"
                      style={{ background: "rgba(8,16,36,0.55)" }}>
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-full"
                        style={{ background: accent }} />
                      <p className="text-sm text-[#d7e2ff] leading-relaxed"
                        style={{ fontFamily: "var(--font-jakarta)" }}>{detail.example}</p>
                    </div>
                  </div>
                )}

                {/* ── Kata terkait (same level) ── */}
                {(() => {
                  const related = words
                    .filter(w => w.id !== detail.id && w.level === detail.level && w.level)
                    .slice(0, 4);
                  if (related.length === 0) return null;
                  return (
                    <div className="p-5 rounded-2xl" style={{ background: "#101b30" }}>
                      <p className="text-[10px] font-bold text-[#4a5a7a] mb-3"
                        style={{ fontFamily: "var(--font-space)" }}>
                        KATA LAIN LEVEL {detail.level}
                      </p>
                      <div className="flex flex-col gap-2">
                        {related.map(w => {
                          const ri = words.findIndex(x => x.id === w.id);
                          const ra = accentFor(ri);
                          return (
                            <button key={w.id} onClick={() => setSelected(w.id)}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:brightness-110 w-full text-left"
                              style={{ background: "rgba(8,16,36,0.55)" }}>
                              <span className="font-bold" style={{ color: ra, fontFamily: "var(--font-jakarta)" }}>
                                {w.kanji}
                              </span>
                              {w.reading && (
                                <span className="text-xs text-[#4a5a7a] truncate">{w.reading}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Tip AI ── */}
                <div className="p-5 rounded-2xl relative overflow-hidden"
                  style={{ background: "rgba(8,16,36,0.55)", border: "1px solid rgba(107,156,218,0.12)" }}>
                  <div className="absolute inset-0 opacity-15"
                    style={{ background: `radial-gradient(circle at top right,${accent},transparent 70%)` }} />
                  <div className="relative flex items-start gap-3">
                    <div className="size-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${accent}20` }}>
                      <Zap className="size-4" style={{ color: accent }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#d7e2ff] mb-1.5"
                        style={{ fontFamily: "var(--font-jakarta)" }}>Tips Belajar</p>
                      <p className="text-[11px] text-[#8a9bbf] leading-relaxed">
                        Kata ini tersimpan dari sesi analisis atau kamu tambahkan sendiri.
                        Coba gunakan dalam kalimat sendiri agar lebih mudah diingat!
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Quiz Cepat ── */}
                {words.length >= 2 && <QuizCepat word={detail} allWords={words} />}

              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav activeHref="/kamus" />

      {/* ── Modal Tambah Kosakata ── */}
      {addOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={closeAdd} />
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

          <div className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-md rounded-3xl overflow-hidden pointer-events-auto shadow-2xl max-h-[90vh] flex flex-col"
              style={{ background: "rgba(8,16,36,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b shrink-0"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(94,168,122,0.15)" }}>
                    <BookmarkPlus className="size-4 text-[#5ea87a]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#d7e2ff]"
                      style={{ fontFamily: "var(--font-jakarta)" }}>Tambah Kosakata</p>
                    <p className="text-[10px] text-[#4a5a7a]">Simpan ke kamus pribadimu</p>
                  </div>
                </div>
                <button onClick={closeAdd}
                  className="size-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
                  <X className="size-4 text-[#4a5a7a]" />
                </button>
              </div>

              {/* Form */}
              <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">

                {/* 単語 */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block"
                    style={{ fontFamily: "var(--font-space)" }}>
                    単語 · KOSAKATA <span className="text-red-400">*</span>
                  </label>
                  <input autoFocus
                    value={form.kanji}
                    onChange={e => setForm(f => ({ ...f, kanji: e.target.value }))}
                    placeholder="諦める"
                    className="w-full px-4 py-2.5 rounded-xl text-lg font-bold text-[#d7e2ff] placeholder-[#2a354b] outline-none transition-all"
                    style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-jakarta)" }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(94,168,122,0.4)"}
                    onBlur={e  => e.currentTarget.style.borderColor = "rgba(187,198,226,0.08)"}
                  />
                </div>

                {/* 読み方 */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block"
                    style={{ fontFamily: "var(--font-space)" }}>
                    読み方 · CARA BACA
                  </label>
                  <input
                    value={form.reading}
                    onChange={e => setForm(f => ({ ...f, reading: e.target.value }))}
                    placeholder="あきらめる"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none transition-all"
                    style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-jakarta)" }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(107,156,218,0.4)"}
                    onBlur={e  => e.currentTarget.style.borderColor = "rgba(187,198,226,0.08)"}
                  />
                </div>

                {/* 意味 */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block"
                    style={{ fontFamily: "var(--font-space)" }}>
                    意味 · ARTI <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={form.meaning}
                    onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))}
                    placeholder="Menyerah; berhenti mencoba"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none transition-all"
                    style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-manrope)" }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(107,156,218,0.4)"}
                    onBlur={e  => e.currentTarget.style.borderColor = "rgba(187,198,226,0.08)"}
                    onKeyDown={e => e.key === "Enter" && addWord()}
                  />
                </div>

                {/* Contoh */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block"
                    style={{ fontFamily: "var(--font-space)" }}>
                    CONTOH KALIMAT
                  </label>
                  <input
                    value={form.example}
                    onChange={e => setForm(f => ({ ...f, example: e.target.value }))}
                    placeholder="諦めずに続けてください。"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none transition-all"
                    style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-jakarta)" }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(107,156,218,0.4)"}
                    onBlur={e  => e.currentTarget.style.borderColor = "rgba(187,198,226,0.08)"}
                  />
                </div>

                {/* Level */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block"
                    style={{ fontFamily: "var(--font-space)" }}>
                    LEVEL JLPT
                  </label>
                  <div className="flex gap-2">
                    {["","N1","N2","N3","N4","N5"].map(l => (
                      <button key={l} onClick={() => setForm(f => ({ ...f, level: l }))}
                        className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all"
                        style={form.level === l
                          ? { background: "linear-gradient(135deg,#1a3a6f,#2f5a9a)", color: "#d7e2ff", border: "1px solid rgba(107,156,218,0.4)", fontFamily: "var(--font-space)" }
                          : { background: "#101b30", color: "#4a5a7a", border: "1px solid rgba(255,255,255,0.04)", fontFamily: "var(--font-space)" }}>
                        {l || "—"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Foto */}
                <div>
                  <label className="text-[10px] font-bold text-[#bbc6e2] mb-1.5 block"
                    style={{ fontFamily: "var(--font-space)" }}>FOTO · OPSIONAL</label>
                  {imagePreview ? (
                    <div className="relative rounded-2xl overflow-hidden" style={{ background: "#101b30" }}>
                      <img src={imagePreview} alt="preview" className="w-full max-h-52 object-contain" />
                      <button
                        onClick={() => { setFormImage(null); setImagePreview(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                        className="absolute top-2 right-2 size-7 rounded-lg flex items-center justify-center bg-black/60 hover:bg-black/80 transition-colors">
                        <X className="size-3.5 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => photoInputRef.current?.click()}
                      className="w-full rounded-2xl flex flex-col items-center justify-center gap-2.5 py-7 transition-all hover:brightness-110"
                      style={{ background: "#101b30", border: "1.5px dashed rgba(187,198,226,0.15)" }}>
                      <div className="size-10 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(107,156,218,0.1)" }}>
                        <Plus className="size-5 text-[#6b9cda]" />
                      </div>
                      <p className="text-sm font-semibold text-[#8a9bbf]"
                        style={{ fontFamily: "var(--font-jakarta)" }}>Tap untuk tambah foto</p>
                    </button>
                  )}
                </div>

                {addError && <p className="text-xs text-red-400 px-1">{addError}</p>}

                {/* Buttons */}
                <div className="flex gap-3 pb-1">
                  <button onClick={closeAdd}
                    className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all"
                    style={{ background: "#101b30", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                    Batal
                  </button>
                  <button onClick={addWord}
                    disabled={adding || !form.kanji.trim() || !form.meaning.trim()}
                    className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#2a5a3a,#3a8a5a)", color: "#d7e2ff", fontFamily: "var(--font-space)" }}>
                    {adding
                      ? <><Loader2 className="size-4 animate-spin" /> Menyimpan...</>
                      : <><BookmarkPlus className="size-4" /> SIMPAN</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
