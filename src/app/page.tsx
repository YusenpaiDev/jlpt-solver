"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import {
  History, BarChart3, Sparkles, Camera, Play, Bookmark, ArrowUpRight, ArrowRight, Loader2,
} from "lucide-react";

interface Session {
  id: string;
  level: string;
  category: string;
  title: string;
  total: number;
  score: number | null;
  created_at: string;
}

const categoryGlyph: Record<string, string> = {
  "文法": "文",
  "語彙": "語",
  "文字": "字",
  "読解": "読",
  "AI":   "全",
};

function scoreClass(score: number | null, total: number): "good" | "mid" | "iris" | null {
  if (score == null || total === 0) return null;
  const pct = score / total;
  if (pct >= 0.85) return "good";
  if (pct >= 0.7)  return "iris";
  return "mid";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return "baru saja";
  if (mins  < 60)  return `${mins} menit lalu`;
  if (hours < 24)  return `${hours} jam lalu`;
  if (days  === 1) return "kemarin";
  return `${days} hari lalu`;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalSoal, setTotalSoal] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [userInitial, setUserInitial] = useState("Y");

  // XP not yet in `profiles` schema — placeholder until DB has it.
  const xp = 820;
  const xpTarget = 1000;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());

      const [profileRes, sessionRes] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("sessions").select("id,level,category,title,total,score,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      if (profileRes.data) setStreak(profileRes.data.streak ?? 0);

      const sess: Session[] = sessionRes.data ?? [];
      setSessions(sess.slice(0, 4));
      setTotalSoal(sess.reduce((s, r) => s + (r.total ?? 0), 0));

      const scored = sess.filter(r => r.score != null && r.total);
      if (scored.length > 0) {
        const avg = scored.reduce((s, r) => s + (r.score! / r.total), 0) / scored.length;
        setAvgScore(Math.round(avg * 100));
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />

      <main className="app-shell">
        <div className="top-bar">
          <Breadcrumb items={[{ label: "Sensei", href: "/" }, { label: "Beranda" }]} />
          <UserBar
            streakDays={streak}
            xp={xp}
            xpTarget={xpTarget}
            avatarLetter={userInitial}
            isPro
            hasUnread
          />
        </div>

        <div className="beranda-grid">
          <div className="beranda-main">
            <HeroBlock totalSoal={totalSoal} avgScore={avgScore} streak={streak} xp={xp} xpTarget={xpTarget} loading={loading} />
            <div className="featured-row">
              <KanjiOfDay />
              <QuickPractice />
            </div>
          </div>
          <aside className="side-panel">
            <RiwayatPreview sessions={sessions} loading={loading} />
            <ProgressMingguan />
            <FokusLatihan />
          </aside>
        </div>
      </main>
    </>
  );
}

/* ─── Hero ─────────────────────────────────────────────────── */

