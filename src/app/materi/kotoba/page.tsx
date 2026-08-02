"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Search, Star, Zap, Shuffle, ArrowLeft, ArrowRight, X, RotateCcw } from "lucide-react";
import kotobaData from "@/data/kotoba-n2.json";

interface Kotoba { word: string; reading: string; meaning: string; group: string; example?: string; jlpt_level?: string; note?: string; }
const DATA = ((kotobaData as { vocabulary?: Kotoba[] }).vocabulary ?? []).filter(w => w.word);
const GROUPS = Array.from(new Set(DATA.map(w => w.group))).filter(Boolean);

const RENDER_STEP = 80;

export default function KotobaDeck() {
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [groupF, setGroupF] = useState<string>("ALL");
  const [favOnly, setFavOnly] = useState(false);
  const [limit, setLimit] = useState(RENDER_STEP);

  const [flashOpen, setFlashOpen] = useState(false);
  const [flashIdx, setFlashIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [order, setOrder] = useState<number[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
      const [p, f] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("saved_words").select("kanji").eq("user_id", user.id).eq("favorite", true),
      ]);
      if (p.data) setStreak(p.data.streak ?? 0);
      if (f.data) setFavs(new Set(f.data.map(r => r.kanji)));
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DATA.filter(w => {
      if (groupF !== "ALL" && w.group !== groupF) return false;
      if (favOnly && !favs.has(w.word)) return false;
      if (!q) return true;
      return w.word.toLowerCase().includes(q) || (w.reading ?? "").toLowerCase().includes(q) || (w.meaning ?? "").toLowerCase().includes(q);
    });
  }, [query, groupF, favOnly, favs]);

  useEffect(() => { setLimit(RENDER_STEP); }, [query, groupF, favOnly]);

  const toggleFav = async (w: Kotoba) => {
    if (busy) return;
    setBusy(w.word);
    const next = !favs.has(w.word);
    setFavs(prev => { const s = new Set(prev); if (next) s.add(w.word); else s.delete(w.word); return s; });
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // upsert kata ke Kamus + set favorite (idempotent, bump created_at pas nambah)
      await supabase.from("saved_words").upsert({
        user_id: user.id, kanji: w.word, reading: w.reading, meaning: w.meaning,
        level: w.jlpt_level || "N2", favorite: next,
      }, { onConflict: "user_id,kanji" });
    } catch { /* biarin — state optimistic udah keupdate */ }
    finally { setBusy(null); }
  };

  const startFlash = () => {
    const idxs = filtered.map((_, i) => i);
    for (let i = idxs.length - 1; i > 0; i--) { const j = ((i * 9301 + 49297) % (i + 1)); [idxs[i], idxs[j]] = [idxs[j], idxs[i]]; }
    setOrder(idxs); setFlashIdx(0); setFlipped(false); setFlashOpen(true);
  };
  const flashCard = flashOpen && order.length ? filtered[order[flashIdx]] : null;
  const nextCard = () => { setFlipped(false); setFlashIdx(i => (i + 1) % order.length); };
  const prevCard = () => { setFlipped(false); setFlashIdx(i => (i - 1 + order.length) % order.length); };

  const shown = filtered.slice(0, limit);

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={streak} xp={820} xpTarget={1000} avatarLetter={userInitial} isPro hasUnread />

        <div className="kotoba-deck">
          <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Materi", href: "/materi" }, { label: "Kotoba" }]} />

          <div className="kd-hd">
            <div>
              <h1>Kotoba <span className="jp">語彙</span> <span className="kd-lv">N2</span></h1>
              <p>{DATA.length} kata kurasi · <b>Nihongo no Mori</b> — flash mode + simpan ⭐ ke Kamus.</p>
            </div>
            <button className="kd-flash-btn" onClick={startFlash} disabled={!filtered.length}><Zap size={15} /> Flashcard ({filtered.length})</button>
          </div>

          {/* controls */}
          <div className="kd-bar">
            <div className="kd-search"><Search size={15} /><input placeholder="Cari kata / bacaan / arti…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <button className={`kd-chip${favOnly ? " on" : ""}`} onClick={() => setFavOnly(v => !v)}><Star size={12} fill={favOnly ? "currentColor" : "none"} /> Favorit</button>
          </div>
          <div className="kd-groups">
            <button className={`kd-g${groupF === "ALL" ? " on" : ""}`} onClick={() => setGroupF("ALL")}>Semua <span className="c">{DATA.length}</span></button>
            {GROUPS.map(g => (
              <button key={g} className={`kd-g${groupF === g ? " on" : ""}`} onClick={() => setGroupF(g)}>{g} <span className="c">{DATA.filter(w => w.group === g).length}</span></button>
            ))}
          </div>

          {/* list */}
          <div className="kd-list">
            {shown.map((w, i) => {
              const fav = favs.has(w.word);
              return (
                <div className="kd-word" key={`${w.word}-${i}`}>
                  <div className="kd-w-main">
                    <div className="kd-w-jp">{w.word} <span className="kd-w-read">{w.reading}</span></div>
                    <div className="kd-w-mean">{w.meaning}</div>
                    {w.note && <div className="kd-w-note">{w.note}</div>}
                  </div>
                  <span className="kd-w-group">{w.group}</span>
                  <button className={`kd-star${fav ? " on" : ""}`} onClick={() => toggleFav(w)} disabled={busy === w.word} title={fav ? "Hapus dari favorit" : "Simpan ke Kamus (favorit)"}>
                    <Star size={16} fill={fav ? "currentColor" : "none"} />
                  </button>
                </div>
              );
            })}
            {!filtered.length && <p className="kd-empty">Nggak ada kata yang cocok.</p>}
          </div>
          {filtered.length > limit && (
            <button className="kd-more" onClick={() => setLimit(n => n + 120)}>Tampilkan lebih banyak <span>{filtered.length - limit} kata lagi</span></button>
          )}
        </div>

        {/* flashcard overlay */}
        {flashCard && (
          <div className="kd-flash" onClick={() => setFlashOpen(false)}>
            <div className="kd-flash-inner" onClick={e => e.stopPropagation()}>
              <div className="kd-flash-top">
                <span>{flashIdx + 1} / {order.length}</span>
                <button onClick={() => setFlashOpen(false)}><X size={18} /></button>
              </div>
              <div className={`kd-card${flipped ? " flip" : ""}`} onClick={() => setFlipped(f => !f)}>
                {!flipped ? (
                  <div className="kd-card-front"><div className="kd-card-word">{flashCard.word}</div><div className="kd-card-hint">ketuk buat lihat arti</div></div>
                ) : (
                  <div className="kd-card-back"><div className="kd-card-read">{flashCard.reading}</div><div className="kd-card-mean">{flashCard.meaning}</div>{flashCard.example && <div className="kd-card-ex">{flashCard.example}</div>}</div>
                )}
              </div>
              <div className="kd-flash-nav">
                <button onClick={prevCard}><ArrowLeft size={16} /></button>
                <button className="p" onClick={() => setFlipped(f => !f)}><RotateCcw size={14} /> Balik</button>
                <button onClick={nextCard}><ArrowRight size={16} /></button>
              </div>
              <button className="kd-flash-shuffle" onClick={startFlash}><Shuffle size={13} /> Acak ulang</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
