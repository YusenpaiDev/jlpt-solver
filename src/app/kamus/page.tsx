"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import {
  Search, BookA, BookOpen, ChevronRight, ChevronLeft, Layers, Zap, Wand2, Plus, Upload,
  X, Edit3, Trash2, Calendar, Camera, Shuffle, Check, Loader2, BarChart3,
} from "lucide-react";

type Level = "N1" | "N2" | "N3" | "N4" | "N5";
type LevelFilter = Level | "ALL";

interface SavedWord {
  id: string;
  kanji: string;
  reading: string | null;
  meaning: string;
  level: string | null;
  example: string | null;
  created_at: string;
}

type SortMode = "newest" | "alpha" | "level";
type FlashMode = "picker" | "card" | null;

const ALBUM_SIZE = 50;
const DECK_COLORS = ["iris", "purple", "emerald", "amber", "rose", "iris", "emerald", "amber", "purple", "rose"] as const;
const LEVEL_OPTS: LevelFilter[] = ["ALL", "N1", "N2", "N3", "N4", "N5"];

function relativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "Hari ini";
  if (days < 2) return "Kemarin";
  if (days < 30) return `${days} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function Kamus() {
  /* Data */
  const [words, setWords] = useState<SavedWord[]>([]);
  const [loading, setLoading] = useState(true);

  /* UI state */
  const [query, setQuery] = useState("");
  const [levelF, setLevelF] = useState<LevelFilter>("ALL");
  const [sort, setSort] = useState<SortMode>("newest");
  const [activeAlbum, setActiveAlbum] = useState<"all" | number>("all");
  const [selected, setSelected] = useState<string | null>(null);

  /* Flash */
  const [flashMode, setFlashMode] = useState<FlashMode>(null);
  const [flashDeckId, setFlashDeckId] = useState<"all" | number>("all");
  const [flashIdx, setFlashIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [flashOrder, setFlashOrder] = useState<number[]>([]);

  /* Modal: add */
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [genReading, setGenReading] = useState(false);
  const [form, setForm] = useState({ kanji: "", reading: "", meaning: "", level: "", example: "" });

  /* Modal: edit */
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ kanji: "", reading: "", meaning: "", level: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editGenRead, setEditGenRead] = useState(false);

  /* Furigana batch */
  const [genAllRunning, setGenAllRunning] = useState(false);
  const [genProgress, setGenProgress] = useState(0);

  /* User bar */
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const xp = 820;
  const xpTarget = 1000;

  /* Load */
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());

        const [profileRes, wordsRes] = await Promise.all([
          supabase.from("profiles").select("streak").eq("id", user.id).single(),
          supabase
            .from("saved_words")
            .select("id, kanji, reading, meaning, level, example, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);
        if (profileRes.data) setStreak(profileRes.data.streak ?? 0);
        const ws = (wordsRes.data ?? []) as SavedWord[];
        setWords(ws);
        if (ws.length > 0) setSelected(ws[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Decks (chunks of 50) */
  const decks = useMemo(() => {
    const out: { id: number; count: number; color: typeof DECK_COLORS[number]; preview: SavedWord[]; incomplete: boolean }[] = [];
    for (let i = 0; i < words.length; i += ALBUM_SIZE) {
      const chunk = words.slice(i, i + ALBUM_SIZE);
      const id = Math.floor(i / ALBUM_SIZE) + 1;
      out.push({
        id,
        count: chunk.length,
        color: DECK_COLORS[(id - 1) % DECK_COLORS.length],
        preview: chunk.slice(0, 3),
        incomplete: chunk.length < ALBUM_SIZE,
      });
    }
    return out;
  }, [words]);

  /* Filtered + sorted list */
  const filtered = useMemo(() => {
    let result = words;

    if (activeAlbum !== "all") {
      const start = (activeAlbum - 1) * ALBUM_SIZE;
      result = result.slice(start, start + ALBUM_SIZE);
    }
    if (levelF !== "ALL") {
      result = result.filter(w => w.level === levelF);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(w =>
        w.kanji.includes(query) ||
        (w.reading ?? "").includes(query) ||
        w.meaning.toLowerCase().includes(q)
      );
    }
    if (sort === "alpha") {
      result = [...result].sort((a, b) => a.kanji.localeCompare(b.kanji, "ja"));
    } else if (sort === "level") {
      const order: Record<string, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
      result = [...result].sort((a, b) => (order[a.level ?? ""] ?? 99) - (order[b.level ?? ""] ?? 99));
    }
    return result;
  }, [words, activeAlbum, levelF, query, sort]);

  const detail = useMemo(() => words.find(w => w.id === selected) ?? null, [words, selected]);

  /* Counts per level */
  const levelCounts = useMemo(() => {
    const counts: Record<LevelFilter, number> = { ALL: words.length, N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
    words.forEach(w => {
      if (w.level && counts[w.level as Level] != null) counts[w.level as Level]++;
    });
    return counts;
  }, [words]);

  const missingFurigana = words.filter(w => !w.reading).length;

  /* ── Add word ── */
  const autoGenReadingForAdd = async () => {
    if (!form.kanji.trim() || genReading) return;
    setGenReading(true);
    try {
      const res = await fetch("/api/furigana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: form.kanji.trim(), withMeaning: !form.meaning.trim() }),
      });
      const json = await res.json();
      setForm(f => ({
        ...f,
        reading: json.reading ?? f.reading,
        meaning: !f.meaning && json.meaning ? json.meaning : f.meaning,
      }));
    } catch { /* ignore */ }
    finally { setGenReading(false); }
  };

  const closeAdd = () => {
    setAddOpen(false);
    setAddErr(null);
    setForm({ kanji: "", reading: "", meaning: "", level: "", example: "" });
  };

  const addWord = async () => {
    if (!form.kanji.trim() || !form.meaning.trim()) {
      setAddErr("Kanji dan arti wajib diisi.");
      return;
    }
    setAdding(true);
    setAddErr(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAddErr("Login dulu."); return; }
      const { data, error } = await supabase.from("saved_words").insert({
        user_id: user.id,
        kanji: form.kanji.trim(),
        reading: form.reading.trim() || null,
        meaning: form.meaning.trim(),
        level: form.level || null,
        example: form.example.trim() || null,
      }).select("id, kanji, reading, meaning, level, example, created_at").single();

      if (error) {
        setAddErr(error.code === "23505" ? "Kata ini sudah ada." : `Gagal: ${error.message}`);
        return;
      }
      const w = data as SavedWord;
      setWords(prev => [w, ...prev]);
      setSelected(w.id);
      closeAdd();
    } catch (err) {
      setAddErr(err instanceof Error ? err.message : "Error");
    } finally {
      setAdding(false);
    }
  };

  /* ── Edit ── */
  const openEdit = () => {
    if (!detail) return;
    setEditForm({
      kanji: detail.kanji,
      reading: detail.reading ?? "",
      meaning: detail.meaning,
      level: detail.level ?? "",
    });
    setEditOpen(true);
  };

  const autoGenReadingForEdit = async () => {
    if (!editForm.kanji.trim() || editGenRead) return;
    setEditGenRead(true);
    try {
      const res = await fetch("/api/furigana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: editForm.kanji.trim(), withMeaning: true }),
      });
      const json = await res.json();
      setEditForm(f => ({
        ...f,
        reading: json.reading ?? f.reading,
        meaning: json.meaning ?? f.meaning,
      }));
    } catch { /* ignore */ }
    finally { setEditGenRead(false); }
  };

  const saveEdit = async () => {
    if (!detail || !editForm.meaning.trim() || editSaving) return;
    setEditSaving(true);
    try {
      const supabase = createClient();
      await supabase.from("saved_words").update({
        reading: editForm.reading.trim() || null,
        meaning: editForm.meaning.trim(),
        level: editForm.level || null,
      }).eq("id", detail.id);
      setWords(prev => prev.map(w => w.id === detail.id
        ? { ...w, reading: editForm.reading.trim() || null, meaning: editForm.meaning.trim(), level: editForm.level || null }
        : w));
      setEditOpen(false);
    } finally {
      setEditSaving(false);
    }
  };

  /* ── Delete ── */
  const deleteWord = async (id: string) => {
    if (!confirm("Hapus kata ini dari kamus?")) return;
    try {
      await createClient().from("saved_words").delete().eq("id", id);
      setWords(prev => {
        const next = prev.filter(w => w.id !== id);
        if (selected === id) setSelected(next[0]?.id ?? null);
        return next;
      });
    } catch { /* ignore */ }
  };

  /* ── Generate all furigana ── */
  const genAllFurigana = async () => {
    const missing = words.filter(w => !w.reading);
    if (missing.length === 0 || genAllRunning) return;
    setGenAllRunning(true);
    setGenProgress(0);
    const supabase = createClient();
    for (let i = 0; i < missing.length; i++) {
      const w = missing[i];
      try {
        const res = await fetch("/api/furigana", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: w.kanji }),
        });
        const json = await res.json();
        if (json.reading) {
          await supabase.from("saved_words").update({ reading: json.reading }).eq("id", w.id);
          setWords(prev => prev.map(x => x.id === w.id ? { ...x, reading: json.reading } : x));
        }
      } catch { /* skip */ }
      setGenProgress(i + 1);
    }
    setGenAllRunning(false);
  };

  /* ── Flash mode ── */
  const openFlash = () => { setFlashMode("picker"); };
  const pickDeck = (deckId: "all" | number) => {
    setFlashDeckId(deckId);
    setFlashIdx(0);
    setFlipped(false);
    setShuffled(false);
    setFlashOrder([]);
    setFlashMode("card");
  };

  const flashWords = useMemo(() => {
    if (flashDeckId === "all") return words;
    const start = (flashDeckId - 1) * ALBUM_SIZE;
    return words.slice(start, start + ALBUM_SIZE);
  }, [flashDeckId, words]);

  const flashSequence = useMemo(() => {
    // shuffled order is precomputed in toggleShuffle (event handler — allowed
    // to be impure), so this useMemo stays pure. Fall back to natural order
    // when shuffled is off or flashOrder is stale.
    if (!shuffled || flashOrder.length !== flashWords.length) {
      return flashWords.map((_, i) => i);
    }
    return flashOrder;
  }, [shuffled, flashWords, flashOrder]);

  const flashWord = flashWords[flashSequence[flashIdx]];

  const toggleShuffle = () => {
    if (!shuffled) {
      setFlashOrder(flashWords.map((_, i) => i).sort(() => Math.random() - 0.5));
    }
    setShuffled(s => !s);
    setFlashIdx(0);
    setFlipped(false);
  };

  const flashNext = () => {
    setFlipped(false);
    setTimeout(() => setFlashIdx(i => Math.min(flashWords.length - 1, i + 1)), 60);
  };
  const flashPrev = () => {
    setFlipped(false);
    setTimeout(() => setFlashIdx(i => Math.max(0, i - 1)), 60);
  };

  /* Keyboard shortcuts for flash mode */
  useEffect(() => {
    if (flashMode !== "card") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") flashPrev();
      else if (e.key === "ArrowRight") flashNext();
      else if (e.key === " ") { e.preventDefault(); setFlipped(f => !f); }
      else if (e.key === "s" || e.key === "S") toggleShuffle();
      else if (e.key === "Escape") setFlashMode(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashMode, flashWords.length]);

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

        <header className="kk-header">
          <div>
            <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Kamus" }]} />
            <h1 className="kk-title">
              Kamus <span className="kk-title-jp">辞書</span>
            </h1>
            <p className="kk-sub">
              Kotoba pribadi kamu — auto-saved dari Analisis Foto, atau tambah sendiri.
              Pakai FLASH buat hafalan cepat — kotoba dipecah jadi dek 50 kata.
            </p>
          </div>
          <div className="kk-header-right">
            <div className="kk-count-pill">
              <span className="kk-count-num">{words.length}</span>
              <span className="kk-count-label">KATA</span>
            </div>
            {missingFurigana > 0 && (
              <button
                type="button"
                className="kk-furi-chip"
                onClick={genAllFurigana}
                disabled={genAllRunning}
              >
                <Wand2 size={11} strokeWidth={2} />
                {genAllRunning ? `FURIGANA ${genProgress}/${missingFurigana}` : "FURIGANA"}
                <span className="kk-furi-count">{missingFurigana}</span>
              </button>
            )}
          </div>
        </header>

        <div className="kk-toolbar">
          <button type="button" className="tb-btn tb-flash" onClick={openFlash} disabled={words.length === 0}>
            <span><Zap size={15} fill="currentColor" strokeWidth={0.8} />FLASH</span>
            <span className="tb-meta">Mode Hafalan</span>
          </button>
          <button type="button" className="tb-btn tb-import" disabled title="Coming soon — bulk import">
            <span><Upload size={14} strokeWidth={2} />IMPORT</span>
            <span className="tb-meta">Bulk paste / file</span>
          </button>
          <button type="button" className="tb-btn tb-tambah" onClick={() => setAddOpen(true)}>
            <span><Plus size={14} strokeWidth={2.4} />TAMBAH</span>
            <span className="tb-meta">Satu per satu</span>
          </button>
        </div>

        <div className="kk-workspace">
          <FilterRail
            decks={decks}
            activeAlbum={activeAlbum}
            setActiveAlbum={setActiveAlbum}
            levelCounts={levelCounts}
            levelF={levelF}
            setLevelF={setLevelF}
            totalWords={words.length}
          />

          <WordList
            words={filtered}
            selected={selected}
            setSelected={setSelected}
            query={query}
            setQuery={setQuery}
            sort={sort}
            setSort={setSort}
            loading={loading}
            totalWords={words.length}
          />

          {detail ? (
            <DetailCard
              word={detail}
              allWords={words}
              onEdit={openEdit}
              onDelete={() => deleteWord(detail.id)}
            />
          ) : !loading && words.length === 0 ? (
            <aside className="kk-detail">
              <div className="glass-card detail-hero">
                <div className="detail-hero-bg" />
                <p style={{ position: "relative", color: "var(--text-tertiary)", fontSize: 13, padding: "40px 20px" }}>
                  Belum ada kata. Tambah pertama lewat <strong style={{ color: "var(--accent-emerald)" }}>TAMBAH</strong>{" "}
                  atau biarkan auto-saved dari Analisis Foto.
                </p>
              </div>
            </aside>
          ) : null}
        </div>

        {/* Add modal */}
        {addOpen && (
          <div className="kk-modal-overlay" onClick={closeAdd}>
            <div className="kk-modal" onClick={e => e.stopPropagation()}>
              <div className="kk-modal-head">
                <h2>Tambah Kata Baru</h2>
                <button type="button" className="modal-close" onClick={closeAdd} aria-label="Tutup">
                  <X size={14} />
                </button>
              </div>
              <div className="kk-modal-body">
                {addErr && (
                  <p style={{ color: "var(--accent-rose)", fontSize: 12, margin: 0, padding: "8px 12px", background: "rgba(164,36,59,0.08)", borderRadius: 8 }}>
                    ⚠️ {addErr}
                  </p>
                )}
                <FieldGroup label="Kanji / Kata">
                  <input
                    className="pg-input"
                    value={form.kanji}
                    onChange={e => setForm(f => ({ ...f, kanji: e.target.value }))}
                    placeholder="密接"
                    autoFocus
                  />
                </FieldGroup>
                <FieldGroup label="Reading (furigana)" hint="kosongkan buat auto-generate">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="pg-input"
                      value={form.reading}
                      onChange={e => setForm(f => ({ ...f, reading: e.target.value }))}
                      placeholder="みっせつ"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={autoGenReadingForAdd}
                      disabled={!form.kanji.trim() || genReading}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {genReading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                      Auto
                    </button>
                  </div>
                </FieldGroup>
                <FieldGroup label="Arti">
                  <textarea
                    className="pg-input pg-textarea"
                    value={form.meaning}
                    onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))}
                    placeholder="erat, intim, berhubungan dekat"
                  />
                </FieldGroup>
                <div className="pg-field-row">
                  <FieldGroup label="Level JLPT">
                    <select
                      className="pg-input"
                      value={form.level}
                      onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                    >
                      <option value="">— pilih —</option>
                      <option value="N1">N1</option>
                      <option value="N2">N2</option>
                      <option value="N3">N3</option>
                      <option value="N4">N4</option>
                      <option value="N5">N5</option>
                    </select>
                  </FieldGroup>
                  <FieldGroup label="Contoh kalimat (opsional)">
                    <input
                      className="pg-input"
                      value={form.example}
                      onChange={e => setForm(f => ({ ...f, example: e.target.value }))}
                      placeholder="..."
                    />
                  </FieldGroup>
                </div>
              </div>
              <div className="kk-modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeAdd}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={addWord} disabled={adding}>
                  {adding ? "Menyimpan..." : "Tambah ke kamus"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editOpen && detail && (
          <div className="kk-modal-overlay" onClick={() => setEditOpen(false)}>
            <div className="kk-modal" onClick={e => e.stopPropagation()}>
              <div className="kk-modal-head">
                <h2>Edit · {detail.kanji}</h2>
                <button type="button" className="modal-close" onClick={() => setEditOpen(false)} aria-label="Tutup">
                  <X size={14} />
                </button>
              </div>
              <div className="kk-modal-body">
                <FieldGroup label="Reading">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="pg-input"
                      value={editForm.reading}
                      onChange={e => setEditForm(f => ({ ...f, reading: e.target.value }))}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={autoGenReadingForEdit}
                      disabled={editGenRead}
                    >
                      {editGenRead ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                      AI
                    </button>
                  </div>
                </FieldGroup>
                <FieldGroup label="Arti">
                  <textarea
                    className="pg-input pg-textarea"
                    value={editForm.meaning}
                    onChange={e => setEditForm(f => ({ ...f, meaning: e.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup label="Level JLPT">
                  <select
                    className="pg-input"
                    value={editForm.level}
                    onChange={e => setEditForm(f => ({ ...f, level: e.target.value }))}
                  >
                    <option value="">— pilih —</option>
                    <option value="N1">N1</option>
                    <option value="N2">N2</option>
                    <option value="N3">N3</option>
                    <option value="N4">N4</option>
                    <option value="N5">N5</option>
                  </select>
                </FieldGroup>
              </div>
              <div className="kk-modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditOpen(false)}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>
                  {editSaving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Flash overlay */}
      {flashMode === "picker" && (
        <FlashPicker
          words={words}
          decks={decks}
          onClose={() => setFlashMode(null)}
          onPick={pickDeck}
        />
      )}
      {flashMode === "card" && flashWord && (
        <FlashCardView
          word={flashWord}
          deckId={flashDeckId}
          deckCount={decks.length}
          idx={flashIdx}
          total={flashWords.length}
          flipped={flipped}
          shuffled={shuffled}
          onFlip={() => setFlipped(f => !f)}
          onNext={flashNext}
          onPrev={flashPrev}
          onToggleShuffle={toggleShuffle}
          onJump={(i) => { setFlipped(false); setFlashIdx(i); }}
          onClose={() => setFlashMode(null)}
          onBackToPicker={() => setFlashMode("picker")}
        />
      )}
    </>
  );
}

/* ─── Subcomponents ─── */

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="pg-field">
      <label className="pg-field-label">
        {label}{hint && <span className="pg-field-hint">· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function FilterRail({
  decks, activeAlbum, setActiveAlbum, levelCounts, levelF, setLevelF, totalWords,
}: {
  decks: { id: number; count: number; incomplete: boolean }[];
  activeAlbum: "all" | number;
  setActiveAlbum: (v: "all" | number) => void;
  levelCounts: Record<LevelFilter, number>;
  levelF: LevelFilter;
  setLevelF: (v: LevelFilter) => void;
  totalWords: number;
}) {
  return (
    <div className="kk-filter-rail glass-card">
      <div className="rail-section">
        <div className="rail-label">
          <Layers size={11} strokeWidth={1.8} />
          <span>Dek hafalan</span>
        </div>
        <ul className="rail-list">
          <li
            className={`rail-item${activeAlbum === "all" ? " on" : ""}`}
            onClick={() => setActiveAlbum("all")}
          >
            <BookA size={13} strokeWidth={1.8} />
            <span className="rail-item-label">Semua Kata</span>
            <span className="rail-item-count">{totalWords}</span>
          </li>
          {decks.map(d => (
            <li
              key={d.id}
              className={`rail-item${activeAlbum === d.id ? " on" : ""}`}
              onClick={() => setActiveAlbum(d.id)}
            >
              <span className="rail-item-label">Dek {d.id}</span>
              <span className="rail-item-count">{d.count}</span>
              {d.incomplete && <span className="rail-badge">+</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="rail-divider" />

      <div className="rail-section">
        <div className="rail-label">
          <BarChart3 size={11} strokeWidth={1.8} />
          <span>Level</span>
        </div>
        <div className="rail-level-grid">
          {LEVEL_OPTS.map(lv => (
            <button
              key={lv}
              type="button"
              className={`level-chip lc-${lv === "ALL" ? "iris" : lv.toLowerCase()}${levelF === lv ? " on" : ""}`}
              onClick={() => setLevelF(lv)}
            >
              <span className="lc-label">{lv === "ALL" ? "Semua" : lv}</span>
              <span className="lc-count">{levelCounts[lv]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WordList({
  words, selected, setSelected, query, setQuery, sort, setSort, loading, totalWords,
}: {
  words: SavedWord[];
  selected: string | null;
  setSelected: (id: string) => void;
  query: string;
  setQuery: (q: string) => void;
  sort: SortMode;
  setSort: (s: SortMode) => void;
  loading: boolean;
  totalWords: number;
}) {
  return (
    <section className="kk-list-section glass-card">
      <div className="list-head">
        <div className="list-search">
          <Search size={13} strokeWidth={1.6} style={{ color: "var(--text-tertiary)" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari kata, reading, atau arti..."
          />
        </div>
        <div className="list-sort">
          <span className="sort-label">Urutan:</span>
          <button type="button" className={`sort-chip${sort === "newest" ? " on" : ""}`} onClick={() => setSort("newest")}>Terbaru</button>
          <button type="button" className={`sort-chip${sort === "alpha" ? " on" : ""}`} onClick={() => setSort("alpha")}>A–Z</button>
          <button type="button" className={`sort-chip${sort === "level" ? " on" : ""}`} onClick={() => setSort("level")}>Level</button>
        </div>
      </div>

      <div className="word-table-head">
        <span>KATA</span>
        <span>READING</span>
        <span>ARTI</span>
        <span style={{ textAlign: "right" }}>LEVEL</span>
      </div>

      <ul className="word-list">
        {loading ? (
          <li style={{ padding: "32px", textAlign: "center", color: "var(--text-tertiary)" }}>
            <Loader2 className="animate-spin" size={20} />
          </li>
        ) : words.length === 0 ? (
          <li style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12.5 }}>
            {totalWords === 0
              ? "Belum ada kata. Klik TAMBAH atau auto-save dari Analisis Foto."
              : "Tidak ada kata cocok dengan filter."}
          </li>
        ) : words.map(w => (
          <li
            key={w.id}
            className={`word-row${selected === w.id ? " on" : ""}`}
            onClick={() => setSelected(w.id)}
          >
            <span className="word-kanji">{w.kanji}</span>
            <span className="word-reading">{w.reading ?? "—"}</span>
            <span className="word-meaning">{w.meaning}</span>
            <span className="word-right">
              {w.level && <span className={`lv-tag-mini lv-${w.level.toLowerCase()}`}>{w.level}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DetailCard({
  word, allWords, onEdit, onDelete,
}: {
  word: SavedWord; allWords: SavedWord[]; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <aside className="kk-detail">
      <div className="glass-card detail-hero">
        <div className="detail-hero-bg" />
        <div className="detail-hero-actions">
          <button type="button" className="dh-icon-btn" title="Edit" onClick={onEdit}>
            <Edit3 size={13} />
          </button>
          <button type="button" className="dh-icon-btn danger" title="Hapus" onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        </div>
        {word.level && (
          <span className={`detail-level lv-${word.level.toLowerCase()}`}>{word.level}</span>
        )}
        {word.reading && <div className="detail-reading">{word.reading}</div>}
        <h2 className="detail-kanji">{word.kanji}</h2>
        <p className="detail-meaning">{word.meaning}</p>
        <div className="detail-meta">
          <span className="dm-item">
            <Calendar size={11} strokeWidth={1.8} style={{ color: "var(--text-tertiary)" }} />
            Ditambah {relativeDate(word.created_at)}
          </span>
          <span className="dm-item">
            <Camera size={11} strokeWidth={1.8} style={{ color: "var(--accent-iris)" }} />
            Tersimpan
          </span>
        </div>
      </div>

      {word.example && (
        <div className="glass-card detail-example">
          <div className="dx-head">
            <BookOpen size={12} strokeWidth={1.6} style={{ color: "var(--accent-iris)" }} />
            Contoh kalimat
          </div>
          <p className="dx-jp font-jp-sans">
            {renderExample(word.example, word.kanji)}
          </p>
        </div>
      )}

      <QuizCepat key={word.id} word={word} pool={allWords} />

      <RelatedWords word={word} allWords={allWords} />
    </aside>
  );
}

function renderExample(text: string, kanji: string): React.ReactNode {
  if (!kanji || !text.includes(kanji)) return text;
  const parts = text.split(kanji);
  return parts.flatMap((p, i) =>
    i === 0 ? [p] : [<span className="dx-hl" key={i}>{kanji}</span>, p]
  );
}

function QuizCepat({ word, pool }: { word: SavedWord; pool: SavedWord[] }) {
  // Lazy init shuffles options once at mount. Parent passes key={word.id} so
  // a different word remounts this component, regenerating choices and
  // resetting picked. Keeps Math.random() out of render and useMemo.
  const [picked, setPicked] = useState<number | null>(null);
  const [choices] = useState<SavedWord[]>(() => {
    const others = pool
      .filter(w => w.id !== word.id && w.meaning.trim())
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [word, ...others].sort(() => Math.random() - 0.5);
  });

  if (choices.length < 2) return null;

  return (
    <div className="glass-card detail-quiz glow-iris">
      <div className="dq-head">
        <div className="dq-title">
          <Zap size={12} fill="var(--accent-amber)" strokeWidth={1.2} style={{ color: "var(--accent-amber)" }} />
          Quiz Cepat
        </div>
        <button type="button" className="dq-skip" onClick={() => setPicked(null)}>Reset →</button>
      </div>
      <div className="dq-prompt">
        Apa arti dari <span className="dq-kanji font-jp-sans">{word.kanji}</span>?
      </div>
      <ul className="dq-options">
        {choices.map((c, i) => {
          const isPicked = picked === i;
          const isCorrect = c.id === word.id;
          let cls = "";
          if (picked != null) {
            if (isCorrect) cls = "correct";
            else if (isPicked) cls = "wrong";
          }
          return (
            <li
              key={c.id}
              className={`dq-opt ${cls}`}
              onClick={() => picked == null && setPicked(i)}
            >
              <span className="dq-bullet">{String.fromCharCode(65 + i)}</span>
              <span>{c.meaning}</span>
              {picked != null && isCorrect && <Check size={14} strokeWidth={2.2} style={{ color: "var(--accent-emerald)" }} />}
              {isPicked && !isCorrect && <X size={14} strokeWidth={2.2} style={{ color: "var(--accent-rose)" }} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RelatedWords({ word, allWords }: { word: SavedWord; allWords: SavedWord[] }) {
  const related = useMemo(() => {
    if (!word.level) return [];
    return allWords
      .filter(w => w.level === word.level && w.id !== word.id)
      .slice(0, 4);
  }, [word, allWords]);

  if (related.length === 0) return null;

  return (
    <div className="glass-card detail-example" style={{ padding: "16px 18px" }}>
      <div className="dx-head" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Kata lain level <strong style={{ color: "var(--text-primary)" }}>{word.level}</strong></span>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {related.map(w => (
          <li
            key={w.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.2fr) auto",
              gap: 10,
              alignItems: "center",
              padding: "8px 10px",
              borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span className="font-jp-sans" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{w.kanji}</span>
              {w.reading && (
                <span className="font-jp-sans" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{w.reading}</span>
              )}
            </div>
            <span style={{ fontSize: 11.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {w.meaning}
            </span>
            <ChevronRight size={12} style={{ color: "var(--text-tertiary)" }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Flash overlay ─── */

function FlashPicker({
  words, decks, onClose, onPick,
}: {
  words: SavedWord[];
  decks: { id: number; count: number; color: typeof DECK_COLORS[number]; preview: SavedWord[]; incomplete: boolean }[];
  onClose: () => void;
  onPick: (id: "all" | number) => void;
}) {
  return (
    <div className="flash-mask" role="dialog" onClick={onClose}>
      <div className="flash-picker" onClick={e => e.stopPropagation()}>
        <header className="fp-head">
          <div className="fp-head-icon">
            <Layers size={16} strokeWidth={1.8} style={{ color: "var(--accent-iris)" }} />
          </div>
          <div className="fp-head-text">
            <h2>Pilih Dek</h2>
            <p>{words.length} kata · {ALBUM_SIZE} per dek · Pilih dek yang mau dihafalin sekarang</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
            <X size={14} />
          </button>
        </header>

        <div className="fp-list">
          <button type="button" className="fp-card fp-card-all" onClick={() => onPick("all")}>
            <span className="fp-num"><BookA size={16} strokeWidth={1.8} style={{ color: "var(--accent-iris)" }} /></span>
            <div className="fp-card-body">
              <div className="fp-card-head">
                <strong>Semua Kata</strong>
                <span className="fp-count">{words.length} kata</span>
              </div>
              <p className="fp-card-desc">Hafalin dari paling baru — tanpa dipecah</p>
            </div>
            <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
          </button>

          {decks.map(d => (
            <button
              key={d.id}
              type="button"
              className={`fp-card fp-color-${d.color}`}
              onClick={() => onPick(d.id)}
            >
              <span className={`fp-num fp-num-${d.color}`}>{d.id}</span>
              <div className="fp-card-body">
                <div className="fp-card-head">
                  <strong>Dek {d.id}</strong>
                  <span className="fp-count">{d.count} kata</span>
                  {d.incomplete && <span className="fp-badge">MASIH NAMBAH</span>}
                </div>
                <div className="fp-preview-row">
                  {d.preview.map(w => (
                    <span key={w.id} className={`fp-prev-chip fp-prev-${d.color}`}>{w.kanji}</span>
                  ))}
                  {d.count > 3 && <span className="fp-prev-more">+{d.count - 3}</span>}
                </div>
              </div>
              <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlashCardView({
  word, deckId, deckCount, idx, total, flipped, shuffled,
  onFlip, onNext, onPrev, onToggleShuffle, onJump, onClose, onBackToPicker,
}: {
  word: SavedWord;
  deckId: "all" | number;
  deckCount: number;
  idx: number; total: number;
  flipped: boolean; shuffled: boolean;
  onFlip: () => void; onNext: () => void; onPrev: () => void;
  onToggleShuffle: () => void;
  onJump: (i: number) => void;
  onClose: () => void;
  onBackToPicker: () => void;
}) {
  const isFirst = idx === 0;
  const isLast = idx === total - 1;
  const dotsStart = Math.max(0, Math.min(idx - 4, total - 9));
  const dots = Array.from({ length: Math.min(9, total) }, (_, i) => dotsStart + i);
  const lvCls = word.level ? `lv-${word.level.toLowerCase()}` : "";

  return (
    <div className="flash-mask flash-card-mask" role="dialog">
      <header className="flash-topbar">
        <button type="button" className="flash-chip" onClick={onBackToPicker}>
          <Layers size={11} strokeWidth={1.8} />
          DEK {deckId === "all" ? "SEMUA" : `${deckId}/${deckCount}`}
        </button>
        <div className="flash-counter">
          {String(idx + 1).padStart(2, "0")} <span className="fc-sep">/</span> {String(total).padStart(2, "0")}
        </div>
        <div className="flash-top-actions">
          <button type="button" className={`flash-chip${shuffled ? " on" : ""}`} onClick={onToggleShuffle}>
            <Shuffle size={11} strokeWidth={1.8} />
            ACAK
            {shuffled && <Check size={9} strokeWidth={2.4} />}
          </button>
          <button type="button" className="flash-close" onClick={onClose} aria-label="Tutup">
            <X size={14} />
          </button>
        </div>
      </header>

      <main className="flash-stage">
        <div
          className={`flash-card${flipped ? " flipped" : ""}`}
          onClick={onFlip}
          role="button"
          tabIndex={0}
          aria-label="Klik untuk balik kartu"
        >
          <div className="fc-side fc-front">
            {word.level && <span className={`fc-level ${lvCls}`}>{word.level}</span>}
            <div className="fc-bg" />
            <h2 className="fc-kanji">{word.kanji}</h2>
            <span className="fc-hint">Klik buat lihat jawaban</span>
          </div>
          <div className="fc-side fc-back">
            {word.level && <span className={`fc-level ${lvCls}`}>{word.level}</span>}
            <div className="fc-back-bg" />
            {word.reading && <div className="fc-reading">{word.reading}</div>}
            <h2 className="fc-kanji fc-kanji-back">{word.kanji}</h2>
            <p className="fc-meaning">{word.meaning}</p>
            {word.example && (
              <div className="fc-example font-jp-sans">{word.example}</div>
            )}
          </div>
        </div>
      </main>

      <footer className="flash-controls">
        <button type="button" className="flash-arrow" onClick={onPrev} disabled={isFirst} aria-label="Sebelumnya">
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <div className="flash-center">
          <div className="flash-dots">
            {dotsStart > 0 && <span className="dot-spill">…</span>}
            {dots.map(i => (
              <span
                key={i}
                className={`flash-dot${i === idx ? " on" : ""}${i < idx ? " done" : ""}`}
                onClick={() => onJump(i)}
              />
            ))}
            {dotsStart + 9 < total && <span className="dot-spill">…</span>}
          </div>
          <button type="button" className="flash-flip-cta" onClick={onFlip}>
            {flipped ? "SEMBUNYIKAN" : "LIHAT JAWABAN"}
          </button>
        </div>
        <button type="button" className="flash-arrow" onClick={onNext} disabled={isLast} aria-label="Berikutnya">
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </footer>

      <div className="flash-hint-row">
        <span><kbd>←</kbd> <kbd>→</kbd> Navigasi</span>
        <span><kbd>Space</kbd> Flip</span>
        <span><kbd>S</kbd> Acak</span>
        <span><kbd>Esc</kbd> Keluar</span>
      </div>
    </div>
  );
}