function HeroBlock({
  totalSoal, avgScore, streak, xp, xpTarget, loading,
}: { totalSoal: number; avgScore: number | null; streak: number; xp: number; xpTarget: number; loading: boolean }) {
  return (
    <section className="hero-section">
      <div>
        <div className="section-eyebrow">
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-iris)", boxShadow: "0 0 8px var(--accent-iris)" }} />
          Sensei JLPT · AI
        </div>
        <h1 className="hero-headline">
          Belajar tanpa rame.<br />
          <span className="jp">深</span>く, <span className="jp">速</span>く, <span className="jp">確</span>かに.
        </h1>
        <p className="hero-sub">
          Upload foto soal. AI yang baca grammar &amp; vocab. Kamu yang fokus belajar — bukan
          nyari arti satu-satu di tab lain.
        </p>
        <div className="cta-row">
          <Link href="/analisis-foto?mode=camera" className="btn btn-primary btn-lg">
            <Camera size={16} strokeWidth={1.8} /> Ambil Foto
          </Link>
          <Link href="/analisis-foto?mode=upload" className="btn btn-secondary btn-lg">
            Unggah Soal <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="glass-card hero-stat glow-iris">
        <div className="hero-stat-label">
          <span className="dot" /> Soal Dianalisis
        </div>
        <div>
          <span className="hero-stat-value">{loading ? "—" : totalSoal}</span>
          <span className="hero-stat-unit">soal</span>
        </div>
        {!loading && totalSoal > 0 && (
          <div className="hero-stat-delta">
            <Sparkles size={11} strokeWidth={2} /> total kumulatif
          </div>
        )}
        <div className="hero-stat-secondary">
          <div>
            <div className="sec-stat-label">Akurasi</div>
            <div className="sec-stat-value">
              {loading ? "—" : avgScore != null ? <>{avgScore}<span className="pct">%</span></> : "—"}
            </div>
          </div>
          <div>
            <div className="sec-stat-label">Streak</div>
            <div className="sec-stat-value">
              {loading ? "—" : <>{streak}<span className="pct-muted">hari</span></>}
            </div>
          </div>
          <div>
            <div className="sec-stat-label">XP</div>
            <div className="sec-stat-value">
              {xp}<span className="pct-slash">/{xpTarget}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Kanji of the day (static for now — TODO: source from saved_words + rotation) ─────── */

function KanjiOfDay() {
  return (
    <div className="glass-card kanji-of-day interactive">
      <div className="kanji-hero-stage">
        <div className="kanji-glow" />
        <div className="kanji-glyph">諦</div>
      </div>
      <div className="kanji-meta">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="kanji-tag"><span className="pulse" /> Kanji Hari Ini</span>
          <span className="kanji-tag level">N2</span>
        </div>
        <div>
          <p className="kanji-reading">
            あきら・める <span className="romaji">akirameru</span>
          </p>
          <p className="kanji-meaning">
            Menyerah, melepaskan harapan. Sering muncul di reading N2 — pasangan kanji
            dengan nuansa keputusan emosional.
          </p>
        </div>
        <div className="kanji-example">
          夢を <span className="accent">諦</span>めない 限り、 必ず 道は 開ける。
          <span className="translation">Selama tidak menyerah, jalan akan selalu terbuka.</span>
        </div>
        <div className="kanji-actions">
          <button className="btn btn-primary btn-sm" type="button">
            <Bookmark size={13} fill="currentColor" strokeWidth={1.8} /> Tambah ke Favorit
          </button>
          <Link href="/kamus" className="btn btn-ghost btn-sm">
            Lihat di Kamus →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Latihan Kilat (static preview — TODO: pull 1 random unanswered soal) ────────────── */

function QuickPractice() {
  return (
    <div className="glass-card quick-prac interactive">
      <div className="qp-head">
        <h3 className="qp-title">Latihan Kilat</h3>
        <span className="qp-count">1 / 5 · 文法</span>
      </div>
      <p className="qp-question">
        昨日 友達 <span className="blank">＿＿</span> 久しぶり に 会った。
      </p>
      <div className="qp-options">
        <div className="qp-option">
          <span className="qp-option-key">A</span> を
        </div>
        <div className="qp-option correct">
          <span className="qp-option-key">B</span> と
        </div>
        <div className="qp-option">
          <span className="qp-option-key">C</span> に
        </div>
        <div className="qp-option">
          <span className="qp-option-key">D</span> が
        </div>
      </div>
      <div className="qp-foot">
        <span className="qp-foot-meta">4 soal lagi · ~2 menit</span>
        <Link href="/lembar-tugas" className="btn btn-primary btn-sm">
          <Play size={11} fill="currentColor" strokeWidth={1.8} /> Mulai
        </Link>
      </div>
    </div>
  );
}

/* ─── Side panel ──────────────────────────────────────────── */

function RiwayatPreview({ sessions, loading }: { sessions: Session[]; loading: boolean }) {
  return (
    <div className="glass-card panel-card">
      <div className="panel-head">
        <h3 className="panel-title">
          <History size={14} /> Riwayat Soal
        </h3>
        <Link href="/riwayat-soal" className="panel-link">
          Lihat semua <ArrowUpRight size={10} style={{ display: "inline", verticalAlign: "middle" }} />
        </Link>
      </div>
      <div className="riwayat-list">
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0", color: "var(--text-tertiary)" }}>
            <Loader2 className="animate-spin" size={16} />
          </div>
        ) : sessions.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0" }}>
            Belum ada sesi latihan
          </p>
        ) : sessions.map(s => {
          const cls = scoreClass(s.score, s.total);
          return (
            <Link key={s.id} href={`/analisis-foto?session=${s.id}`} className="riwayat-item">
              <div className="ri-glyph">{categoryGlyph[s.category] ?? "全"}</div>
              <div className="ri-meta">
                <div className="ri-title">{s.title}</div>
                <div className="ri-sub">{relativeTime(s.created_at)} · {s.total} soal</div>
              </div>
              {cls && s.score != null && (
                <span className={`ri-score ${cls}`}>{s.score}/{s.total}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Progress mingguan (static — TODO: aggregate sessions by day-of-week) ────── */

const WEEKLY: { d: string; v: number; muted?: boolean; today?: boolean }[] = [
  { d: "S", v: 38 },
  { d: "S", v: 62 },
  { d: "R", v: 28 },
  { d: "K", v: 78 },
  { d: "J", v: 54 },
  { d: "S", v: 0, muted: true },
  { d: "M", v: 88, today: true },
];

function ProgressMingguan() {
  return (
    <div className="glass-card panel-card">
      <div className="panel-head">
        <h3 className="panel-title">
          <BarChart3 size={14} /> Progres Mingguan
        </h3>
        <span className="panel-link" style={{ color: "var(--accent-emerald)" }}>+18% vs minggu lalu</span>
      </div>
      <div className="weekly-chart">
        {WEEKLY.map((c, i) => (
          <div className="wc-col" key={i}>
            <div
              className={`wc-bar${c.muted ? " muted" : ""}${c.today ? " today" : ""}`}
              style={{ height: `${Math.max(c.v, 4)}%` }}
            />
            <span className={`wc-label${c.today ? " today" : ""}`}>{c.d}</span>
          </div>
        ))}
      </div>
      <p className="weekly-insight">
        Konsistensi makin bagus — <strong>6 dari 7 hari</strong> kamu sempat latihan minggu ini.
      </p>
    </div>
  );
}

/* ─── Fokus latihan (static — TODO: per-kategori accuracy from sessions) ────── */

const FOCUS: { label: string; pct: number; cls?: "amber" | "emerald" | "rose" }[] = [
  { label: "文法 Tata Bahasa", pct: 64, cls: "amber" },
  { label: "語彙 Kosakata",    pct: 82, cls: "emerald" },
  { label: "読解 Reading",     pct: 51, cls: "rose" },
  { label: "聴解 Listening",   pct: 73 },
];

function FokusLatihan() {
  return (
    <div className="glass-card panel-card">
      <div className="panel-head">
        <h3 className="panel-title">
          <Sparkles size={13} strokeWidth={1.6} /> Fokus Latihan
        </h3>
        <Link href="/pengaturan" className="panel-link">Atur →</Link>
      </div>
      <div className="focus-row">
        {FOCUS.map(f => (
          <div key={f.label}>
            <div className="focus-meta">
              <span className="focus-label">{f.label}</span>
              <span className="focus-pct">{f.pct}%</span>
            </div>
            <div className="focus-track">
              <div className={`focus-fill${f.cls ? ` ${f.cls}` : ""}`} style={{ width: `${f.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
