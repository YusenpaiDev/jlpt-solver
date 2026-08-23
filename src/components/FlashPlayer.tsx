"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Shuffle, Layers, X, Check, BookA } from "lucide-react";

export interface FlashWord {
  id: string;
  kanji: string;
  reading: string | null;
  meaning: string;
  level: string | null;
  example?: string | null;
}

const ALBUM_SIZE = 50;
const DECK_COLORS = ["iris", "purple", "emerald", "amber", "rose", "iris", "emerald", "amber", "purple", "rose"] as const;
type DeckColor = typeof DECK_COLORS[number];
interface Deck { id: number; count: number; color: DeckColor; preview: FlashWord[]; incomplete: boolean; }

/* Player flashcard full-screen (dipakai Kamus & Drill Kotoba). Kelas .flash-* / .fp-* global. */
export default function FlashPlayer({ words, onClose }: { words: FlashWord[]; onClose: () => void }) {
  const [mode, setMode] = useState<"picker" | "card">(words.length > ALBUM_SIZE ? "picker" : "card");
  const [deckId, setDeckId] = useState<"all" | number>("all");
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [shuffled, setShuffled] = useState(false);

  const decks = useMemo<Deck[]>(() => {
    const out: Deck[] = [];
    for (let i = 0; i < words.length; i += ALBUM_SIZE) {
      const chunk = words.slice(i, i + ALBUM_SIZE);
      const id = Math.floor(i / ALBUM_SIZE) + 1;
      out.push({ id, count: chunk.length, color: DECK_COLORS[(id - 1) % DECK_COLORS.length], preview: chunk.slice(0, 3), incomplete: chunk.length < ALBUM_SIZE });
    }
    return out;
  }, [words]);

  const flashWords = useMemo(() => deckId === "all" ? words : words.slice((deckId - 1) * ALBUM_SIZE, deckId * ALBUM_SIZE), [deckId, words]);
  const sequence = useMemo(() => (!shuffled || order.length !== flashWords.length) ? flashWords.map((_, i) => i) : order, [shuffled, flashWords, order]);
  const word = flashWords[sequence[idx]];

  const pick = (id: "all" | number) => { setDeckId(id); setIdx(0); setFlipped(false); setShuffled(false); setOrder([]); setMode("card"); };
  const toggleShuffle = () => {
    setShuffled(s => { if (!s) setOrder(flashWords.map((_, i) => i).sort(() => Math.random() - 0.5)); return !s; });
    setIdx(0); setFlipped(false);
  };
  const next = () => { setFlipped(false); setTimeout(() => setIdx(i => Math.min(flashWords.length - 1, i + 1)), 60); };
  const prev = () => { setFlipped(false); setTimeout(() => setIdx(i => Math.max(0, i - 1)), 60); };

  useEffect(() => {
    if (mode !== "card") return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === " ") { e.preventDefault(); setFlipped(f => !f); }
      else if (e.key === "s" || e.key === "S") toggleShuffle();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, flashWords.length]);

  if (mode === "picker") {
    return (
      <div className="flash-mask" role="dialog" onClick={onClose}>
        <div className="flash-picker" onClick={e => e.stopPropagation()}>
          <header className="fp-head">
            <div className="fp-head-icon"><Layers size={16} strokeWidth={1.8} style={{ color: "var(--accent-iris)" }} /></div>
            <div className="fp-head-text"><h2>Pilih Dek</h2><p>{words.length} kata · {ALBUM_SIZE} per dek · Pilih dek yang mau dihafalin sekarang</p></div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup"><X size={14} /></button>
          </header>
          <div className="fp-list">
            <button type="button" className="fp-card fp-card-all" onClick={() => pick("all")}>
              <span className="fp-num"><BookA size={16} strokeWidth={1.8} style={{ color: "var(--accent-iris)" }} /></span>
              <div className="fp-card-body">
                <div className="fp-card-head"><strong>Semua Kata</strong><span className="fp-count">{words.length} kata</span></div>
                <p className="fp-card-desc">Hafalin dari paling atas — tanpa dipecah</p>
              </div>
              <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
            </button>
            {decks.map(d => (
              <button key={d.id} type="button" className={`fp-card fp-color-${d.color}`} onClick={() => pick(d.id)}>
                <span className={`fp-num fp-num-${d.color}`}>{d.id}</span>
                <div className="fp-card-body">
                  <div className="fp-card-head"><strong>Dek {d.id}</strong><span className="fp-count">{d.count} kata</span>{d.incomplete && <span className="fp-badge">MASIH NAMBAH</span>}</div>
                  <div className="fp-preview-row">{d.preview.map(w => <span key={w.id} className={`fp-prev-chip fp-prev-${d.color}`}>{w.kanji}</span>)}{d.count > 3 && <span className="fp-prev-more">+{d.count - 3}</span>}</div>
                </div>
                <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!word) return null;
  const total = flashWords.length;
  const isFirst = idx === 0, isLast = idx === total - 1;
  const dotsStart = Math.max(0, Math.min(idx - 4, total - 9));
  const dots = Array.from({ length: Math.min(9, total) }, (_, i) => dotsStart + i);
  const lvCls = word.level ? `lv-${word.level.toLowerCase()}` : "";
  /* Font kanji adaptif. Ukuran default (110–180px) itu buat kanji tunggal —
     kata verb panjang (飽きます) kalau dipaksa segitu bakal wrap & mencong.
     Kecilin ikut jumlah glyph + nowrap biar selalu 1 baris dan ketengah. */
  const glyphs = [...word.kanji].length;
  const frontSize = glyphs <= 1 ? "clamp(110px,14vw,180px)"
    : glyphs === 2 ? "clamp(92px,11vw,148px)"
    : glyphs === 3 ? "clamp(72px,8.5vw,116px)"
    : glyphs === 4 ? "clamp(58px,6.8vw,92px)"
    : glyphs === 5 ? "clamp(48px,5.6vw,76px)"
    : "clamp(38px,4.6vw,60px)";
  const backSize = glyphs <= 1 ? "clamp(60px,8vw,96px)"
    : glyphs === 2 ? "clamp(52px,6.6vw,84px)"
    : glyphs === 3 ? "clamp(44px,5.4vw,68px)"
    : glyphs === 4 ? "clamp(38px,4.4vw,56px)"
    : "clamp(30px,3.6vw,46px)";

  return (
    <div className="flash-mask flash-card-mask" role="dialog">
      <header className="flash-topbar">
        {decks.length > 1
          ? <button type="button" className="flash-chip" onClick={() => setMode("picker")}><Layers size={11} strokeWidth={1.8} /> DEK {deckId === "all" ? "SEMUA" : `${deckId}/${decks.length}`}</button>
          : <span className="flash-chip" style={{ opacity: 0.6 }}><Layers size={11} strokeWidth={1.8} /> {total} KATA</span>}
        <div className="flash-counter">{String(idx + 1).padStart(2, "0")} <span className="fc-sep">/</span> {String(total).padStart(2, "0")}</div>
        <div className="flash-top-actions">
          <button type="button" className={`flash-chip${shuffled ? " on" : ""}`} onClick={toggleShuffle}><Shuffle size={11} strokeWidth={1.8} /> ACAK{shuffled && <Check size={9} strokeWidth={2.4} />}</button>
          <button type="button" className="flash-close" onClick={onClose} aria-label="Tutup"><X size={14} /></button>
        </div>
      </header>
      <main className="flash-stage">
        <div className={`flash-card${flipped ? " flipped" : ""}`} onClick={() => setFlipped(f => !f)} role="button" tabIndex={0} aria-label="Klik untuk balik kartu">
          <div className="fc-side fc-front">
            {word.level && <span className={`fc-level ${lvCls}`}>{word.level}</span>}
            <div className="fc-bg" />
            <h2 className="fc-kanji" style={{ fontSize: frontSize, whiteSpace: "nowrap" }}>{word.kanji}</h2>
            <span className="fc-hint">Klik buat lihat jawaban</span>
          </div>
          <div className="fc-side fc-back">
            {word.level && <span className={`fc-level ${lvCls}`}>{word.level}</span>}
            <div className="fc-back-bg" />
            {word.reading && <div className="fc-reading">{word.reading}</div>}
            <h2 className="fc-kanji fc-kanji-back" style={{ fontSize: backSize, whiteSpace: "nowrap" }}>{word.kanji}</h2>
            <p className="fc-meaning">{word.meaning}</p>
            {word.example && <div className="fc-example font-jp-sans">{word.example}</div>}
          </div>
        </div>
      </main>
      <footer className="flash-controls">
        <button type="button" className="flash-arrow" onClick={prev} disabled={isFirst} aria-label="Sebelumnya"><ChevronLeft size={16} strokeWidth={2} /></button>
        <div className="flash-center">
          <div className="flash-dots">
            {dotsStart > 0 && <span className="dot-spill">…</span>}
            {dots.map(i => <span key={i} className={`flash-dot${i === idx ? " on" : ""}${i < idx ? " done" : ""}`} onClick={() => { setFlipped(false); setIdx(i); }} />)}
            {dotsStart + 9 < total && <span className="dot-spill">…</span>}
          </div>
          <button type="button" className="flash-flip-cta" onClick={() => setFlipped(f => !f)}>{flipped ? "SEMBUNYIKAN" : "LIHAT JAWABAN"}</button>
        </div>
        <button type="button" className="flash-arrow" onClick={next} disabled={isLast} aria-label="Berikutnya"><ChevronRight size={16} strokeWidth={2} /></button>
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
