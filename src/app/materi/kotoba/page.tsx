"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Search, Star, Zap, X, ChevronRight, Check } from "lucide-react";
import kotobaN2 from "@/data/kotoba/N2.json";
import kotobaIndex from "@/data/kotoba/index.json";
import { useUserStats } from "@/lib/use-user-stats";
import FlashPlayer, { type FlashWord } from "@/components/FlashPlayer";

interface Kotoba { word: string; reading: string; meaning: string; group: string; example?: string; example_id?: string; pos?: string; jlpt_level?: string; note?: string; }
interface Deck { level: string; title: string; source: string; count: number; groupOrder: string[]; vocabulary: Kotoba[]; }

/* Level dari termudah → tersulit (badge jumlah kata dari index.json). */
const LEVEL_META = (kotobaIndex as { levels: { level: string; count: number }[] }).levels;
/* Deck default = N2 (deck Nihongo no Mori kamu + kosakata inti). Level lain di-load
   dinamis pas dipilih biar bundle awal ringan. Ini dipanggil di event handler, aman. */
const LOADERS: Record<string, () => Promise<Deck>> = {
  N5: () => import("@/data/kotoba/N5.json").then(m => m.default as Deck),
  N4: () => import("@/data/kotoba/N4.json").then(m => m.default as Deck),
  N3: () => import("@/data/kotoba/N3.json").then(m => m.default as Deck),
  N1: () => import("@/data/kotoba/N1.json").then(m => m.default as Deck),
};

/* Tema unit (dari Nihongo no Mori / claude design). Yang belum ada = tampil polos. */
const THEME: Record<string, { jp: string; id: string; label?: string }> = {
  "動詞": { jp: "", id: "Kata kerja dasar" },
  "副詞": { jp: "", id: "Kata keterangan" },
  "接続詞": { jp: "", id: "Kata sambung" },
  "H-22 JLPT": { jp: "", id: "Giongo & giseigo" },
  "Gabungan 2 kata kerja 合う": { jp: "合う", id: "Gabungan 2 kata kerja", label: "Spesial" },
  "Unit 6": { jp: "移動", id: "Pergerakan" },
  "Unit 7": { jp: "生活", id: "Kehidupan sehari-hari" },
  "Unit 8": { jp: "仕事", id: "Pekerjaan" },
  "Unit 9": { jp: "感情", id: "Perasaan & sifat" },
  "Unit 11": { jp: "社会", id: "Masyarakat" },
  "Unit 12": { jp: "抽象", id: "Konsep abstrak" },
};

type State = "known" | "seen" | "wrong" | "new";
interface WStat { state: State; correct: number; wrong: number; seen: number; }

/** Satu baris kotoba_progress — hasil nilai-diri user di flash mode. */
interface Progres { benar: number; salah: number; riwayat: boolean[] }

/* Status dari data beneran. Ambangnya:
     belum pernah dinilai        → new
     lebih sering salah          → wrong
     benar ≥2 dan unggul         → known
     sisanya (baru sekali bener) → seen
   Sengaja butuh 2× benar buat "dikuasai" — sekali bener bisa cuma nebak. */
function statDari(p?: Progres): WStat {
  if (!p || p.benar + p.salah === 0) return { state: "new", correct: 0, wrong: 0, seen: 0 };
  const dasar = { correct: p.benar, wrong: p.salah, seen: p.benar + p.salah };
  if (p.salah > p.benar) return { ...dasar, state: "wrong" };
  if (p.benar >= 2 && p.benar > p.salah) return { ...dasar, state: "known" };
  return { ...dasar, state: "seen" };
}
const DOT: Record<State, string> = { known: "d-known", seen: "d-seen", wrong: "d-wrong", new: "d-new" };

/* Jenis kata (POS). Kata hasil generate udah punya field `pos` (名詞/動詞/形容詞/
   副詞/接続詞/その他). Deck N2 basis (Nihongo no Mori) belum, jadi ditebak dari
   grup + akhiran ます. その他 dianggap null biar gak jadi chip filter. */
