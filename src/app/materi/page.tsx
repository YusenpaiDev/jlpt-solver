"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Lock, RotateCcw, Headphones } from "lucide-react";

type Lv = "N2" | "N3";
const OWNED_LEVEL: Lv = "N2"; // TODO: dari profiles.subscription — gating Step 5

interface Exam {
  id: string;
  level: string;
  title: string;
  total: number;
  score: number | null;
  section?: string | null;
  created_at: string;
}
type ExType = "筆記" | "聴解";
function exType(e: Exam): ExType { return e.section === "choukai" ? "聴解" : "筆記"; }
function examMeta(title: string): { label: string; sortKey: number } {
  const m = title.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月/);
  if (m) return { label: `${m[1]}年${m[2]}月`, sortKey: +m[1] * 100 + +m[2] };
  return { label: title.slice(0, 20), sortKey: 0 };
}
function relDate(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d < 1) return "hari ini"; if (d < 2) return "kemarin";
  if (d < 7) return `${d} hari lalu`; if (d < 30) return `${Math.floor(d / 7)} minggu lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const DEFAULT_SHOWN = 7;

export default function MateriHub() {
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const [exams, setExams] = useState<Exam[]>([]);
  const [level, setLevel] = useState<Lv>("N2");
  const [typeF, setTypeF] = useState<"all" | ExType>("all");
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();

  const targetLevel: Lv = "N2";
  const targetDate = "Desember 2026";

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
      const [p, ex] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("sessions")
          .select("id, level, title, total, score, created_at, ai_result->section")
          .eq("user_id", user.id)
          .eq("ai_result->>kind", "materi")
          .order("created_at", { ascending: false }),
      ]);
      if (p.data) setStreak(p.data.streak ?? 0);
      setExams((ex.data ?? []) as Exam[]);
    }
    load();
  }, []);

  const perLevel = useMemo(() => {
    const m: Record<string, Exam[]> = {};
    exams.forEach(e => (m[e.level] ??= []).push(e));
    return m;
  }, [exams]);

  const counts = (lv: Lv) => {
    const all = perLevel[lv] ?? [];
    return { total: all.length, hisho: all.filter(e => exType(e) === "筆記").length, choukai: all.filter(e => exType(e) === "聴解").length };
  };

  // Set untuk grid: level aktif + filter tipe, urut tahun terbaru
  const gridSets = useMemo(() => {
    let s = (perLevel[level] ?? []).slice();
    if (typeF !== "all") s = s.filter(e => exType(e) === typeF);
    return s.sort((a, b) => examMeta(b.title).sortKey - examMeta(a.title).sortKey);
  }, [perLevel, level, typeF]);

  // Summary (level aktif)
  const summary = useMemo(() => {
    const all = perLevel[level] ?? [];
    const done = all.filter(e => e.score != null && e.total > 0);
    const pctSet = all.length ? Math.round((done.length / all.length) * 100) : 0;
    const avg = done.length ? Math.round(done.reduce((n, e) => n + (e.score! / e.total) * 100, 0) / done.length) : null;
    const last = done.slice().sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
    const nextSet = all.filter(e => e.score == null).sort((a, b) => examMeta(b.title).sortKey - examMeta(a.title).sortKey)[0];
    return { total: all.length, doneN: done.length, pctSet, avg, last, nextSet };
  }, [perLevel, level]);

  const shown = showAll ? gridSets : gridSets.slice(0, DEFAULT_SHOWN);
  const moreN = gridSets.length - shown.length;
  const c2 = counts("N2"), c3 = counts("N3");
  const locked = level !== OWNED_LEVEL;

  const openExam = (e: Exam) => {
    if (locked) return;
    router.push(exType(e) === "聴解" ? `/choukai/${e.id}` : `/latihan/${e.id}`);
  };

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={streak} xp={820} xpTarget={1000} avatarLetter={userInitial} isPro hasUnread />

        <header className="mat-header">
          <div>
            <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Materi" }]} />
            <h1 className="mat-title">Materi <span className="mat-title-jp">教材</span></h1>
            <p className="mat-sub">Bank soal ujian lengkap + materi belajar terstruktur. Kotoba personal kamu ada di <Link href="/kamus">Kamus →</Link></p>
          </div>
          <div className="mat-stats">
            <div className="mat-stat-card glass-card">
              <div className="mat-stat-label">Target kamu</div>
              <div className="mat-stat-value"><span className={`lv-tag lv-${targetLevel.toLowerCase()}`}>{targetLevel}</span><span className="mat-stat-meta">{targetDate}</span></div>
            </div>
          </div>
        </header>

        {/* ═══ BANK SOAL ═══ */}
        <section id="bank-soal">
          <div className="mat-section-head">
            <h2 className="mat-section-title">Bank Soal <span className="mat-title-jp" style={{ fontSize: 15 }}>過去問</span> <span className="mat-section-count">{exams.length}</span></h2>
            <span className="mat-section-sub">Soal ujian lengkap — klik buat mulai latihan</span>
          </div>

          {/* summary strip */}
          <div className="bs-summary">
            <div className="bss-ring">
              <svg width="52" height="52" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="21" stroke="var(--surface-3)" strokeWidth="5" fill="none" />
                <circle cx="26" cy="26" r="21" stroke="var(--success)" strokeWidth="5" fill="none" strokeDasharray="132" strokeDashoffset={132 * (1 - summary.pctSet / 100)} strokeLinecap="round" transform="rotate(-90 26 26)" style={{ filter: "drop-shadow(0 0 5px rgba(143,203,82,0.5))" }} />
              </svg>
              <span className="bss-pct">{summary.pctSet}%</span>
            </div>
            <div className="bss-meta">
              <div className="bss-t"><b>{summary.doneN} dari {summary.total} set</b> {level} udah kamu kerjain{summary.avg != null && ` · rata-rata ${summary.avg}%`}</div>
              <div className="bss-s">{summary.last ? `Terakhir: ${examMeta(summary.last.title).label} (${Math.round((summary.last.score! / summary.last.total) * 100)}%) · ${relDate(summary.last.created_at)}` : "Belum ada set yang dikerjain — mulai dari yang terbaru 🔥"}</div>
            </div>
            {summary.nextSet && !locked && (
              <button className="bss-cta" onClick={() => openExam(summary.nextSet!)}>Lanjut set berikutnya →</button>
            )}
          </div>

          {/* level tabs */}
          <div className="lv-tabs">
            <button className={`lv-tab${level === "N2" ? " on" : ""}`} onClick={() => { setLevel("N2"); setShowAll(false); }}>N2 <span className="c">{c2.total} set</span></button>
            <button className={`lv-tab${level === "N3" ? " on" : ""}`} onClick={() => { setLevel("N3"); setShowAll(false); }}>N3 {"N3" !== OWNED_LEVEL && <Lock size={11} strokeWidth={2} />}<span className="c">{c3.total} set</span></button>
            <div className="lv-typef">
              {(["all", "筆記", "聴解"] as const).map(t => (
                <button key={t} className={`lv-tf${typeF === t ? " on" : ""}`} onClick={() => setTypeF(t)}>{t === "all" ? "Semua" : t === "筆記" ? "✍️ 筆記" : "🎧 聴解"}</button>
              ))}
            </div>
          </div>

          {locked && (
            <div className="bs-lock-banner">
              <Lock size={14} strokeWidth={2} /> Paket kamu: <b>{OWNED_LEVEL}</b>. Upgrade buat akses {level} ({counts(level).total} set, 2010–2025) <Link href="/premium" className="bs-lock-cta">Upgrade →</Link>
            </div>
          )}

          <div className="exam-grid">
            {shown.map((e, i) => {
              const done = e.score != null && e.total > 0;
              const pct = done ? Math.round((e.score! / e.total) * 100) : 0;
              const bad = done && pct < 65;
              const teaser = locked && i >= 3; // Step 5: 3 pertama playable
              const cho = exType(e) === "聴解";
              return (
                <div key={e.id} className={`exam${done ? " done" : ""}${bad ? " bad" : ""}${teaser ? " teaser" : ""}`} onClick={() => !teaser && openExam(e)}>
                  <div className="exam-top">
                    <span className="exam-title">{cho && <Headphones size={11} strokeWidth={2} style={{ marginRight: 4, verticalAlign: "-1px", opacity: .7 }} />}{examMeta(e.title).label}</span>
                    <span className="exam-soal">{e.total} soal{cho ? " 🎧" : ""}</span>
                  </div>
                  {done ? (
                    <div className="score-row">
                      <div className="sring">
                        <svg width="36" height="36" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" stroke="var(--surface-3)" strokeWidth="3.5" fill="none" />
                          <circle cx="18" cy="18" r="14" stroke={bad ? "var(--danger)" : "var(--success)"} strokeWidth="3.5" fill="none" strokeDasharray="88" strokeDashoffset={88 * (1 - pct / 100)} strokeLinecap="round" transform="rotate(-90 18 18)" />
                        </svg>
                        <span className={`spct ${bad ? "g-bad" : "g-good"}`}>{pct}%</span>
                      </div>
                      <div className="smeta"><div className="sl1">{e.score} <span className="frac">/ {e.total}</span></div><div className={`sl2${bad ? " g-bad" : ""}`}>{bad ? "review yuk" : relDate(e.created_at)}</div></div>
                      <button className="ulangi" onClick={(ev) => { ev.stopPropagation(); openExam(e); }}><RotateCcw size={12} /></button>
                    </div>
                  ) : (
                    <div className="exam-foot"><span className="exam-hint">{teaser ? "🔒 Upgrade" : "Belum dikerjain"}</span>{!teaser && <button className="mulai" onClick={(ev) => { ev.stopPropagation(); openExam(e); }}>Mulai →</button>}</div>
                  )}
                </div>
              );
            })}
            {moreN > 0 && (
              <button className="exam-more" onClick={() => setShowAll(true)}><b>+{moreN} set lagi</b><span>Tampilkan semua {level} →</span></button>
            )}
          </div>
        </section>

        {/* ═══ TERSEDIA ═══ */}
        <section>
          <div className="mat-section-head"><h2 className="mat-section-title">Tersedia <span className="mat-section-count">2</span></h2><span className="mat-section-sub">Klik kartu untuk mulai</span></div>
          <div className="ters-grid">
            <article className="ters kotoba">
              <span className="ters-soon">SOON</span>
              <div className="ters-glyph"><span>語</span></div>
              <div className="ters-body">
                <span className="ters-eyebrow">Kosakata Terstruktur</span><span className="ters-name">Kotoba</span>
                <p className="ters-desc">Dari file lokal kamu — di-parse otomatis, dikelompokkan per level &amp; tema, siap jadi flashcard.</p>
                <div className="ters-foot"><div className="ters-prog"><div className="tp-track"><div className="tp-fill" style={{ width: "60%" }} /></div><span className="tp-pct">60%</span></div><span className="ters-cta">Coming soon</span></div>
              </div>
            </article>
            <Link href="/materi/bunpou" className="ters bunpou" style={{ textDecoration: "none" }}>
              <div className="ters-glyph"><span>文</span></div>
              <div className="ters-body">
                <span className="ters-eyebrow">Tata Bahasa</span><span className="ters-name">Bunpou</span>
                <p className="ters-desc">Pola grammar JLPT lengkap per level: penjelasan, penyambungan, contoh kalimat.</p>
                <div className="ters-foot"><div className="ters-prog"><div className="tp-track"><div className="tp-fill full" style={{ width: "100%" }} /></div><span className="tp-pct">100%</span></div><span className="ters-cta">Buka Bunpou →</span></div>
              </div>
            </Link>
          </div>
        </section>

        {/* ═══ MENDATANG ═══ */}
        <section>
          <div className="mat-section-head"><h2 className="mat-section-title">Materi mendatang <span className="mat-section-count muted-count">3</span></h2></div>
          <div className="mn-strip">
            {[["字", "Kanji", "Karakter per level, urutan stroke"], ["聴", "Choukai", "Listening dengan audio terstruktur"], ["読", "Dokkai", "Teks bacaan panjang + pembahasan"]].map(([g, t, d]) => (
              <div className="mn-item" key={t}>
                <div className="mn-g">{g}<span className="mn-lock"><Lock size={8} strokeWidth={2.5} /></span></div>
                <div className="mn-m"><div className="mn-t">{t}</div><div className="mn-d">{d}</div></div>
              </div>
            ))}
            <div className="mn-vote"><span className="mn-vote-t">Mana yang paling kamu butuhin?</span><button className="mn-vote-btn">Vote materi berikutnya →</button></div>
          </div>
        </section>
      </main>
    </>
  );
}
