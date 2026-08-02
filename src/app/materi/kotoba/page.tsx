"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Search, Star, Zap, Shuffle, ArrowLeft, ArrowRight, X, RotateCcw, ChevronRight } from "lucide-react";
import kotobaData from "@/data/kotoba-n2.json";

interface Kotoba { word: string; reading: string; meaning: string; group: string; example?: string; jlpt_level?: string; note?: string; }
const DATA = ((kotobaData as { vocabulary?: Kotoba[] }).vocabulary ?? []).filter(w => w.word);
// grup ikut urutan kemunculan di file (urutan Nihongo no Mori)
const GROUP_ORDER: string[] = [];
for (const w of DATA) if (!GROUP_ORDER.includes(w.group)) GROUP_ORDER.push(w.group);

export default function KotobaDeck() {
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set([GROUP_ORDER[0]]));
  const [sel, setSel] = useState<Kotoba | null>(null);

  const [flashOpen, setFlashOpen] = useState(false);
  const [flashList, setFlashList] = useState<Kotoba[]>([]);
  const [flashIdx, setFlashIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

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

  // grup → kata (filter + sort a-i-u-e-o berdasar bacaan)
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GROUP_ORDER.map(name => {
      let ws = DATA.filter(w => w.group === name);
      if (favOnly) ws = ws.filter(w => favs.has(w.word));
      if (q) ws = ws.filter(w => w.word.toLowerCase().includes(q) || (w.reading ?? "").toLowerCase().includes(q) || (w.meaning ?? "").toLowerCase().includes(q));
      ws = ws.slice().sort((a, b) => (a.reading ?? "").localeCompare(b.reading ?? "", "ja"));
      return { name, words: ws };
    }).filter(g => g.words.length > 0);
  }, [query, favOnly, favs]);

  // pas ada query/favOnly, buka semua grup yang punya hasil
  useEffect(() => {
    if (query.trim() || favOnly) setOpenGroups(new Set(groups.map(g => g.name)));
  }, [query, favOnly, groups]);

  const totalShown = groups.reduce((n, g) => n + g.words.length, 0);
  const favCount = favs.size;

  const toggleFav = async (w: Kotoba) => {
    if (busy) return;
    setBusy(w.word);
    const next = !favs.has(w.word);
    setFavs(prev => { const s = new Set(prev); if (next) s.add(w.word); else s.delete(w.word); return s; });
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("saved_words").upsert({
        user_id: user.id, kanji: w.word, reading: w.reading, meaning: w.meaning,
        level: w.jlpt_level || "N2", favorite: next,
      }, { onConflict: "user_id,kanji" });
    } catch { /* optimistic */ } finally { setBusy(null); }
  };

  const startFlash = (words: Kotoba[]) => {
    if (!words.length) return;
    const arr = words.slice();
    for (let i = arr.length - 1; i > 0; i--) { const j = (i * 9301 + 49297) % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    setFlashList(arr); setFlashIdx(0); setFlipped(false); setFlashOpen(true);
  };
  const flashCard = flashOpen && flashList.length ? flashList[flashIdx] : null;
  const nextCard = () => { setFlipped(false); setFlashIdx(i => (i + 1) % flashList.length); };
  const prevCard = () => { setFlipped(false); setFlashIdx(i => (i - 1 + flashList.length) % flashList.length); };

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={streak} xp={820} xpTarget={1000} avatarLetter={userInitial} isPro hasUnread />

        <div className="kotoba-v2">
          <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Materi", href: "/materi" }, { label: "Kotoba" }]} />

          {/* header + ringkasan */}
          <div className="kv-hd">
            <div>
              <h1>Kotoba <span className="jp">語彙</span><span className="lvtag">N2</span></h1>
              <p>{DATA.length} kata kurasi · <b>Nihongo no Mori</b> — status per kata nyala otomatis setelah kamu latihan.</p>
            </div>
            <div className="kv-prog">
              <div className="seg"><div className="n g">0</div><div className="l">Dikuasai</div></div>
              <div className="sep" />
              <div className="seg"><div className="n y">0</div><div className="l">Pernah muncul</div></div>
              <div className="sep" />
              <div className="seg"><div className="n" style={{ color: "var(--warning)" }}>{favCount}</div><div className="l">Favorit</div></div>
              <div className="sep" />
              <div className="seg"><div className="n" style={{ color: "var(--text-dim)" }}>{DATA.length}</div><div className="l">Belum</div></div>
            </div>
          </div>

          {/* search + favorit */}
          <div className="kv-fbar">
            <div className="kv-search"><Search size={15} /><input placeholder="Cari kata / bacaan / arti…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <button className={`kv-chip${favOnly ? " on" : ""}`} onClick={() => setFavOnly(v => !v)}><Star size={12} fill={favOnly ? "currentColor" : "none"} /> Favorit {favCount > 0 && <span className="n">{favCount}</span>}</button>
          </div>

          <div className="kv-grid">
            <div className="kv-main">
              {groups.map(g => {
                const open = openGroups.has(g.name);
                return (
                  <div className={`kv-unit${open ? " open" : ""}`} key={g.name}>
                    <div className="kv-uhead" onClick={() => setOpenGroups(s => { const n = new Set(s); if (n.has(g.name)) n.delete(g.name); else n.add(g.name); return n; })}>
                      <ChevronRight size={14} className="kv-chev" />
                      <span className="kv-ut">{g.name} <span className="cnt">{g.words.length} kata</span></span>
                      <div className="kv-utrack"><i style={{ width: "0%" }} /></div>
                      <span className="kv-upct">belum dilatih</span>
                      <button className="kv-drill" onClick={e => { e.stopPropagation(); startFlash(g.words); }}><Zap size={11} /> Flash ({g.words.length})</button>
                    </div>
                    {open && (
                      <div className="kv-words">
                        {g.words.map(w => {
                          const fav = favs.has(w.word);
                          return (
                            <div className={`kv-w${sel?.word === w.word ? " sel" : ""}`} key={w.word} onClick={() => setSel(w)}>
                              <span className="kv-dot d-new" />
                              <span className="kv-wjp">{w.word}<span className="r">{w.reading}</span></span>
                              <span className="kv-wid">{w.meaning}</span>
                              <span className="kv-whits">—</span>
                              <button className={`kv-star${fav ? " on" : ""}`} onClick={e => { e.stopPropagation(); toggleFav(w); }} disabled={busy === w.word}>
                                <Star size={15} fill={fav ? "currentColor" : "none"} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {totalShown === 0 && <p className="kv-empty">Nggak ada kata yang cocok.</p>}
            </div>

            {/* detail panel */}
            <aside className="kv-side">
              {sel ? (
                <div className="kv-det card">
                  <span className="kv-status">● BELUM DILATIH</span>
                  <div className="kv-det-kanji">{sel.word}</div>
                  <div className="kv-det-read">{sel.reading}</div>
                  <div className="kv-det-mean">{sel.meaning}</div>
                  <div className="kv-det-tags"><span className="dtag">{sel.group}</span><span className="dtag">{sel.jlpt_level || "N2"}</span></div>
                  {sel.note && <div className="kv-det-sec"><div className="kv-det-h">Catatan</div><div className="kv-det-mean" style={{ marginTop: 0 }}>{sel.note}</div></div>}
                  <div className="kv-det-sec">
                    <div className="kv-det-h">Contoh kalimat</div>
                    {sel.example ? <div className="kv-ex">{sel.example}</div> : <div className="kv-det-none">Belum ada contoh buat kata ini.</div>}
                  </div>
                  <div className="kv-det-sec">
                    <div className="kv-det-h">Jejak latihanmu</div>
                    <div className="kv-det-none">Belum ada — status &amp; jejak nyala setelah kamu ngerjain soal yang mengandung kata ini.</div>
                  </div>
                  <div className="kv-det-act">
                    <button className="btn btn-p" onClick={() => startFlash([sel])}><Zap size={13} /> Flash kata ini</button>
                    <button className="btn btn-g" onClick={() => { const grp = groups.find(g => g.name === sel.group); if (grp) startFlash(grp.words); }}>Flash unit</button>
                  </div>
                  <button className={`kv-det-fav${favs.has(sel.word) ? " on" : ""}`} onClick={() => toggleFav(sel)}>
                    <Star size={14} fill={favs.has(sel.word) ? "currentColor" : "none"} /> {favs.has(sel.word) ? "Tersimpan di Kamus" : "Simpan ⭐ ke Kamus"}
                  </button>
                </div>
              ) : (
                <div className="kv-det card kv-det-empty">
                  <div className="kv-det-glyph">語</div>
                  <p>Ketuk salah satu kata buat lihat detail — bacaan, arti, contoh, dan progres hafalanmu.</p>
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* flashcard overlay */}
        {flashCard && (
          <div className="kd-flash" onClick={() => setFlashOpen(false)}>
            <div className="kd-flash-inner" onClick={e => e.stopPropagation()}>
              <div className="kd-flash-top"><span>{flashIdx + 1} / {flashList.length}</span><button onClick={() => setFlashOpen(false)}><X size={18} /></button></div>
              <div className={`kd-card${flipped ? " flip" : ""}`} onClick={() => setFlipped(f => !f)}>
                {!flipped
                  ? <div className="kd-card-front"><div className="kd-card-word">{flashCard.word}</div><div className="kd-card-hint">ketuk buat lihat arti</div></div>
                  : <div className="kd-card-back"><div className="kd-card-read">{flashCard.reading}</div><div className="kd-card-mean">{flashCard.meaning}</div>{flashCard.example && <div className="kd-card-ex">{flashCard.example}</div>}</div>}
              </div>
              <div className="kd-flash-nav">
                <button onClick={prevCard}><ArrowLeft size={16} /></button>
                <button className="p" onClick={() => setFlipped(f => !f)}><RotateCcw size={14} /> Balik</button>
                <button onClick={nextCard}><ArrowRight size={16} /></button>
              </div>
              <button className="kd-flash-shuffle" onClick={() => startFlash(flashList)}><Shuffle size={13} /> Acak ulang</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