type Pos = string;
const POS_ALL: Pos[] = ["名詞", "動詞", "形容詞", "副詞", "接続詞"];
function posOf(w: Kotoba): Pos | null {
  if (w.pos) return w.pos === "その他" ? null : w.pos;
  if (w.group === "副詞") return "副詞";
  if (w.group === "接続詞") return "接続詞";
  if (/ます$/.test(w.word) || w.group === "動詞" || w.group.includes("合う")) return "動詞";
  return null;
}
function hitsText(s: WStat): { t: string; bad?: boolean } {
  if (s.state === "wrong") return { t: `salah ${s.wrong}×`, bad: true };
  if (s.state === "known") return { t: `benar ${s.correct}×` };
  if (s.state === "seen") return { t: `${s.seen}× muncul` };
  return { t: "—" };
}

export default function KotobaDeck() {
  const stats = useUserStats();
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [progres, setProgres] = useState<Map<string, Progres>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);

  const N2_DECK = kotobaN2 as Deck;
  const [level, setLevel] = useState("N2");
  const [deck, setDeck] = useState<Deck>(N2_DECK);
  const [deckLoading, setDeckLoading] = useState(false);
  const DATA = deck.vocabulary as Kotoba[];
  const GROUP_ORDER = deck.groupOrder;
  const POS_LIST = useMemo(() => POS_ALL.filter(p => DATA.some(w => posOf(w) === p)), [DATA]);

  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState<"all" | State | "fav">("all");
  const [posF, setPosF] = useState<Pos | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set([N2_DECK.groupOrder[0]]));
  const [sel, setSel] = useState<Kotoba | null>(null);

  const [flashWords, setFlashWords] = useState<FlashWord[] | null>(null);

  /* Ganti level: load deck dinamis (event handler, aman dari purity), reset panel
     & filter jenis-kata, buka grup pertama. */
  const changeLevel = async (lv: string) => {
    if (lv === level || deckLoading) return;
    setLevel(lv); setDeckLoading(true); setSel(null); setPosF(null);
    try {
      const d = lv === "N2" ? N2_DECK : await LOADERS[lv]();
      setDeck(d);
      setOpenGroups(new Set([d.groupOrder[0]]));
    } finally { setDeckLoading(false); }
  };

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
      const [p, f, kp] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("saved_words").select("kanji").eq("user_id", user.id).eq("favorite", true),
        supabase.from("kotoba_progress").select("word, benar, salah, riwayat").eq("user_id", user.id),
      ]);
      if (p.data) setStreak(p.data.streak ?? 0);
      if (f.data) setFavs(new Set(f.data.map(r => r.kanji)));
      if (kp.data) {
        setProgres(new Map(kp.data.map(r => [r.word, {
          benar: r.benar ?? 0, salah: r.salah ?? 0, riwayat: r.riwayat ?? [],
        }])));
      }
    }
    load();
  }, []);

  const summary = useMemo(() => {
    let known = 0, seen = 0, wrong = 0, neu = 0;
    const pos: Record<Pos, number> = {};
    for (const w of DATA) {
      const s = statDari(progres.get(w.word)).state; if (s === "known") known++; else if (s === "seen") seen++; else if (s === "wrong") wrong++; else neu++;
      const p = posOf(w); if (p) pos[p] = (pos[p] ?? 0) + 1;
    }
    return { known, seen, wrong, neu, pos };
  }, [progres, DATA]);

  const match = (w: Kotoba, q: string) =>
    !q || w.word.toLowerCase().includes(q) || (w.reading ?? "").toLowerCase().includes(q) || (w.meaning ?? "").toLowerCase().includes(q);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GROUP_ORDER.map(name => {
      let ws = DATA.filter(w => w.group === name && match(w, q));
      if (posF) ws = ws.filter(w => posOf(w) === posF);
      if (statusF === "fav") ws = ws.filter(w => favs.has(w.word));
      else if (statusF !== "all") ws = ws.filter(w => statDari(progres.get(w.word)).state === statusF);
      ws = ws.slice().sort((a, b) => (a.reading ?? "").localeCompare(b.reading ?? "", "ja"));
      const known = DATA.filter(w => w.group === name && statDari(progres.get(w.word)).state === "known").length;
      const total = DATA.filter(w => w.group === name).length;
      return { name, words: ws, total, pct: total ? Math.round((known / total) * 100) : 0 };
    }).filter(g => g.words.length > 0);
    // `progres` wajib ikut: tanpa itu, filter "Dikuasai/Sering salah" dan
    // persentase per unit ngendon di nilai lama tiap user nilai satu kartu.
  }, [query, statusF, posF, favs, progres, DATA, GROUP_ORDER]);

  useEffect(() => { if (query.trim() || statusF !== "all" || posF) setOpenGroups(new Set(groups.map(g => g.name))); }, [query, statusF, posF, groups]);

  const toggleFav = async (w: Kotoba) => {
    if (busy) return;
    setBusy(w.word);
    const next = !favs.has(w.word);
    setFavs(prev => { const s = new Set(prev); if (next) s.add(w.word); else s.delete(w.word); return s; });
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("saved_words").upsert({ user_id: user.id, kanji: w.word, reading: w.reading, meaning: w.meaning, level: w.jlpt_level || "N2", favorite: next }, { onConflict: "user_id,kanji" });
    } catch { /* optimistic */ } finally { setBusy(null); }
  };

  /* Flashcard pasif (flip aja) — pakai FlashPlayer yang sama kayak Kamus.
     Recording/SRS lewat Latihan Kilat, bukan flashcard (sesuai design). */
  const openFlash = (words: Kotoba[]) => {
    if (!words.length) return;
    setFlashWords(words.map(w => ({ id: w.word, kanji: w.word, reading: w.reading, meaning: w.meaning, level: w.jlpt_level ?? level, example: w.example ?? null })));
  };

  const selStat = sel ? statDari(progres.get(sel.word)) : null;
  /* 5 percobaan terakhir, terbaru di depan — dari kotoba_progress.riwayat.
     Dulu dikarang dari hash nama kata, jadi kata yang belum pernah disentuh
     pun kelihatan punya rekam jejak. */
  const selTrace = useMemo(
    () => (sel ? (progres.get(sel.word)?.riwayat ?? []) : []),
    [sel, progres],
  );
  const selConf = useMemo(() => {
    if (!sel) return [] as Kotoba[];
    return DATA.filter(w => w.group === sel.group && w.word !== sel.word && (w.reading?.[0] === sel.reading?.[0] || w.word.length === sel.word.length))
      .slice(0, 2);
  }, [sel, DATA]);

  const STATUS_BADGE: Record<State, { t: string; cls: string }> = {
    known: { t: "DIKUASAI", cls: "s-known" }, seen: { t: "PERNAH MUNCUL", cls: "s-seen" },
    wrong: { t: `SERING SALAH — ${selStat?.wrong ?? 0}× dalam 2 minggu`, cls: "s-wrong" }, new: { t: "BELUM DILATIH", cls: "s-new" },
  };

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={streak} xp={stats.xp} xpTarget={stats.xpTarget} avatarLetter={userInitial} isPro={stats.isPro} />

        <div className="kotoba-v2">
          <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Materi", href: "/materi" }, { label: "Kotoba" }]} />

          <div className="kv-hd">
            <div>
              <h1>Kotoba <span className="jp">語彙</span><span className="lvtag">{level}</span></h1>
              <p>{deck.count} kata · <b>{deck.source}</b> — status tiap kata keisi otomatis dari latihanmu.</p>
              <div className="kv-levels">
                {LEVEL_META.map(m => (
                  <button key={m.level} className={`kv-lvl${level === m.level ? " on" : ""}`} onClick={() => changeLevel(m.level)} disabled={deckLoading}>
                    {m.level}<span className="c">{m.count}</span>
                  </button>
                ))}
                {deckLoading && <span className="kv-lvl-load">memuat…</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className="kv-prog">
                <div className="seg"><div className="n g">{summary.known}</div><div className="l">Dikuasai</div></div>
                <div className="sep" />
                <div className="seg"><div className="n y">{summary.seen}</div><div className="l">Pernah muncul</div></div>
                <div className="sep" />
                <div className="seg"><div className="n r">{summary.wrong}</div><div className="l">Sering salah</div></div>
                <div className="sep" />
                <div className="seg"><div className="n" style={{ color: "var(--text-dim)" }}>{summary.neu}</div><div className="l">Belum</div></div>
              </div>
              <button onClick={() => router.push(`/latihan/kotoba?level=${level}`)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "13px 22px", borderRadius: 99, background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 8px 22px -8px rgba(221,65,36,0.7)" }}><Zap size={14} /> Latihan Kilat</button>
            </div>
          </div>

          <div className="kv-fbar">
            <div className="kv-search"><Search size={15} /><input placeholder="Cari kata / bacaan / arti…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <div className="kv-src">📚 Sumber: <b>{deck.source}</b></div>
          </div>

          <div className="kv-chips">
            <button className={`chip${statusF === "all" ? " on" : ""}`} onClick={() => setStatusF("all")}>Semua <span className="n">{DATA.length}</span></button>
            <button className={`chip wrong${statusF === "wrong" ? " on" : ""}`} onClick={() => setStatusF("wrong")}><span className="d d-wrong" />Sering salah <span className="n">{summary.wrong}</span></button>
            <button className={`chip${statusF === "seen" ? " on" : ""}`} onClick={() => setStatusF("seen")}><span className="d d-seen" />Pernah muncul <span className="n">{summary.seen}</span></button>
            <button className={`chip${statusF === "new" ? " on" : ""}`} onClick={() => setStatusF("new")}><span className="d d-new" />Belum <span className="n">{summary.neu}</span></button>
            <span className="csep" />
            {POS_LIST.map(p => (
              <button key={p} className={`chip${posF === p ? " on" : ""}`} onClick={() => setPosF(cur => cur === p ? null : p)}>{p} <span className="n">{summary.pos[p]}</span></button>
            ))}
            <span className="csep" />
            <button className={`chip${statusF === "fav" ? " on" : ""}`} onClick={() => setStatusF("fav")}><Star size={11} fill={statusF === "fav" ? "currentColor" : "none"} /> Favorit {favs.size > 0 && <span className="n">{favs.size}</span>}</button>
          </div>

          <div className="kv-grid">
            <div className="kv-main">
              {groups.map(g => {
                const open = openGroups.has(g.name);
                const th = THEME[g.name];
                return (
                  <div className={`kv-unit${open ? " open" : ""}`} key={g.name}>
                    <div className="kv-uhead" onClick={() => setOpenGroups(s => { const n = new Set(s); if (n.has(g.name)) n.delete(g.name); else n.add(g.name); return n; })}>
                      <ChevronRight size={14} className="kv-chev" />
                      <span className="kv-ut">
                        {th?.label ? `${th.label} · ` : ""}{g.name.replace(/ 合う$/, "")}{th?.jp && <span className="jpt"> {th.jp}</span>} {th?.id && <span className="thid">{th.id}</span>}
                        <span className="cnt">{g.total} kata</span>
                      </span>
                      <div className="kv-utrack"><i style={{ width: `${g.pct}%` }} /></div>
                      <span className="kv-upct" style={g.pct === 0 ? { color: "var(--text-dim)", fontWeight: 500 } : undefined}>{g.pct === 0 ? "belum dilatih" : `${g.pct}% dikuasai`}</span>
                      <button className="kv-drill" onClick={e => { e.stopPropagation(); openFlash(DATA.filter(w => w.group === g.name)); }}><Zap size={11} /> Flash unit ({g.total})</button>
                    </div>
                    {open && (
                      <div className="kv-words">
                        {g.words.map(w => {
                          const st = statDari(progres.get(w.word)); const h = hitsText(st); const fav = favs.has(w.word);
                          return (
                            <div className={`kv-w${sel?.word === w.word ? " sel" : ""}`} key={w.word} onClick={() => setSel(w)}>
                              <span className={`kv-dot ${DOT[st.state]}`} />
                              <span className="kv-wjp">{w.word}<span className="r">{w.reading}</span></span>
                              <span className="kv-wid">{w.meaning}</span>
                              <span className={`kv-whits${h.bad ? " bad" : ""}`}>{h.t}</span>
                              <button className={`kv-star${fav ? " on" : ""}`} onClick={e => { e.stopPropagation(); toggleFav(w); }} disabled={busy === w.word}><Star size={15} fill={fav ? "currentColor" : "none"} /></button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {groups.length === 0 && <p className="kv-empty">Nggak ada kata yang cocok.</p>}
            </div>

            <aside className="kv-side">
              {sel && selStat ? (
                <div className="kv-det card">
                  <span className={`kv-status ${STATUS_BADGE[selStat.state].cls}`}>● {STATUS_BADGE[selStat.state].t}</span>
                  <div className="kv-det-kanji">{sel.word}</div>
                  <div className="kv-det-read">{sel.reading}</div>
                  <div className="kv-det-mean">{sel.meaning}</div>
                  <div className="kv-det-tags">{THEME[sel.group] && <span className="dtag">{THEME[sel.group].jp || sel.group}</span>}<span className="dtag">{sel.group.replace(/ 合う$/, "")}</span>{sel.pos && sel.pos !== "その他" && <span className="dtag">{sel.pos}</span>}<span className="dtag">{sel.jlpt_level || level}</span></div>

                  {sel.example && (<div className="kv-det-sec"><div className="kv-det-h">Contoh kalimat</div><div className="kv-ex">{sel.example}</div>{sel.example_id && <div className="kv-ex-id">{sel.example_id}</div>}</div>)}
                  {sel.note && (<div className="kv-det-sec"><div className="kv-det-h">Catatan</div><div className="kv-det-none">{sel.note}</div></div>)}

                  <div className="kv-det-sec">
                    <div className="kv-det-h">Jejak latihanmu</div>
                    {selStat.state === "new" ? (
                      <div className="kv-det-none">Belum ada — status nyala setelah kamu ngerjain soal yang mengandung kata ini.</div>
                    ) : (
                      <div className="kv-trace">{selTrace.map((ok, i) => <span key={i} className={`tr-i ${ok ? "tr-ok" : "tr-no"}`}>{ok ? <Check size={13} /> : <X size={13} />}</span>)}</div>
                    )}
                  </div>

                  {selConf.length > 0 && (
                    <div className="kv-det-sec">
                      <div className="kv-det-h">Kata mirip (gampang ketuker)</div>
                      <div className="kv-conf">{selConf.map(c => <div className="conf-i" key={c.word} onClick={() => setSel(c)}>{c.word}<span className="m">{c.meaning}</span></div>)}</div>
                    </div>
                  )}

                  <div className="kv-det-act">
                    <button className="btn btn-p" onClick={() => openFlash([sel])}><Zap size={13} /> Flash kata ini</button>
                    <button className="btn btn-g" onClick={() => openFlash(DATA.filter(w => w.group === sel.group))}>Flash unit</button>
                  </div>
                  <button className={`kv-det-fav${favs.has(sel.word) ? " on" : ""}`} onClick={() => toggleFav(sel)}><Star size={14} fill={favs.has(sel.word) ? "currentColor" : "none"} /> {favs.has(sel.word) ? "Tersimpan di Kamus" : "Simpan ⭐ ke Kamus"}</button>
                </div>
              ) : (
                <div className="kv-det card kv-det-empty"><div className="kv-det-glyph">語</div><p>Ketuk salah satu kata buat lihat detail — bacaan, arti, contoh, dan progres hafalanmu.</p></div>
              )}
            </aside>
          </div>
        </div>

        {flashWords && <FlashPlayer words={flashWords} onClose={() => setFlashWords(null)} />}
      </main>
    </>
  );
}
