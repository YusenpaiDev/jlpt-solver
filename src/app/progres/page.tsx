"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { History, BarChart3, RotateCcw } from "lucide-react";
import { StatistikView } from "@/app/statistik/page";

type Tab = "log" | "stat";

interface SessStats { answered?: number; correct?: number; perCat?: Record<string, { a?: number; c?: number }> }
interface Sess {
  id: string;
  level: string;
  category: string;
  title: string;
  total: number;
  score: number | null;
  created_at: string;
  section?: string | null;
  kind?: string | null;
  stats?: SessStats | null;
}

const KAT_LABEL: Record<string, string> = { "文法": "Bunpou", "語彙": "Goi", "読解": "Dokkai", "聴解": "Choukai", "文字": "Moji" };
const KAT_ORDER = ["文法", "語彙", "読解", "聴解", "文字"];

const GROUP_ORDER = ["Hari ini", "Kemarin", "Minggu ini", "Lebih lama"] as const;
type Group = typeof GROUP_ORDER[number];
function dayGroup(iso: string): Group {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d < 1) return "Hari ini";
  if (d < 2) return "Kemarin";
  if (d < 7) return "Minggu ini";
  return "Lebih lama";
}
function timeStr(iso: string) { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
function within(iso: string, days: number) { return (Date.now() - new Date(iso).getTime()) / 86_400_000 < days; }

type SType = "exam" | "choukai" | "foto";
function sessType(s: Sess): SType {
  if (s.section === "choukai") return "choukai";
  if (s.kind === "materi") return "exam";
  return "foto";
}
const TYPE_META: Record<SType, { icon: string; tag: string; ic: string; tt: string }> = {
  exam:    { icon: "✍️", tag: "BANK SOAL",     ic: "pr-ic-exam", tt: "pr-tt-exam" },
  choukai: { icon: "🎧", tag: "CHOUKAI",       ic: "pr-ic-cho",  tt: "pr-tt-cho" },
  foto:    { icon: "📷", tag: "ANALISIS FOTO", ic: "pr-ic-foto", tt: "pr-tt-foto" },
};
function tone(pct: number) { return pct >= 75 ? "good" : pct >= 65 ? "mid" : "bad"; }
/** Judul singkat: buang prefix "JLPT ... 過去問" dst, sisain 年月 kalau ada. */
function shortTitle(t: string): string {
  const m = t.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月/);
  return m ? `${m[1]}年${m[2]}月` : t.replace(/^JLPT\s*/i, "").slice(0, 28);
}

export default function ProgresPage() {
  return (
    <Suspense fallback={null}>
      <Progres />
    </Suspense>
  );
}

