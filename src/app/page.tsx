"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav } from "@/components/v2";

interface Session {
  id: string;
  level: string;
  category: string;
  title: string;
  total: number;
  score: number | null;
  created_at: string;
  section?: string | null;
}

const categoryGlyph: Record<string, string> = { "文法": "文", "語彙": "語", "文字": "字", "読解": "読", "AI": "全" };
/* warna glyph riwayat per section/kategori */
function riwStyle(s: Session): { bg: string; bd: string; fg: string; g: string } {
  if (s.section === "choukai") return { bg: "rgba(107,125,92,0.16)", bd: "rgba(107,125,92,0.45)", fg: "#92A67F", g: "聴" };
  const map: Record<string, [string, string, string, string]> = {
    "読解": ["rgba(184,84,80,0.14)", "rgba(184,84,80,0.4)", "#D07E7A", "読"],
    "文法": ["rgba(74,124,126,0.14)", "rgba(74,124,126,0.4)", "#6FA5A7", "文"],
    "語彙": ["rgba(139,90,140,0.16)", "rgba(139,90,140,0.4)", "#B583B6", "語"],
    "文字": ["rgba(199,123,63,0.14)", "rgba(199,123,63,0.4)", "#C77B3F", "字"],
  };
  const [bg, bd, fg, g] = map[s.category] ?? ["rgba(212,160,74,0.14)", "rgba(212,160,74,0.4)", "#D4A04A", categoryGlyph[s.category] ?? "全"];
  return { bg, bd, fg, g };
}
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000), hours = Math.floor(diff / 3_600_000), days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  if (hours < 24) return `Hari ini`;
  if (days === 1) return "kemarin";
  return `${days} hari lalu`;
}
const scorePct = (s: Session) => (s.score != null && s.total > 0 ? Math.round((s.score / s.total) * 100) : null);

