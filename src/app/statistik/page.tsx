"use client";

import { useEffect, useMemo, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import {
  Camera, BarChart3, Zap, BookA, ArrowUp, ArrowDown, Sparkles, Star,
} from "lucide-react";
import { useUserStats } from "@/lib/use-user-stats";

type Level = "N1" | "N2" | "N3" | "N4" | "N5";
type Period = 7 | 30 | 90 | 0; // 0 = all-time

/* Ringkasan kompak per-sesi yang disimpan di ai_result.stats sama
   analisis-foto pas jawaban ke-save (perCat: {kategori: {a:answered, c:correct}}).
   Statistik cukup fetch ini (ringan ±KB), gak perlu narik ai_result full. */
interface SessionStats {
  answered: number;
  correct: number;
  perCat?: Record<string, { a: number; c: number }>;
}
interface RawSession {
  id: string;
  level: Level | null;
  category: string | null;
  total: number;
  score: number | null;
  created_at: string;
  stats: SessionStats | null; // dari sub-select ai_result->stats
}

type CatStat = { answered: number; correct: number };
interface Derived { answered: number; correct: number; perCat: Record<string, CatStat> }

const KATEGORI_LABEL: Record<string, string> = {
  "文法": "Bunpou",
  "語彙": "Goi",
  "読解": "Dokkai",
  "聴解": "Choukai",
  "文字": "Moji",
};

const KATEGORI_ORDER = ["文法", "語彙", "読解", "聴解", "文字"] as const;
const LEVELS_ORDER: Level[] = ["N1", "N2", "N3", "N4", "N5"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HOUR_BUCKETS = [
  { label: "06–09", start: 6 },
  { label: "09–12", start: 9 },
  { label: "12–15", start: 12 },
  { label: "15–18", start: 15 },
  { label: "18–21", start: 18 },
  { label: "21–24", start: 21 },
];

function withinPeriod(iso: string, days: number): boolean {
  if (days === 0) return true;
  const age = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return age < days;
}

function colorForPct(pct: number): "iris" | "amber" | "emerald" | "rose" {
  if (pct >= 80) return "emerald";
  if (pct >= 65) return "amber";
  if (pct > 0)   return "rose";
  return "iris";
}

export function StatistikView({ embedded = false }: { embedded?: boolean }) {
  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [savedWordsCount, setSavedWordsCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const [period, setPeriod] = useState<Period>(30);
  const [loading, setLoading] = useState(true);

  const stats = useUserStats();
  const targetLevel = stats.targetLevel as Level;
  const xp = stats.xp;
  const xpTarget = stats.xpTarget;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());

      const [profileRes, sessionRes, wordsRes] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("sessions").select("id, level, category, total, score, created_at, ai_result->stats")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("saved_words").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (profileRes.data) setStreak(profileRes.data.streak ?? 0);
      setSessions((sessionRes.data ?? []) as RawSession[]);
      setSavedWordsCount(wordsRes.count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  /* ── Filtered subset for KPIs ── */
  const inPeriod = useMemo(() => sessions.filter(s => withinPeriod(s.created_at, period)), [sessions, period]);
  const prevPeriod = useMemo(() => {
    if (period === 0) return [];
    return sessions.filter(s =>
      !withinPeriod(s.created_at, period) && withinPeriod(s.created_at, period * 2)
    );
  }, [sessions, period]);

  /* {answered, correct, perCat} per sesi — dari ai_result.stats (sub-select). */
  const derived = useMemo(() => {
    const m = new Map<string, Derived>();
    sessions.forEach(s => {
      const st = s.stats;
      const perCat: Record<string, CatStat> = {};
      for (const [k, v] of Object.entries(st?.perCat ?? {})) {
        perCat[k] = { answered: v.a ?? 0, correct: v.c ?? 0 };
      }
      m.set(s.id, { answered: st?.answered ?? 0, correct: st?.correct ?? 0, perCat });
    });
    return m;
  }, [sessions]);

  const totalSoal = inPeriod.reduce((s, r) => s + (r.total ?? 0), 0);
  const totalSoalPrev = prevPeriod.reduce((s, r) => s + (r.total ?? 0), 0);
  const totalSoalDelta = totalSoal - totalSoalPrev;

  /* Akurasi overall = total benar ÷ total dijawab (gabung semua soal, partial
     ikut ngitung). null kalau belum ada soal yang dijawab. */
  const overallAcc = (subset: RawSession[]): number | null => {
    let a = 0, c = 0;
    subset.forEach(s => { const d = derived.get(s.id); if (d) { a += d.answered; c += d.correct; } });
    return a > 0 ? Math.round((c / a) * 100) : null;
  };
  const avgAccuracy = overallAcc(inPeriod);
  const avgAccuracyPrev = overallAcc(prevPeriod);
  const accuracyDelta = avgAccuracy != null && avgAccuracyPrev != null ? avgAccuracy - avgAccuracyPrev : null;

  /* ── Longest streak (from session dates) ── */
  const longestStreak = useMemo(() => {
    if (sessions.length === 0) return 0;
    const days = new Set(sessions.map(s => s.created_at.slice(0, 10)));
    const sorted = Array.from(days).sort();
    let best = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + "T00:00:00").getTime();
      const today = new Date(sorted[i] + "T00:00:00").getTime();
      if ((today - prev) / 86_400_000 === 1) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 1;
      }
    }
    return best;
  }, [sessions]);

  /* ── Saved words this week delta ── */
  const wordsDelta = useMemo(() => {
    // Placeholder — saved_words tidak punya created_at di query kita. Skip delta.
    return null as number | null;
  }, []);

  /* ── Monthly trend (last 5 months) ── */
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const buckets: { m: string; v: number; current: boolean }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const count = sessions.filter(s => {
        const ts = new Date(s.created_at).getTime();
        return ts >= d.getTime() && ts < next.getTime();
      }).reduce((sum, s) => sum + (s.total ?? 0), 0);
      buckets.push({ m: MONTH_NAMES[d.getMonth()], v: count, current: i === 0 });
    }
    return buckets;
  }, [sessions]);

  /* ── Akurasi per kategori (all-time, dari kategori ASLI tiap soal) +
        delta last 7d vs prev 7d ── */
  const katAccuracy = useMemo(() => {
    const all: Record<string, CatStat> = {};
    const w7: Record<string, CatStat> = {};
    const p7: Record<string, CatStat> = {};
    const bump = (bag: Record<string, CatStat>, cat: string, cs: CatStat) => {
      const b = bag[cat] ?? (bag[cat] = { answered: 0, correct: 0 });
      b.answered += cs.answered; b.correct += cs.correct;
    };
    sessions.forEach(s => {
      const d = derived.get(s.id);
      if (!d) return;
      const in7 = withinPeriod(s.created_at, 7);
      const inPrev7 = !in7 && withinPeriod(s.created_at, 14);
      for (const [cat, cs] of Object.entries(d.perCat)) {
        bump(all, cat, cs);
        if (in7) bump(w7, cat, cs);
        else if (inPrev7) bump(p7, cat, cs);
      }
    });
    const pctOf = (cs?: CatStat) => (cs && cs.answered > 0 ? Math.round((cs.correct / cs.answered) * 100) : null);
    return KATEGORI_ORDER.map(jp => {
      const A = all[jp] ?? { answered: 0, correct: 0 };
      const pct = A.answered > 0 ? Math.round((A.correct / A.answered) * 100) : 0;
      const last7Pct = pctOf(w7[jp]);
      const prev7Pct = pctOf(p7[jp]);
      const delta = last7Pct != null && prev7Pct != null ? last7Pct - prev7Pct : null;
      return {
        jp: jp as string,
        label: KATEGORI_LABEL[jp] ?? "",
        pct, delta,
        soal: A.answered,
        color: colorForPct(pct),
        present: A.answered > 0,
      };
    });
  }, [sessions, derived]);

  /* ── Level mastery (akurasi per level, dari soal yang dijawab) ── */
  const levelMastery = useMemo(() => {
    return LEVELS_ORDER.map(lv => {
      let answered = 0, correct = 0;
      sessions.forEach(s => {
        if (s.level !== lv) return;
        const d = derived.get(s.id);
        if (d) { answered += d.answered; correct += d.correct; }
      });
      const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      return { lv, pct, soal: answered, target: lv === targetLevel };
    });
  }, [sessions, derived, targetLevel]);

  /* ── Records ── */
  const records = useMemo(() => {
    if (sessions.length === 0) {
      return {
        longestStreak: 0, maxSesiSehari: 0, maxSoalSehari: 0,
        topAkurasi: null as { pct: number; label: string } | null,
        bulanTerbaik: null as { name: string; count: number } | null,
      };
    }
    // sesi sehari / soal sehari
    const perDay = new Map<string, { sesi: number; soal: number }>();
    sessions.forEach(s => {
      const k = s.created_at.slice(0, 10);
      const prev = perDay.get(k) ?? { sesi: 0, soal: 0 };
      perDay.set(k, { sesi: prev.sesi + 1, soal: prev.soal + (s.total ?? 0) });
    });
    const arr = Array.from(perDay.values());
    const maxSesiSehari = arr.length > 0 ? Math.max(...arr.map(d => d.sesi)) : 0;
    const maxSoalSehari = arr.length > 0 ? Math.max(...arr.map(d => d.soal)) : 0;

    // top akurasi sesi — dari soal yang udah dijawab (min. 1 dijawab)
    const scoredArr = sessions
      .map(s => {
        const d = derived.get(s.id);
        if (!d || d.answered === 0) return null;
        return { pct: Math.round((d.correct / d.answered) * 100), label: `${s.level ?? ""} ${s.category ?? ""}`.trim() };
      })
      .filter((x): x is { pct: number; label: string } => x != null)
      .sort((a, b) => b.pct - a.pct);
    const topAkurasi = scoredArr[0] ?? null;

    // bulan terbaik
    const perMonth = new Map<string, number>();
    sessions.forEach(s => {
      const d = new Date(s.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      perMonth.set(k, (perMonth.get(k) ?? 0) + (s.total ?? 0));
    });
    const bulanArr = Array.from(perMonth.entries()).sort((a, b) => b[1] - a[1]);
    const bulanTerbaik = bulanArr[0]
      ? (() => {
          const [y, m] = bulanArr[0][0].split("-").map(Number);
          return { name: `${MONTH_NAMES[m]} ${y}`, count: bulanArr[0][1] };
        })()
      : null;

    return { longestStreak, maxSesiSehari, maxSoalSehari, topAkurasi, bulanTerbaik };
  }, [sessions, longestStreak, derived]);

  /* ── Jam belajar favorit ── */
  const hourBuckets = useMemo(() => {
    const counts = new Array(HOUR_BUCKETS.length).fill(0);
    sessions.forEach(s => {
      const h = new Date(s.created_at).getHours();
      const idx = HOUR_BUCKETS.findIndex((b, i) => {
        const next = HOUR_BUCKETS[i + 1]?.start ?? 24;
        return h >= b.start && h < next;
      });
      if (idx >= 0) counts[idx]++;
    });
    const max = Math.max(...counts, 1);
    return HOUR_BUCKETS.map((b, i) => ({ hour: b.label, v: counts[i] / max, count: counts[i] }));
  }, [sessions]);
  const bestHour = hourBuckets.length > 0
    ? hourBuckets.reduce((best, h) => h.v > best.v ? h : best, hourBuckets[0])
    : null;

  /* ── Insight: lowest-accuracy category ── */
  const insight = useMemo(() => {
    const withData = katAccuracy.filter(k => k.present);
    if (withData.length === 0) return null;
    const worst = withData.reduce((w, k) => k.pct < w.pct ? k : w, withData[0]);
    return worst;
  }, [katAccuracy]);

  const inner = (
    <>
      <header className="st-header">
          <div>
            <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Statistik" }]} />
            <h1 className="st-title">
              Statistik <span className="st-title-jp">統計</span>
            </h1>
            <p className="st-sub">Lacak progresnya selama belajar. Update otomatis tiap sesi.</p>
          </div>
          <div className="st-period">
            <span className="st-period-label">Periode</span>
            <div className="period-pills">
              {([7, 30, 90, 0] as Period[]).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`pp-chip${period === p ? " on" : ""}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === 0 ? "Semua" : `${p} hari`}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="st-kpi-row">
          <KPICard
            label="Total Soal Dianalisis"
            value={loading ? "—" : totalSoal.toLocaleString("id-ID")}
            delta={totalSoalDelta !== 0 && period !== 0 ? `${totalSoalDelta > 0 ? "+" : ""}${totalSoalDelta}` : null}
            deltaPositive={totalSoalDelta >= 0}
            Icon={Camera}
            accent="iris"
            sub={period === 0 ? "sepanjang waktu" : `vs ${period} hari sebelumnya`}
          />
          <KPICard
            label="Akurasi Rata-rata"
            value={loading ? "—" : avgAccuracy != null ? `${avgAccuracy}%` : "—"}
            delta={accuracyDelta != null && accuracyDelta !== 0 ? `${accuracyDelta > 0 ? "+" : ""}${accuracyDelta}%` : null}
            deltaPositive={(accuracyDelta ?? 0) >= 0}
            Icon={BarChart3}
            accent="emerald"
            sub={accuracyDelta != null ? `${accuracyDelta >= 0 ? "naik" : "turun"} ${Math.abs(accuracyDelta)} poin` : "belum ada perbandingan"}
          />
          <KPICard
            label="Streak Terpanjang"
            value={loading ? "—" : String(longestStreak)}
            valueUnit=" hari"
            Icon={Zap}
            accent="amber"
            sub={`sekarang: ${streak} hari aktif`}
          />
          <KPICard
            label="Kotoba di Kamus"
            value={loading ? "—" : savedWordsCount.toLocaleString("id-ID")}
            delta={wordsDelta != null ? `+${wordsDelta}` : null}
            deltaPositive
            Icon={BookA}
            accent="rose"
            sub="tersimpan otomatis"
          />
        </div>

        <div className="st-grid">
          <div className="st-main">
            {/* Trend chart */}
            <section className="glass-card st-card">
              <div className="st-card-head">
                <div>
                  <span className="st-card-eyebrow">Trend Bulanan</span>
                  <h3 className="st-card-title">Soal dianalisis per bulan</h3>
                </div>
              </div>
              <TrendChart data={monthlyTrend} />
            </section>

            {/* Kategori accuracy */}
            <section className="glass-card st-card">
              <div className="st-card-head">
                <div>
                  <span className="st-card-eyebrow">Akurasi per Kategori</span>
                  <h3 className="st-card-title">Mana yang masih bisa di-improve</h3>
                </div>
                <Link className="st-link" href="/riwayat-soal">Lihat detail →</Link>
              </div>
              <div className="kat-acc-rows">
                {katAccuracy.map(k => (
                  <div className="kat-acc-row" key={k.jp}>
                    <div className="kat-acc-label">
                      <div className="kar-text">
                        <span className="kar-jp">{k.jp}</span>
                        <span className="kar-ro">{k.label}</span>
                      </div>
                      <span className="kar-soal">{k.soal} soal</span>
                    </div>
                    <div className="kat-acc-bar">
                      {k.present && (
                        <div className={`kab-fill cat-${k.color}`} style={{ width: `${k.pct}%` }} />
                      )}
                      <div className="kab-marker" style={{ left: "80%" }} title="Target 80%" />
                    </div>
                    <div className={`kat-acc-pct kat-pct-${k.color}`}>
                      {k.present ? `${k.pct}%` : "—"}
                      {k.delta != null && k.delta !== 0 && (
                        <span className={`kat-delta ${k.delta > 0 ? "up" : "down"}`}>
                          {k.delta > 0 ? "+" : ""}{k.delta}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="kat-acc-footer">
                <span className="kab-marker-legend">
                  <span className="lg-line" /> Target akurasi (80%)
                </span>
              </div>
            </section>

            {/* Level mastery */}
            <section className="glass-card st-card">
              <div className="st-card-head">
                <div>
                  <span className="st-card-eyebrow">Level Mastery</span>
                  <h3 className="st-card-title">Penguasaan per level JLPT</h3>
                </div>
              </div>
              <div className="level-progress">
                {levelMastery.map(l => (
                  <div
                    key={l.lv}
                    className={`lp-row lp-${l.lv.toLowerCase()}${l.target ? " target" : ""}`}
                  >
                    <div className="lp-label">
                      <span className={`lp-tag lv-${l.lv.toLowerCase()}`}>{l.lv}</span>
                      {l.target && <span className="lp-target-pill">TARGET KAMU</span>}
                    </div>
                    <div className="lp-bar-wrap">
                      <div className="lp-bar">
                        <div className={`lp-fill lv-bar-${l.lv.toLowerCase()}`} style={{ width: `${l.pct}%` }} />
                      </div>
                      <span className="lp-soal">{l.soal} soal</span>
                    </div>
                    <div className="lp-pct">{l.pct}%</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="st-side">
            {/* Insight */}
            <div className="glass-card st-side-card glow-iris">
              <div className="st-side-head">
                <Sparkles size={13} fill="var(--accent-iris)" strokeWidth={1.2} style={{ color: "var(--accent-iris)" }} />
                Insight Sensei
              </div>
              {insight ? (
                <>
                  <p className="st-insight-title">
                    Akurasi <strong style={{ color: "var(--text-primary)" }}>{insight.jp} ({insight.label})</strong> paling rendah ({insight.pct}%).
                  </p>
                  <p className="st-insight-body">
                    Coba latih lebih banyak soal kategori ini — atau buka <strong>Analisis Foto</strong> dan analisis materi {insight.label} buat boost akurasi.
                  </p>
                  <Link href="/analisis-foto" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                    Mulai sesi fokus →
                  </Link>
                </>
              ) : (
                <p className="st-insight-body">
                  Belum ada cukup data buat insight. Coba selesaikan beberapa sesi dengan jawaban dulu.
                </p>
              )}
            </div>

            {/* Records */}
            <div className="glass-card st-side-card">
              <div className="st-side-head">
                <Star size={12} fill="var(--accent-amber)" strokeWidth={1} style={{ color: "var(--accent-amber)" }} />
                Rekor Kamu
              </div>
              <ul className="record-list">
                <li><span>Streak terpanjang</span><strong>{records.longestStreak} hari</strong></li>
                <li><span>Sesi sehari</span><strong>{records.maxSesiSehari} sesi</strong></li>
                <li><span>Soal di 1 hari</span><strong>{records.maxSoalSehari} soal</strong></li>
                <li>
                  <span>Akurasi tertinggi</span>
                  <strong>
                    {records.topAkurasi ? `${records.topAkurasi.pct}% (${records.topAkurasi.label})` : "—"}
                  </strong>
                </li>
                <li>
                  <span>Bulan terbaik</span>
                  <strong>{records.bulanTerbaik ? records.bulanTerbaik.name : "—"}</strong>
                </li>
              </ul>
            </div>

            {/* Habits */}
            <div className="glass-card st-side-card">
              <div className="st-side-head">Jam Belajar Favorit</div>
              <div className="time-heatmap">
                {hourBuckets.map(s => (
                  <div className="tm-row" key={s.hour}>
                    <span className="tm-hour">{s.hour}</span>
                    <div className="tm-track">
                      <div
                        className="tm-fill"
                        style={{ width: `${Math.max(s.v * 100, 2)}%`, opacity: Math.max(s.v, 0.15) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {bestHour && bestHour.count > 0 ? (
                <p className="tm-tip">
                  Kamu paling produktif <strong>jam {bestHour.hour}</strong>.
                </p>
              ) : (
                <p className="tm-tip">Belum ada data sesi yang cukup.</p>
              )}
            </div>
          </aside>
        </div>
    </>
  );

  // Embedded (tab Statistik di /progres): tanpa chrome — parent yang kasih.
  if (embedded) return inner;
  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={streak} xp={xp} xpTarget={xpTarget} avatarLetter={userInitial} isPro={stats.isPro} />
        {inner}
      </main>
    </>
  );
}

// /statistik digabung ke /progres (tab Statistik). Redirect; konten dipakai
// via named export StatistikView di /progres.
export default function StatistikPage() {
  redirect("/progres?tab=stat");
}

/* ─── Subcomponents ─── */

interface KPIProps {
  label: string;
  value: string;
  valueUnit?: string;
  delta?: string | null;
  deltaPositive?: boolean;
  Icon: typeof Camera;
  accent: "iris" | "emerald" | "amber" | "rose";
  sub: string;
}

function KPICard({ label, value, valueUnit, delta, deltaPositive, Icon, accent, sub }: KPIProps) {
  return (
    <div className={`glass-card kpi-card kpi-${accent}`}>
      <div className="kpi-row">
        <div className="kpi-icon"><Icon size={15} strokeWidth={1.6} /></div>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">
        {value}{valueUnit && <span className="kpi-unit">{valueUnit}</span>}
        {delta && (
          <span className={`kpi-delta ${deltaPositive ? "up" : "down"}`}>
            {deltaPositive
              ? <ArrowUp size={10} strokeWidth={2.6} />
              : <ArrowDown size={10} strokeWidth={2.6} />}
            {delta}
          </span>
        )}
      </div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

function TrendChart({ data }: { data: { m: string; v: number; current: boolean }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map(d => d.v), 1);
  const w = 100, h = 100;
  const xs = data.map((_, i) => (i / Math.max(data.length - 1, 1)) * w);
  const ys = data.map(d => h - (d.v / max) * h * 0.85);
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const areaPath = `M0,${h} L${points.replace(/ /g, " L")} L${w},${h} Z`;

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="tc-svg">
        <defs>
          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(221, 65, 36, 0.4)" />
            <stop offset="100%" stopColor="rgba(221, 65, 36, 0)" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(t => (
          <line key={t} x1="0" y1={h * t} x2={w} y2={h * t} stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
        ))}
        <path d={areaPath} fill="url(#trendArea)" />
        <polyline points={points} fill="none" stroke="var(--accent-iris)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        {xs.map((x, i) => (
          <circle
            key={i}
            cx={x} cy={ys[i]} r="1.2"
            fill={data[i].current ? "#FFFFFF" : "var(--accent-iris)"}
            stroke={data[i].current ? "var(--accent-iris)" : "none"}
            strokeWidth="0.8"
          />
        ))}
      </svg>
      <div className="tc-x-axis" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
        {data.map(d => (
          <span key={d.m} className={d.current ? "on" : ""}>
            <strong>{d.v}</strong>
            <span>{d.m}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
