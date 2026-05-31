"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import {
  Search, BookOpen, Star, ChevronDown, ChevronRight, Info, X, Loader2, Sparkles,
} from "lucide-react";

type Level = "N1" | "N2" | "N3" | "N4" | "N5";
type LevelFilter = "ALL" | Level;

interface BunpouPattern {
  id: string;
  pattern: string;
  meaning: string;
  connects_to: string | null;
  notes: string | null;
  example_jp: string | null;
  example_id: string | null;
  level: string | null;
  favorite: boolean | null;
  created_at: string;
}

const LEVEL_OPTS: LevelFilter[] = ["ALL", "N1", "N2", "N3", "N4", "N5"];

const GLOSSARY_DASAR: { jp: string; id: string; example: string }[] = [
  { jp: "名詞",     id: "Noun (kata benda)",       example: "本, 人, 学校" },
  { jp: "い形容詞", id: "i-adjective (kata sifat-i)", example: "高い, 新しい" },
  { jp: "な形容詞", id: "na-adjective (kata sifat-na)", example: "静か, 元気" },
  { jp: "動詞",     id: "Verb (kata kerja)",       example: "食べる, 見る" },
];

const GLOSSARY_BENTUK: { jp: string; id: string; example: string }[] = [
  { jp: "動詞辞書形", id: "Verb bentuk kamus (dictionary form)",    example: "食べる, 行く" },
  { jp: "動詞ます形", id: "Verb bentuk masu (masu-stem)",            example: "食べ-, 行き-" },
  { jp: "動詞て形",   id: "Verb bentuk te (te-form)",                example: "食べて, 行って" },
  { jp: "動詞た形",   id: "Verb bentuk lampau (past form)",          example: "食べた, 行った" },
  { jp: "動詞ない形", id: "Verb bentuk negatif (negative form)",     example: "食べない, 行かない" },
  { jp: "動詞普通形", id: "Verb bentuk biasa / plain (semua bentuk)", example: "食べる/食べた/食べない/食べなかった" },
];

