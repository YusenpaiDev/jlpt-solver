"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Search, Star, Zap, ChevronRight, Check, X, ArrowUpDown } from "lucide-react";
import bunpouN1 from "@/data/bunpou/N1.json";
import bunpouN2 from "@/data/bunpou/N2.json";
import bunpouN3 from "@/data/bunpou/N3.json";
import bunpouN4 from "@/data/bunpou/N4.json";
import bunpouN5 from "@/data/bunpou/N5.json";
import { useUserStats } from "@/lib/use-user-stats";

interface Ex { jp: string; highlight: string; id: string; }
interface Pattern {
  id: string; pattern: string; meaning: string; level: string;
  functionGroup: string; setsuzoku: string[]; nuance: string;
  examples: Ex[]; confusableWith: string[]; discriminator: string; quickTip: string;
}
interface Grp { key: string; name: string; jp: string; }
interface Deck { level: string; count: number; groups: Grp[]; patterns: Pattern[]; }

const DECKS: Record<string, Deck> = {
  N5: bunpouN5 as Deck, N4: bunpouN4 as Deck, N3: bunpouN3 as Deck, N2: bunpouN2 as Deck, N1: bunpouN1 as Deck,
};
const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const DEFAULT_LEVEL = "N2";

/* Status latihan — SRS belum dibangun, jadi semua "new" (jujur, nggak dikarang).
   Struktur disiapin biar tinggal disambung pas engine drill jadi. */
type State = "known" | "seen" | "wrong" | "new";
const DOT: Record<State, string> = { known: "d-known", seen: "d-seen", wrong: "d-wrong", new: "d-new" };
function statOf(_id: string): State { return "new"; }

type Sort = "fungsi" | "az";