function Progres() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab: Tab = searchParams.get("tab") === "stat" ? "stat" : "log";

  const [sessions, setSessions] = useState<Sess[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const [typeF, setTypeF] = useState<"all" | SType>("all");
  const [levelF, setLevelF] = useState<"all" | string>("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
      const [profileRes, sessRes] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("sessions")
          .select("id, level, category, title, total, score, created_at, ai_result->section, ai_result->kind, ai_result->stats")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (profileRes.data) setStreak(profileRes.data.streak ?? 0);
      setSessions((sessRes.data ?? []) as Sess[]);
      setLoading(false);
    }
    load();
  }, []);

  const setTab = (t: Tab) => router.replace(`/progres?tab=${t}`, { scroll: false });

  /* Sesi yang jadi "log latihan" = udah dikerjain (ada skor). */
  const done = useMemo(() => sessions.filter(s => s.score != null && s.total > 0), [sessions]);

  /* Header pills */
  const weekCount = done.filter(s => within(s.created_at, 7)).length;
  const acc7 = useMemo(() => {
    let a = 0, c = 0;
    done.filter(s => within(s.created_at, 7)).forEach(s => { a += s.stats?.answered ?? 0; c += s.stats?.correct ?? 0; });
    const cur = a > 0 ? Math.round((c / a) * 100) : null;
    let pa = 0, pc = 0;
    done.filter(s => !within(s.created_at, 7) && within(s.created_at, 14)).forEach(s => { pa += s.stats?.answered ?? 0; pc += s.stats?.correct ?? 0; });
    const prev = pa > 0 ? Math.round((pc / pa) * 100) : null;
    return { cur, delta: cur != null && prev != null ? cur - prev : null };
  }, [done]);
  const totalSoal = done.reduce((n, s) => n + (s.total ?? 0), 0);

  /* Filter + group untuk timeline */
  const filtered = useMemo(() => done.filter(s =>
    (typeF === "all" || sessType(s) === typeF) &&
    (levelF === "all" || s.level === levelF)
  ), [done, typeF, levelF]);

  const groups = useMemo(() => {
    const g: Record<Group, Sess[]> = { "Hari ini": [], "Kemarin": [], "Minggu ini": [], "Lebih lama": [] };
    filtered.forEach(s => g[dayGroup(s.created_at)].push(s));
    return GROUP_ORDER.map(k => ({ label: k, items: g[k] })).filter(x => x.items.length > 0);
  }, [filtered]);

  /* Sidebar: akurasi per kategori (all-time, dari stats.perCat) */
  const catAcc = useMemo(() => {
    const bag: Record<string, { a: number; c: number }> = {};
    done.forEach(s => {
      for (const [k, v] of Object.entries(s.stats?.perCat ?? {})) {
        const b = bag[k] ?? (bag[k] = { a: 0, c: 0 });
        b.a += v.a ?? 0; b.c += v.c ?? 0;
      }
    });
    return KAT_ORDER.map(k => ({ jp: k, ro: KAT_LABEL[k], pct: bag[k]?.a ? Math.round((bag[k].c / bag[k].a) * 100) : null }));
  }, [done]);

  /* Sidebar: aktivitas 7 hari (jumlah sesi per hari) */
  const week = useMemo(() => {
    const labels = ["M", "S", "S", "R", "K", "J", "S"];
    const out: { l: string; n: number; now: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const n = done.filter(s => { const t = new Date(s.created_at).getTime(); return t >= d.getTime() && t < next.getTime(); }).length;
      out.push({ l: labels[d.getDay()], n, now: i === 0 });
    }
    const max = Math.max(1, ...out.map(o => o.n));
    return out.map(o => ({ ...o, h: Math.round((o.n / max) * 100) }));
  }, [done]);
  const activeDays = week.filter(w => w.n > 0).length;
  const weakest = useMemo(() => catAcc.filter(c => c.pct != null).sort((a, b) => a.pct! - b.pct!)[0], [catAcc]);

  const levelsPresent = useMemo(() => Array.from(new Set(done.map(s => s.level))).sort(), [done]);
  const resetF = () => { setTypeF("all"); setLevelF("all"); };
  const isEmpty = !loading && done.length === 0;

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={streak} xp={820} xpTarget={1000} avatarLetter={userInitial} isPro hasUnread />

        <header className="pr-header">
          <div>
            <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Progres" }]} />
            <h1 className="pr-title">Progres <span className="pr-title-jp">進歩</span></h1>
          </div>
          <div className="pr-pills">
            <div className="pr-pill"><div className="pr-pill-l">Minggu ini</div><div className="pr-pill-v">{weekCount} <span className="u">sesi</span></div></div>
            <div className={`pr-pill${acc7.delta != null && acc7.delta > 0 ? " up" : ""}`}><div className="pr-pill-l">Akurasi 7 hari</div><div className="pr-pill-v">{acc7.cur != null ? `${acc7.cur}%` : "—"} {acc7.delta != null && <span className="u">{acc7.delta >= 0 ? "↑" : "↓"}{Math.abs(acc7.delta)}</span>}</div></div>
            <div className="pr-pill"><div className="pr-pill-l">Total soal</div><div className="pr-pill-v">{totalSoal.toLocaleString("id-ID")}</div></div>
          </div>
        </header>

        <div className="pr-tabs">
          <button type="button" className={`pr-tab${tab === "log" ? " on" : ""}`} onClick={() => setTab("log")}><History size={14} strokeWidth={1.8} /> Log</button>
          <button type="button" className={`pr-tab${tab === "stat" ? " on" : ""}`} onClick={() => setTab("stat")}><BarChart3 size={14} strokeWidth={1.8} /> Statistik</button>
        </div>

        {tab === "stat" ? (
          <StatistikView embedded />
        ) : isEmpty ? (
          <div className="glass-card pr-empty">
            <History size={22} strokeWidth={1.6} />
            <div className="pr-empty-t">Belum ada sesi latihan</div>
            <p className="pr-empty-s">Kerjain set di Bank Soal atau upload foto soal — sesi yang udah dikerjain muncul di sini.</p>
            <div className="pr-empty-cta">
              <Link href="/materi#bank-soal" className="btn btn-primary">Buka Bank Soal</Link>
              <Link href="/analisis-foto" className="btn btn-secondary">Analisis Foto</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="pr-filters">
              {([["all", "Semua"], ["exam", "✍️ Bank Soal"], ["foto", "📷 Analisis Foto"], ["choukai", "🎧 Choukai"]] as const).map(([v, l]) => (
                <button key={v} type="button" className={`pr-fchip${typeF === v ? " on" : ""}`} onClick={() => setTypeF(v as typeof typeF)}>{l}</button>
              ))}
              {levelsPresent.length > 1 && <span className="pr-fsep" />}
              {levelsPresent.length > 1 && levelsPresent.map(lv => (
                <button key={lv} type="button" className={`pr-fchip${levelF === lv ? " on" : ""}`} onClick={() => setLevelF(levelF === lv ? "all" : lv)}>{lv}</button>
              ))}
              {(typeF !== "all" || levelF !== "all") && <button type="button" className="pr-freset" onClick={resetF}>Reset</button>}
            </div>

            <div className="pr-grid">
              <main>
                {groups.map(g => {
                  const xp = g.items.reduce((n, s) => n + Math.round(((s.score ?? 0) / (s.total || 1)) * 20), 0);
                  return (
                    <div key={g.label} className="pr-tlgroup">
                      <div className="pr-tlhead">
                        <span className="pr-tllabel">{g.label}</span>
                        <span className="pr-tlcount">{g.items.length} sesi</span>
                        <div className="pr-tlline" />
                        <span className="pr-tlxp">+{xp} XP</span>
                      </div>
                      {g.items.map(s => {
                        const t = sessType(s);
                        const meta = TYPE_META[t];
                        const pct = Math.round(((s.score ?? 0) / (s.total || 1)) * 100);
                        const tn = tone(pct);
                        const href = t === "choukai" ? `/choukai/${s.id}` : `/analisis-foto?session=${s.id}`;
                        return (
                          <Link key={s.id} href={href} className={`pr-sess ${tn}`}>
                            <div className={`pr-sess-ic ${meta.ic}`}>{meta.icon}</div>
                            <div className="pr-sess-m">
                              <div className="pr-sess-t"><span className="pr-jpt">{shortTitle(s.title)}</span> <span className={`pr-typetag ${meta.tt}`}>{meta.tag}</span></div>
                              <div className="pr-sess-s">{timeStr(s.created_at)} <span className="pr-dot" /> {s.total} soal</div>
                            </div>
                            <div className="pr-sess-score"><div className={`pr-ss-pct ${tn}`}>{pct}%</div><div className="pr-ss-frac">{s.score} / {s.total}</div></div>
                            <div className="pr-sess-act"><span className={`pr-sa${tn === "bad" ? " solid" : ""}`}>{tn === "bad" ? <><RotateCcw size={12} /> Ulangi</> : "Review →"}</span></div>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </main>

              <aside className="pr-side">
                <div className="glass-card pr-scard">
                  <div className="pr-scard-h">Aktivitas 7 hari</div>
                  <div className="pr-wkrow">
                    {week.map((w, i) => (
                      <div key={i} className="pr-wkc"><div className={`pr-wkb${w.n === 0 ? " mut" : ""}${w.now ? " now" : ""}`} style={{ height: `${Math.max(6, w.h)}%` }} /><span className={`pr-wkl${w.now ? " now" : ""}`}>{w.l}</span></div>
                    ))}
                  </div>
                  <div className="pr-wknote"><b>{activeDays} dari 7 hari</b> aktif · streak {streak} hari 🔥</div>
                </div>

                <div className="glass-card pr-scard">
                  <div className="pr-scard-h">Akurasi per kategori</div>
                  {catAcc.map(c => (
                    <div key={c.jp} className="pr-krow">
                      <span className="pr-kjp">{c.jp}<span className="pr-kro">{c.ro}</span></span>
                      <div className="pr-ktrack"><div className="pr-kfill" style={{ width: `${c.pct ?? 0}%`, background: c.pct == null ? "var(--surface-3)" : c.pct >= 75 ? "var(--accent-emerald)" : c.pct >= 65 ? "var(--accent-amber)" : "var(--accent-rose)" }} /></div>
                      <span className="pr-kpct">{c.pct != null ? `${c.pct}%` : "—"}</span>
                    </div>
                  ))}
                </div>

                {weakest && (
                  <div className="glass-card pr-scard pr-insight">
                    <div className="pr-scard-h" style={{ color: "var(--accent-primary, #E8704F)" }}>Insight</div>
                    <p>Kategori terlemah kamu: <b>{weakest.jp} ({weakest.ro})</b> di <b>{weakest.pct}%</b>. Fokus latihan di sini biar naik.</p>
                    <Link href="/materi#bank-soal" className="pr-go">Latihan sekarang →</Link>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </>
  );
}
