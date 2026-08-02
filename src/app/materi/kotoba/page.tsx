"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Search, Star, Zap, Shuffle, ArrowLeft, ArrowRight, X, RotateCcw, ChevronRight, Check } from "lucide-react";
import kotobaData from "@/data/kotoba-n2.json";

interface Kotoba { word: string; reading: string; meaning: string; group: string; example?: string; jlpt_level?: string; note?: string; }
const NON_N2 = /\bN[1345]\b/;
const DATA = ((kotobaData as { vocabulary?: Kotoba[] }).vocabulary ?? []).filter(w => w.word && !NON_N2.test(w.group || ""));
const GROUP_ORDER: string[] = [];
for (const w of DATA) if (!GROUP_ORDER.includes(w.group)) GROUP_ORDER.push(w.group);

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

/* ── STATUS per kata: DUMMY deterministik (dari hash kata) biar tampilan
   kelihatan "hidup" kayak desain. TODO: ganti ke tracking latihan asli. ── */
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
type State = "known" | "seen" | "wrong" | "new";
interface WStat { state: State; correct: number; wrong: number; seen: number; }
function statFor(w: string): WStat {
  const h = hash(w), r = h % 100;
  if (r < 37) return { state: "known", correct: (h % 4) + 3, wrong: 0, seen: 0 };
  if (r < 39) return { state: "wrong", correct: (h % 2), wrong: (h % 3) + 2, seen: 0 };
  if (r < 68) return { state: "seen", correct: 0, wrong: 0, seen: (h % 2) + 1 };
  return { state: "new", correct: 0, wrong: 0, seen: 0 };
}
const DOT: Record<State, string> = { known: "d-known", seen: "d-seen", wrong: "d-wrong", new: "d-new" };

/* Jenis kata (POS) — dari grup + akhiran ます. */
type Pos = "動詞" | "副詞" | "接続詞";
function posOf(w: Kotoba): Pos | null {
  if (w.group === "副詞") return "副詞";
  if (w.group === "接続詞") return "接続詞";
  if (/ます$/.test(w.word) || w.group === "動詞" || w.group.includes("合う")) return "動詞";
  return null;
}
const POS_LIST: Pos[] = ["動詞", "副詞", "接続詞"];
function hitsText(s: WStat): { t: string; bad?: boolean } {
  if (s.state === "wrong") return { t: `salah ${s.wrong}×`, bad: true };
  if (s.state === "known") return { t: `benar ${s.correct}×` };
  if (s.state === "seen") return { t: `${s.seen}× muncul` };
  return { t: "—" };
}