export default function BunpouDeck() {
  const stats = useUserStats();
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const DECK = DECKS[level];
  const PATTERNS = DECK.patterns;
  const GROUPS = DECK.groups;
  const BY_ID = useMemo(() => new Map(PATTERNS.map(p => [p.id, p])), [PATTERNS]);

  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState<"all" | State | "fav" | "warn">("all");
  const [sort, setSort] = useState<Sort>("fungsi");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set([DECKS[DEFAULT_LEVEL].groups[0]?.key]));
  const [sel, setSel] = useState<Pattern | null>(DECKS[DEFAULT_LEVEL].patterns[0] ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  const changeLevel = (lv: string) => {
    if (lv === level) return;
    const d = DECKS[lv];
    setLevel(lv);
    setOpenGroups(new Set([d.groups[0]?.key]));
    setSel(d.patterns[0] ?? null);
    setStatusF("all"); setQuery("");
  };

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
      const [p, f] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("bunpou_patterns").select("pattern").eq("user_id", user.id).eq("favorite", true),
      ]);
      if (p.data) setStreak(p.data.streak ?? 0);
      if (f.data) setFavs(new Set(f.data.map(r => r.pattern)));
    }
    load();
  }, []);

  const summary = useMemo(() => {
    let known = 0, seen = 0, wrong = 0, neu = 0, warn = 0;
    for (const p of PATTERNS) {
      const s = statOf(p.id);
      if (s === "known") known++; else if (s === "seen") seen++; else if (s === "wrong") wrong++; else neu++;
      if (p.confusableWith.length) warn++;
    }
    return { known, seen, wrong, neu, warn };
  }, [PATTERNS]);

  const match = (p: Pattern, q: string) =>
    !q || p.pattern.toLowerCase().includes(q) || p.meaning.toLowerCase().includes(q)
    || p.setsuzoku.some(s => s.toLowerCase().includes(q));

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keep = (p: Pattern) => {
      if (!match(p, q)) return false;
      if (statusF === "fav") return favs.has(p.pattern);
      if (statusF === "warn") return p.confusableWith.length > 0;
      if (statusF !== "all") return statOf(p.id) === statusF;
      return true;
    };
    return GROUPS.map(g => {
      let ps = PATTERNS.filter(p => p.functionGroup === g.key && keep(p));
      if (sort === "az") ps = ps.slice().sort((a, b) => a.pattern.localeCompare(b.pattern, "ja"));
      const total = PATTERNS.filter(p => p.functionGroup === g.key).length;
      const known = PATTERNS.filter(p => p.functionGroup === g.key && statOf(p.id) === "known").length;
      const warn = PATTERNS.filter(p => p.functionGroup === g.key && p.confusableWith.length > 0).length;
      return { ...g, patterns: ps, total, warn, pct: total ? Math.round((known / total) * 100) : 0 };
    }).filter(g => g.patterns.length > 0);
  }, [query, statusF, sort, favs, PATTERNS, GROUPS]);

  useEffect(() => {
    if (query.trim() || statusF !== "all") setOpenGroups(new Set(groups.map(g => g.key)));
  }, [query, statusF, groups]);

  const toggleFav = async (p: Pattern) => {
    if (busy) return;
    setBusy(p.pattern);
    const next = !favs.has(p.pattern);
    setFavs(prev => { const s = new Set(prev); if (next) s.add(p.pattern); else s.delete(p.pattern); return s; });
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("bunpou_patterns").update({ favorite: next }).eq("user_id", user.id).eq("pattern", p.pattern);
    } catch { /* optimistic */ } finally { setBusy(null); }
  };

  const soon = (msg: string) => { setNotice(msg); };

  const selConfusables = useMemo(() => {
    if (!sel) return [] as Pattern[];
    return sel.confusableWith.map(id => BY_ID.get(id)).filter(Boolean) as Pattern[];
  }, [sel, BY_ID]);

  const STATUS_BADGE: Record<State, { t: string; cls: string }> = {
    known: { t: "DIKUASAI", cls: "s-known" }, seen: { t: "PERNAH MUNCUL", cls: "s-seen" },
    wrong: { t: "SERING SALAH", cls: "s-wrong" }, new: { t: "BELUM DILATIH", cls: "s-new" },
  };

  function renderExample(ex: Ex) {
    if (!ex.highlight || !ex.jp.includes(ex.highlight)) return <span>{ex.jp}</span>;
    const i = ex.jp.indexOf(ex.highlight);
    return <>{ex.jp.slice(0, i)}<span className="hl">{ex.highlight}</span>{ex.jp.slice(i + ex.highlight.length)}</>;
  }

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={streak} xp={stats.xp} xpTarget={stats.xpTarget} avatarLetter={userInitial} isPro={stats.isPro} />

        <div className="bunpou-v3">
          <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Materi", href: "/materi" }, { label: "Bunpou" }]} />

          <div className="bv-hd">
            <div>
              <h1>Bunpou <span className="jp">文法</span><span className="lvtag">{level}</span></h1>
              <p>{DECK.count} pola dikelompokin per <b>fungsi</b> — bukan urutan kamus. Pola yang mirip duduk bareng biar keliatan bedanya.</p>
              <div className="bv-levels">
                {LEVELS.map(lv => (
                  <button key={lv} className={`bv-lvl${level === lv ? " on" : ""}`} onClick={() => changeLevel(lv)}>
                    {lv}<span className="c">{DECKS[lv].count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bv-hd-right">
              <div className="bv-prog">
                <div className="seg"><div className="n g">{summary.known}</div><div className="l">Dikuasai</div></div>
                <div className="sep" />
                <div className="seg"><div className="n y">{summary.seen}</div><div className="l">Pernah muncul</div></div>
                <div className="sep" />
                <div className="seg"><div className="n r">{summary.wrong}</div><div className="l">Sering salah</div></div>
                <div className="sep" />
                <div className="seg"><div className="n" style={{ color: "var(--text-dim)" }}>{summary.neu}</div><div className="l">Belum</div></div>
              </div>
              <button className="bv-cta" onClick={() => soon("⚡ Latihan Kilat segera hadir")}><Zap size={14} /> Latihan Kilat</button>
            </div>
          </div>

          <div className="bv-fbar">
            <div className="bv-search"><Search size={15} /><input placeholder="Cari pola, arti, atau penyambungan…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <button className="bv-sort" onClick={() => setSort(s => s === "fungsi" ? "az" : "fungsi")}>
              <ArrowUpDown size={13} /> Urut: <b>{sort === "fungsi" ? "Fungsi" : "A→Z"}</b>
            </button>
          </div>

          <div className="bv-chips">
            <button className={`chip${statusF === "all" ? " on" : ""}`} onClick={() => setStatusF("all")}>Semua <span className="n">{DECK.count}</span></button>
            <button className={`chip wrong${statusF === "wrong" ? " on" : ""}`} onClick={() => setStatusF("wrong")}><span className="d d-wrong" />Sering salah <span className="n">{summary.wrong}</span></button>
            <button className={`chip${statusF === "seen" ? " on" : ""}`} onClick={() => setStatusF("seen")}><span className="d d-seen" />Pernah muncul <span className="n">{summary.seen}</span></button>
            <button className={`chip${statusF === "new" ? " on" : ""}`} onClick={() => setStatusF("new")}><span className="d d-new" />Belum <span className="n">{summary.neu}</span></button>
            <span className="csep" />
            <button className={`chip${statusF === "warn" ? " on" : ""}`} onClick={() => setStatusF(s => s === "warn" ? "all" : "warn")}>⚠️ Rawan ketuker <span className="n">{summary.warn}</span></button>
            <button className={`chip${statusF === "fav" ? " on" : ""}`} onClick={() => setStatusF(s => s === "fav" ? "all" : "fav")}><Star size={11} fill={statusF === "fav" ? "currentColor" : "none"} /> Favorit {favs.size > 0 && <span className="n">{favs.size}</span>}</button>
          </div>

          <div className="bv-grid">
            <div className="bv-main">
              {groups.map(g => {
                const open = openGroups.has(g.key);
                return (
                  <div className={`bv-fn${open ? " open" : ""}`} key={g.key}>
                    <div className="bv-fn-head" onClick={() => setOpenGroups(s => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}>
                      <ChevronRight size={14} className="bv-chev" />
                      <span className="bv-fn-t">
                        {g.name} · <span className="jpt">{g.jp}</span> <span className="cnt">{g.total} pola</span>
                        {g.warn > 0 && <span className="warn-tag">⚠️ {g.warn} RAWAN KETUKER</span>}
                      </span>
                      <div className="bv-track"><i style={{ width: `${g.pct}%`, background: "var(--success2)" }} /></div>
                      <span className="bv-pct" style={g.pct === 0 ? { color: "var(--text-dim)", fontWeight: 500 } : undefined}>{g.pct === 0 ? "belum dilatih" : `${g.pct}% dikuasai`}</span>
                      <button className="bv-drill" onClick={e => { e.stopPropagation(); soon(`⚡ Drill kelompok ${g.name} segera hadir`); }}><Zap size={11} /> Drill kelompok ({g.total})</button>
                    </div>
                    {open && (
                      <div className="bv-pats">
                        {g.patterns.map(p => {
                          const st = statOf(p.id); const fav = favs.has(p.pattern);
                          return (
                            <div className={`bv-p${sel?.id === p.id ? " sel" : ""}`} key={p.id} onClick={() => setSel(p)}>
                              <span className={`bv-dot ${DOT[st]}`} />
                              <span className="bv-p-gm">{p.pattern}</span>
                              <span className="bv-p-arti">{p.meaning}</span>
                              <div className="bv-p-setsu">{p.setsuzoku.slice(0, 2).map((s, i) => <span key={s} className={`schip${i ? " alt" : ""}`}>{s}</span>)}</div>
                              <span className="bv-p-hits">—</span>
                              <button className={`bv-star${fav ? " on" : ""}`} onClick={e => { e.stopPropagation(); toggleFav(p); }} disabled={busy === p.pattern}><Star size={14} fill={fav ? "currentColor" : "none"} /></button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {groups.length === 0 && <p className="bv-empty">Nggak ada pola yang cocok.</p>}
            </div>

            <aside className="bv-side">
              {sel ? (
                <div className="bv-det card">
                  <span className={`bv-status ${STATUS_BADGE[statOf(sel.id)].cls}`}>● {STATUS_BADGE[statOf(sel.id)].t}</span>
                  <div className="bv-det-gm">{sel.pattern}</div>
                  <div className="bv-det-arti">{sel.meaning}</div>
                  {sel.setsuzoku.length > 0 && (
                    <div className="bv-det-setsu">{sel.setsuzoku.map((s, i) => <span key={s} className={`schip${i ? " alt" : ""}`}>{s}</span>)}</div>
                  )}

                  {sel.nuance && (
                    <div className="bv-det-sec"><div className="bv-det-h">Nuansa</div><div className="bv-nuance">{sel.nuance}</div></div>
                  )}

                  {sel.examples[0] && (
                    <div className="bv-det-sec">
                      <div className="bv-det-h">Contoh kalimat</div>
                      <div className="bv-ex">{renderExample(sel.examples[0])}{sel.examples[0].id && <span className="tr">{sel.examples[0].id}</span>}</div>
                    </div>
                  )}

                  {selConfusables.length > 0 && (
                    <div className="bv-det-sec">
                      <div className="bv-det-h">Bedanya sama yang mirip</div>
                      <div className="bv-cmp">
                        <div className="cmp-i self"><span className="cmp-gm">{sel.pattern}</span><span className="cmp-key">{sel.discriminator}</span></div>
                        {selConfusables.map(c => (
                          <div className="cmp-i" key={c.id} onClick={() => setSel(c)}><span className="cmp-gm">{c.pattern}</span><span className="cmp-key">{c.discriminator}</span></div>
                        ))}
                      </div>
                      {sel.quickTip && <p className="cmp-note"><b>Cara cepat:</b> {sel.quickTip}</p>}
                    </div>
                  )}

                  <div className="bv-det-sec">
                    <div className="bv-det-h">Jejak latihanmu</div>
                    <div className="bv-det-none">Belum ada — nyala setelah kamu ngerjain soal yang mengandung pola ini.</div>
                  </div>

                  <div className="bv-det-act">
                    <button className="btn btn-p" onClick={() => soon(`⚡ Drill ${sel.pattern} segera hadir`)}><Zap size={13} /> Drill pola ini (5 soal)</button>
                    <button className="btn btn-g" onClick={() => soon("Modal 'Bandingkan pola' segera hadir")}>Bandingkan</button>
                  </div>
                </div>
              ) : (
                <div className="bv-det card bv-det-empty"><div className="bv-det-glyph">法</div><p>Ketuk salah satu pola buat lihat detail — arti, penyambungan, contoh, dan bedanya sama pola mirip.</p></div>
              )}
            </aside>
          </div>
        </div>

        {notice && (
          <div className="bv-toast" onClick={() => setNotice(null)}>
            {notice} <span className="x"><X size={13} /></span>
          </div>
        )}
      </main>
    </>
  );
}