const xp = 820, xpTarget = 1000; // TODO: profiles.xp

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalSoal, setTotalSoal] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [kotoba, setKotoba] = useState<number | null>(null);
  const [resume, setResume] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Yusuf");
  const [meta, setMeta] = useState<{ date: string; days: number | null }>({ date: "", days: null });

  useEffect(() => {
    async function load() {
      // tanggal + countdown (browser-only → lolos purity)
      const now = new Date();
      const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const exam = new Date(2026, 11, 6); // ~JLPT Des 2026
      const days = Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86_400_000));
      setMeta({ date: dateStr, days });

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const first = (user.user_metadata?.full_name || user.email || "Yusuf").split(/[ @]/)[0];
      setName(first.charAt(0).toUpperCase() + first.slice(1));

      const [profileRes, sessionRes, kotobaRes] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("sessions").select("id,level,category,title,total,score,created_at,ai_result->section")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("saved_words").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (profileRes.data) setStreak(profileRes.data.streak ?? 0);
      if (kotobaRes.count != null) setKotoba(kotobaRes.count);

      const sess = (sessionRes.data ?? []) as unknown as Session[];
      setSessions(sess.slice(0, 4));
      setTotalSoal(sess.reduce((s, r) => s + (r.total ?? 0), 0));
      setResume(sess.find(r => r.score == null) ?? sess[0] ?? null);
      const scored = sess.filter(r => r.score != null && r.total);
      if (scored.length > 0) setAvgScore(Math.round(scored.reduce((s, r) => s + (r.score! / r.total), 0) / scored.length * 100));
      setLoading(false);
    }
    load();
  }, []);

  const resumeHref = resume ? (resume.section === "choukai" ? `/choukai/${resume.id}` : `/latihan/${resume.id}`) : "/materi";
  const dash = "—";

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <div className="beranda-v2">
          {/* topbar */}
          <div className="bv-top">
            <div className="bv-greet">
              <h1>おかえり, {name} <span className="jp">頑張ろう!</span></h1>
              <p>{meta.date}{meta.days != null && ` · JLPT N2 · ${meta.days} hari lagi menuju ujian`}</p>
            </div>
            <div className="bv-top-r">
              <span className="bv-pill streak"><span className="fl">🔥</span> <b>{streak}</b> hari</span>
              <div className="bv-xp"><div className="bv-xp-top"><span>Level 8</span><b>{xp} / {xpTarget} XP</b></div><div className="bv-xp-bar"><i style={{ width: `${Math.round(xp / xpTarget * 100)}%` }} /></div></div>
              <span className="bv-lv">N2</span>
              <div className="bv-ava">{name[0]}</div>
            </div>
          </div>

          {/* resume */}
          {resume && (
            <Link href={resumeHref} className="bv-resume">
              <div className="res-ic">{resume.section === "choukai" ? "🎧" : "✍️"}</div>
              <div className="res-m">
                <div className="res-t">Lanjutin: <span className="jpt">{resume.title}</span></div>
                <div className="res-s">{scorePct(resume) != null ? `Terakhir ${scorePct(resume)}%` : "Belum kamu kerjain"} · {relativeTime(resume.created_at)}</div>
              </div>
              <span className="btn btn-p">▶ Lanjutin</span>
            </Link>
          )}

          {/* stats */}
          <div className="bv-stats">
            <div className="bv-stat card"><div className="stat-l"><span className="stat-ic" style={{ background: "rgba(221,65,36,0.14)" }}>📷</span>Soal Dianalisis</div><div className="stat-v">{loading ? dash : totalSoal}<span className="u">soal</span></div><div className="stat-d up">total kumulatif</div></div>
            <div className="bv-stat card"><div className="stat-l"><span className="stat-ic" style={{ background: "rgba(107,142,63,0.16)" }}>🎯</span>Akurasi</div><div className="stat-v">{loading || avgScore == null ? dash : avgScore}<span className="u">%</span></div><div className="stat-d up">rata-rata sesi</div></div>
            <div className="bv-stat card"><div className="stat-l"><span className="stat-ic" style={{ background: "rgba(212,160,74,0.15)" }}>🔥</span>Streak</div><div className="stat-v">{loading ? dash : streak}<span className="u">hari</span></div><div className="stat-d flat">terus jaga!</div></div>
            <div className="bv-stat card"><div className="stat-l"><span className="stat-ic" style={{ background: "rgba(139,90,140,0.18)" }}>📖</span>Kotoba</div><div className="stat-v">{loading || kotoba == null ? dash : kotoba}<span className="u">kata</span></div><div className="stat-d up">di Kamus kamu</div></div>
          </div>

          <div className="bv-grid">
            <div className="bv-col">
              {/* kanji + quiz */}
              <div className="bv-duo">
                <div className="bv-kanji card">
                  <div className="kj-stage"><span className="kj">諦</span></div>
                  <div className="kj-meta">
                    <div className="tagrow"><span className="tag tag-day">● Kanji Hari Ini</span><span className="tag tag-n2">N2</span></div>
                    <div className="kj-read">あきら・める<span className="rom">akirameru</span></div>
                    <div className="kj-mean">Menyerah, melepaskan harapan — sering muncul di reading N2.</div>
                    <div className="kj-ex">夢を <span className="hl">諦</span>めない 限り、必ず 道は 開ける。<span className="tr">Selama tidak menyerah, jalan akan selalu terbuka.</span></div>
                  </div>
                </div>
                <div className="bv-quiz card">
                  <div className="q-head"><h3>⚡ Latihan Kilat</h3><span>1 / 5 · 文法</span></div>
                  <div className="q-q">昨日 友達 <span className="blank">＿＿</span> 久しぶりに会った。</div>
                  <div className="q-opts">
                    <div className="q-opt"><span className="q-k">A</span>を</div>
                    <div className="q-opt ok"><span className="q-k ok-k">B</span>と</div>
                    <div className="q-opt"><span className="q-k">C</span>に</div>
                    <div className="q-opt"><span className="q-k">D</span>が</div>
                  </div>
                  <div className="q-foot"><span>4 soal lagi · ~2 menit</span><Link href="/lembar-tugas" className="btn btn-p sm">▶ Mulai</Link></div>
                </div>
              </div>

              {/* fokus latihan 5 kategori */}
              <div className="bv-fokus card">
                <div className="f-head"><h3>Fokus Latihan — akurasi per kategori</h3><Link href="/progres?tab=stat">Statistik lengkap →</Link></div>
                <div className="cats">
                  {FOCUS.map(c => (
                    <div key={c.ro} className={`cat c-${c.ro.toLowerCase()}`}>
                      <div className="cat-jp">{c.jp}</div><div className="cat-ro">{c.ro}</div>
                      <div className="cat-bar"><i style={{ width: `${c.pct}%` }} /></div>
                      <div className="cat-pct">{c.pct}%</div><div className="cat-n">{c.n} soal</div>
                    </div>
                  ))}
                </div>
                <div className="f-note">💡 <span><b>読解 paling lemah (58%)</b> — pola salah: soal &quot;main idea&quot; teks panjang.</span><Link href="/materi" className="btn btn-p sm">Drill Dokkai →</Link></div>
              </div>

              {/* materi shortcuts */}
              <div className="bv-materi2">
                <Link href="/kamus" className="m-card card"><span className="m-glyph">語</span><div className="m-ic goi">📖</div><div className="m-m"><div className="m-t">Kotoba N2</div><div className="m-s">{kotoba != null ? `${kotoba} kata di Kamus kamu` : "Kamus kotoba pribadi"}</div></div></Link>
                <Link href="/materi/bunpou" className="m-card card"><span className="m-glyph">文</span><div className="m-ic bun">📐</div><div className="m-m"><div className="m-t">Bunpou N2</div><div className="m-s">Pola grammar lengkap per level</div></div></Link>
              </div>
            </div>

            {/* sidebar */}
            <aside className="bv-side">
              <div className="bv-scard card">
                <div className="s-h">Target Ujian</div>
                <div className="cd">
                  <div className="cd-ring">
                    <svg width="74" height="74" viewBox="0 0 74 74"><circle cx="37" cy="37" r="32" fill="none" stroke="var(--surface-3)" strokeWidth="6" /><circle cx="37" cy="37" r="32" fill="none" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" strokeDasharray="201" strokeDashoffset={meta.days != null ? Math.max(0, 201 - 201 * Math.min(1, (365 - Math.min(365, meta.days)) / 365)) : 80} transform="rotate(-90 37 37)" /></svg>
                    <span className="n">{meta.days ?? dash}</span>
                  </div>
                  <div className="cd-m"><div className="cd-t">JLPT N2 · Des 2026</div><div className="cd-s">{meta.days != null ? `${meta.days} hari lagi — jaga pace kamu, konsisten menang.` : ""}</div></div>
                </div>
              </div>

              <div className="bv-scard card">
                <div className="s-h">Aktivitas 7 hari <span className="r">+18% vs lalu</span></div>
                <div className="wk">
                  {WEEK.map((c, i) => (
                    <div className="wkc" key={i}><div className={`wkb${c.mut ? " mut" : ""}${c.now ? " now" : ""}`} style={{ height: `${Math.max(c.v, 5)}%` }} /><span className={`wkl${c.now ? " now" : ""}`}>{c.d}</span></div>
                  ))}
                </div>
                <div className="wk-note"><b>6 dari 7 hari</b> aktif — streak {streak} hari 🔥 jaga hari ini!</div>
              </div>

              <div className="bv-scard card">
                <div className="s-h">Riwayat Terakhir <Link href="/progres?tab=log" className="s-all">Semua →</Link></div>
                <div className="riw">
                  {loading ? <div className="riw-empty">memuat…</div>
                    : sessions.length === 0 ? <div className="riw-empty">Belum ada sesi latihan</div>
                    : sessions.map(s => {
                      const st = riwStyle(s); const pct = scorePct(s);
                      return (
                        <Link key={s.id} href={s.section === "choukai" ? `/choukai/${s.id}` : `/analisis-foto?session=${s.id}`} className="riw-i">
                          <span className="riw-g" style={{ background: st.bg, borderColor: st.bd, color: st.fg }}>{st.g}</span>
                          <div className="riw-m"><div className="riw-t">{s.title}</div><div className="riw-s">{relativeTime(s.created_at)} · {s.total} soal</div></div>
                          {pct != null && <span className={`riw-sc ${pct >= 80 ? "sc-g" : "sc-m"}`}>{pct}%</span>}
                        </Link>
                      );
                    })}
                </div>
              </div>

              <div className="bv-scard card insight">
                <div className="s-h" style={{ color: "#E8704F" }}>Tips Belajar</div>
                <p>Upload foto soal yang bikin bingung — AI bakal jelasin grammar &amp; vocab-nya. <b>Fokus 1 kategori</b> per sesi biar nempel.</p>
                <Link href="/analisis-foto?mode=camera" className="btn btn-p sm">📷 Analisis Foto</Link>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

/* static — TODO: per-kategori accuracy dari sessions */
const FOCUS = [
  { jp: "文字", ro: "Moji", pct: 90, n: 124 },
  { jp: "語彙", ro: "Goi", pct: 81, n: 156 },
  { jp: "文法", ro: "Bunpou", pct: 72, n: 203 },
  { jp: "読解", ro: "Dokkai", pct: 58, n: 89 },
  { jp: "聴解", ro: "Choukai", pct: 84, n: 67 },
];
/* static — TODO: aggregate sessions by day-of-week */
const WEEK: { d: string; v: number; mut?: boolean; now?: boolean }[] = [
  { d: "S", v: 34 }, { d: "S", v: 58 }, { d: "R", v: 6, mut: true }, { d: "K", v: 74 },
  { d: "J", v: 48 }, { d: "S", v: 62 }, { d: "M", v: 88, now: true },
];