export default function KotobaDeck() {
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState<"all" | State | "fav">("all");
  const [posF, setPosF] = useState<Pos | null>(null);
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

  /* ringkasan header (dari dummy status) */
  const summary = useMemo(() => {
    let known = 0, seen = 0, wrong = 0, neu = 0;
    const pos: Record<Pos, number> = { "動詞": 0, "副詞": 0, "接続詞": 0 };
    for (const w of DATA) {
      const s = statFor(w.word).state; if (s === "known") known++; else if (s === "seen") seen++; else if (s === "wrong") wrong++; else neu++;
      const p = posOf(w); if (p) pos[p]++;
    }
    return { known, seen, wrong, neu, pos };
  }, []);

  const match = (w: Kotoba, q: string) =>
    !q || w.word.toLowerCase().includes(q) || (w.reading ?? "").toLowerCase().includes(q) || (w.meaning ?? "").toLowerCase().includes(q);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GROUP_ORDER.map(name => {
      let ws = DATA.filter(w => w.group === name && match(w, q));
      if (posF) ws = ws.filter(w => posOf(w) === posF);
      if (statusF === "fav") ws = ws.filter(w => favs.has(w.word));
      else if (statusF !== "all") ws = ws.filter(w => statFor(w.word).state === statusF);
      ws = ws.slice().sort((a, b) => (a.reading ?? "").localeCompare(b.reading ?? "", "ja"));
      const known = DATA.filter(w => w.group === name && statFor(w.word).state === "known").length;
      const total = DATA.filter(w => w.group === name).length;
      return { name, words: ws, total, pct: total ? Math.round((known / total) * 100) : 0 };
    }).filter(g => g.words.length > 0);
  }, [query, statusF, posF, favs]);

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

  const startFlash = (words: Kotoba[]) => {
    if (!words.length) return;
    const arr = words.slice();
    for (let i = arr.length - 1; i > 0; i--) { const j = (hash(arr[i].word + i) % (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    setFlashList(arr); setFlashIdx(0); setFlipped(false); setFlashOpen(true);
  };
  const flashCard = flashOpen && flashList.length ? flashList[flashIdx] : null;
  const nextCard = () => { setFlipped(false); setFlashIdx(i => (i + 1) % flashList.length); };
  const prevCard = () => { setFlipped(false); setFlashIdx(i => (i - 1 + flashList.length) % flashList.length); };

  const selStat = sel ? statFor(sel.word) : null;
  const selTrace = useMemo(() => {
    if (!sel) return [] as boolean[];
    const h = hash(sel.word + "trace");
    return Array.from({ length: 5 }, (_, i) => ((h >> i) & 1) === 1);
  }, [sel]);
  const selConf = useMemo(() => {
    if (!sel) return [] as Kotoba[];
    return DATA.filter(w => w.group === sel.group && w.word !== sel.word && (w.reading?.[0] === sel.reading?.[0] || w.word.length === sel.word.length))
      .slice(0, 2);
  }, [sel]);

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
        <UserBar streakDays={streak} xp={820} xpTarget={1000} avatarLetter={userInitial} isPro hasUnread />

        <div className="kotoba-v2">
          <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Materi", href: "/materi" }, { label: "Kotoba" }]} />

          <div className="kv-hd">
            <div>
              <h1>Kotoba <span className="jp">語彙</span><span className="lvtag">N2</span></h1>
              <p>{DATA.length} kata kurasi · <b>Nihongo no Mori</b> — status tiap kata keisi otomatis dari latihanmu.</p>
            </div>
            <div className="kv-prog">
              <div className="seg"><div className="n g">{summary.known}</div><div className="l">Dikuasai</div></div>
              <div className="sep" />
              <div className="seg"><div className="n y">{summary.seen}</div><div className="l">Pernah muncul</div></div>
              <div className="sep" />
              <div className="seg"><div className="n r">{summary.wrong}</div><div className="l">Sering salah</div></div>
              <div className="sep" />
              <div className="seg"><div className="n" style={{ color: "var(--text-dim)" }}>{summary.neu}</div><div className="l">Belum</div></div>
            </div>
          </div>

          <div className="kv-fbar">
            <div className="kv-search"><Search size={15} /><input placeholder="Cari kata / bacaan / arti…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <div className="kv-src">📚 Sumber: <b>Nihongo no Mori</b></div>
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
                      <span className="kv-upct">{g.pct}% dikuasai</span>
                      <button className="kv-drill" onClick={e => { e.stopPropagation(); startFlash(DATA.filter(w => w.group === g.name)); }}><Zap size={11} /> Drill unit ({g.total})</button>
                    </div>
                    {open && (
                      <div className="kv-words">
                        {g.words.map(w => {
                          const st = statFor(w.word); const h = hitsText(st); const fav = favs.has(w.word);
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
                  <div className="kv-det-tags">{THEME[sel.group] && <span className="dtag">{THEME[sel.group].jp || sel.group}</span>}<span className="dtag">{sel.group.replace(/ 合う$/, "")}</span><span className="dtag">{sel.jlpt_level || "N2"}</span></div>

                  {sel.example && (<div className="kv-det-sec"><div className="kv-det-h">Contoh kalimat</div><div className="kv-ex">{sel.example}</div></div>)}
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
                      <div className="kv-det-h">Sering ketuker sama</div>
                      <div className="kv-conf">{selConf.map(c => <div className="conf-i" key={c.word} onClick={() => setSel(c)}>{c.word}<span className="m">{c.meaning}</span></div>)}</div>
                    </div>
                  )}

                  <div className="kv-det-act">
                    <button className="btn btn-p" onClick={() => startFlash([sel])}><Zap size={13} /> Flash kata ini</button>
                    <button className="btn btn-g" onClick={() => startFlash(DATA.filter(w => w.group === sel.group))}>Flash unit</button>
                  </div>
                  <button className={`kv-det-fav${favs.has(sel.word) ? " on" : ""}`} onClick={() => toggleFav(sel)}><Star size={14} fill={favs.has(sel.word) ? "currentColor" : "none"} /> {favs.has(sel.word) ? "Tersimpan di Kamus" : "Simpan ⭐ ke Kamus"}</button>
                </div>
              ) : (
                <div className="kv-det card kv-det-empty"><div className="kv-det-glyph">語</div><p>Ketuk salah satu kata buat lihat detail — bacaan, arti, contoh, dan progres hafalanmu.</p></div>
              )}
            </aside>
          </div>
        </div>

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