export default function BunpouPage() {
  /* Data */
  const [patterns, setPatterns] = useState<BunpouPattern[]>([]);
  const [loading, setLoading] = useState(true);

  /* UI state */
  const [query, setQuery] = useState("");
  const [levelF, setLevelF] = useState<LevelFilter>("ALL");
  const [favOnly, setFavOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [glossaryOpen, setGlossaryOpen] = useState(true);

  /* User bar */
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const xp = 820;
  const xpTarget = 1000;

  useEffect(() => {
    // Restore glossary-open state dari localStorage
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("bunpou:glossaryOpen");
      if (v === "0") setGlossaryOpen(false);
    }

    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());

        const profileRes = await supabase.from("profiles").select("streak").eq("id", user.id).single();
        if (profileRes.data) setStreak(profileRes.data.streak ?? 0);

        const res = await supabase
          .from("bunpou_patterns")
          .select("id, pattern, meaning, connects_to, notes, example_jp, example_id, level, favorite, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (res.error) {
          // Tabel belum di-migrate — biarin patterns kosong, UI tampilin empty state
          console.warn("Bunpou table query error:", res.error.message);
          setPatterns([]);
        } else {
          setPatterns((res.data ?? []) as BunpouPattern[]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleGlossary = () => {
    setGlossaryOpen(open => {
      const next = !open;
      if (typeof window !== "undefined") {
        localStorage.setItem("bunpou:glossaryOpen", next ? "1" : "0");
      }
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpanded(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFavorite = async (id: string) => {
    const p = patterns.find(x => x.id === id);
    if (!p) return;
    const next = !p.favorite;
    setPatterns(prev => prev.map(x => x.id === id ? { ...x, favorite: next } : x));
    try {
      const { error } = await createClient().from("bunpou_patterns").update({ favorite: next }).eq("id", id);
      if (error) throw error;
    } catch {
      setPatterns(prev => prev.map(x => x.id === id ? { ...x, favorite: !next } : x));
    }
  };

  const filtered = useMemo(() => {
    let r = patterns;
    if (levelF !== "ALL") r = r.filter(p => p.level === levelF);
    if (favOnly) r = r.filter(p => p.favorite);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(p =>
        p.pattern.includes(query) ||
        p.meaning.toLowerCase().includes(q) ||
        (p.notes ?? "").toLowerCase().includes(q) ||
        (p.connects_to ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [patterns, levelF, query, favOnly]);

  const levelCounts = useMemo(() => {
    const counts: Record<LevelFilter, number> = { ALL: patterns.length, N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
    patterns.forEach(p => {
      if (p.level && counts[p.level as Level] != null) counts[p.level as Level]++;
    });
    return counts;
  }, [patterns]);

  const favCount = useMemo(() => patterns.filter(p => p.favorite).length, [patterns]);

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />

      <main className="app-shell">
        <div className="top-bar">
          <Breadcrumb items={[
            { label: "Beranda", href: "/" },
            { label: "Materi", href: "/materi" },
            { label: "Bunpou" },
          ]} />
          <UserBar
            streakDays={streak}
            xp={xp}
            xpTarget={xpTarget}
            avatarLetter={userInitial}
            isPro
            hasUnread
          />
        </div>

        <header className="bp-header">
          <div>
            <h1 className="bp-title">
              Bunpou <span className="bp-title-jp">文法</span>
            </h1>
            <p className="bp-sub">
              Pola tata bahasa JLPT — kapan dipake, nyambung ke jenis kata apa, contoh konkretnya. Klik baris buat lihat detail + contoh kalimat.
            </p>
          </div>
          <div className="bp-count-pill">
            <span className="bp-count-num">{patterns.length}</span>
            <span className="bp-count-label">POLA</span>
          </div>
        </header>

        {/* ── Pengenalan / Glossary ── */}
        <section className={`glass-card bp-intro${glossaryOpen ? " open" : ""}`}>
          <button type="button" className="bp-intro-toggle" onClick={toggleGlossary}>
            <Info size={14} strokeWidth={1.8} style={{ color: "var(--accent-iris)" }} />
            <span className="bp-intro-title">Pengenalan — Istilah Grammar Dasar</span>
            <span className="bp-intro-state">
              {glossaryOpen ? "Sembunyikan" : "Tampilkan"}
              {glossaryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>

          {glossaryOpen && (
            <div className="bp-intro-body">
              <p className="bp-intro-desc">
                Bunpou (文法) adalah pola tata bahasa Jepang yang harus disambung ke jenis kata tertentu.
                Misalnya pattern <code>〜あげく</code> cuma nyambung sama <code>動詞た形</code> (verb bentuk lampau).
                Ini istilah dasar yang sering muncul di kolom <strong>接続 (Penyambungan)</strong>:
              </p>

              <div className="bp-gloss-grid">
                <div className="bp-gloss-section">
                  <div className="bp-gloss-eyebrow">Jenis Kata Dasar</div>
                  <ul className="bp-gloss-list">
                    {GLOSSARY_DASAR.map(g => (
                      <li key={g.jp} className="bp-gloss-row">
                        <span className="bp-gloss-jp">{g.jp}</span>
                        <span className="bp-gloss-id">{g.id}</span>
                        <span className="bp-gloss-ex">{g.example}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bp-gloss-section">
                  <div className="bp-gloss-eyebrow">Bentuk Kata Kerja</div>
                  <ul className="bp-gloss-list">
                    {GLOSSARY_BENTUK.map(g => (
                      <li key={g.jp} className="bp-gloss-row">
                        <span className="bp-gloss-jp">{g.jp}</span>
                        <span className="bp-gloss-id">{g.id}</span>
                        <span className="bp-gloss-ex">{g.example}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Toolbar: search + level + fav ── */}
        <div className="bp-toolbar">
          <div className="bp-search">
            <Search size={13} strokeWidth={1.6} style={{ color: "var(--text-tertiary)" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari pattern, arti, atau penyambungan..."
            />
            {query && (
              <button type="button" className="bp-search-clear" onClick={() => setQuery("")} aria-label="Hapus">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="bp-level-chips">
            {LEVEL_OPTS.map(l => (
              <button
                key={l}
                type="button"
                className={`bp-chip${levelF === l ? " on" : ""}`}
                onClick={() => setLevelF(l)}
              >
                {l === "ALL" ? "Semua" : l}
                <span className="bp-chip-count">{levelCounts[l]}</span>
              </button>
            ))}
            <button
              type="button"
              className={`bp-chip bp-chip-fav${favOnly ? " on" : ""}`}
              onClick={() => setFavOnly(v => !v)}
              title={favOnly ? "Tampilkan semua" : "Hanya favorit"}
            >
              <Star size={11} strokeWidth={2} fill={favOnly ? "currentColor" : "none"} />
              Favorit
              {favCount > 0 && <span className="bp-chip-count">{favCount}</span>}
            </button>
          </div>
        </div>

        {/* ── Table list ── */}
        <section className="glass-card bp-list">
          <div className="bp-list-head">
            <span className="bp-col-no">No</span>
            <span className="bp-col-pattern">文法</span>
            <span className="bp-col-meaning">意味</span>
            <span className="bp-col-connect">接続</span>
            <span className="bp-col-level">Level</span>
            <span className="bp-col-fav" aria-hidden="true"></span>
          </div>

          {loading ? (
            <div className="bp-empty">
              <Loader2 className="animate-spin" size={20} style={{ color: "var(--text-tertiary)" }} />
            </div>
          ) : patterns.length === 0 ? (
            <div className="bp-empty">
              <BookOpen size={28} strokeWidth={1.4} style={{ color: "var(--text-tertiary)" }} />
              <h3 className="bp-empty-title">Belum ada pola tata bahasa</h3>
              <p className="bp-empty-desc">
                Generate JSON di Claude.ai pakai prompt <code>materi/PROMPT-BUNPOU.md</code>,
                drop ke <code>materi/import-bunpou/</code>, lalu jalanin <code>npm run import-bunpou</code>.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bp-empty">
              <Search size={28} strokeWidth={1.4} style={{ color: "var(--text-tertiary)" }} />
              <p className="bp-empty-desc">Tidak ada pola yang cocok dengan filter.</p>
            </div>
          ) : (
            <ul className="bp-rows">
              {filtered.map((p, idx) => {
                const isOpen = expanded.has(p.id);
                return (
                  <li key={p.id} className={`bp-row${isOpen ? " open" : ""}`}>
                    <button
                      type="button"
                      className="bp-row-summary"
                      onClick={() => toggleExpanded(p.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="bp-col-no">{idx + 1}</span>
                      <span className="bp-col-pattern font-jp-sans">{p.pattern}</span>
                      <span className="bp-col-meaning">{p.meaning}</span>
                      <span className="bp-col-connect font-jp-sans">{p.connects_to ?? "—"}</span>
                      <span className="bp-col-level">
                        {p.level && <span className={`bp-lv-tag bp-lv-${p.level.toLowerCase()}`}>{p.level}</span>}
                      </span>
                      <span className="bp-col-fav">
                        <button
                          type="button"
                          className={`bp-row-fav${p.favorite ? " on" : ""}`}
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}
                          title={p.favorite ? "Hapus favorit" : "Tambah favorit"}
                          aria-label={p.favorite ? "Hapus favorit" : "Tambah favorit"}
                        >
                          <Star size={13} strokeWidth={1.8} fill={p.favorite ? "currentColor" : "none"} />
                        </button>
                        <ChevronDown size={13} className={`bp-row-chevron${isOpen ? " on" : ""}`} />
                      </span>
                    </button>

                    {isOpen && (
                      <div className="bp-row-detail">
                        {p.notes && (
                          <div className="bp-detail-section">
                            <div className="bp-detail-label">
                              <Sparkles size={11} strokeWidth={2} /> CATATAN
                            </div>
                            <p className="bp-detail-text">{p.notes}</p>
                          </div>
                        )}
                        {(p.example_jp || p.example_id) && (
                          <div className="bp-detail-section">
                            <div className="bp-detail-label">
                              <BookOpen size={11} strokeWidth={2} /> CONTOH
                            </div>
                            {p.example_jp && <p className="bp-detail-jp font-jp-sans">{p.example_jp}</p>}
                            {p.example_id && <p className="bp-detail-id">{p.example_id}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
