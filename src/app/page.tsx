"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav } from "@/components/v2";
import { useUserStats } from "@/lib/use-user-stats";
import kotobaN1 from "@/data/kotoba/N1.json";
import kotobaN2 from "@/data/kotoba/N2.json";
import kotobaN3 from "@/data/kotoba/N3.json";
import kotobaN4 from "@/data/kotoba/N4.json";
import kotobaN5 from "@/data/kotoba/N5.json";

interface Session {
  id: string;
  level: string;
  category: string;
  title: string;
  total: number;
  score: number | null;
  created_at: string;
  section?: string | null;
  stats?: { answered: number; correct: number; perCat?: Record<string, { a: number; c: number }> } | null;
  kind?: string | null;
}

/* 5 kategori — urutan tampilan sama kayak desain */
const FOCUS_CATS = [
  { jp: "文字", ro: "Moji" }, { jp: "語彙", ro: "Goi" }, { jp: "文法", ro: "Bunpou" },
  { jp: "読解", ro: "Dokkai" }, { jp: "聴解", ro: "Choukai" },
];
const DAY_LETTER = ["M", "S", "S", "R", "K", "J", "S"]; // getDay 0=Minggu … 6=Sabtu
type Focus = { jp: string; ro: string; pct: number | null; n: number };
type WeekDay = { d: string; h: number; v: number; now: boolean };

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

/* Sumber "Kanji Hari Ini". Dulu kartunya dipaku satu kanji (諦) — sama buat
   semua orang, tiap hari, selamanya. Sekarang dari dataset kotoba beneran,
   disaring yang ada kanjinya (281 dari 505). Contoh kalimat gak ada di dataset,
   jadi barisnya cuma dirender kalau memang ada. */
interface KanjiVocab { word?: string; reading?: string; meaning?: string; example?: string; example_id?: string; jlpt_level?: string }
interface KanjiHarian { word: string; reading: string; readingDot: string; romaji: string; meaning: string; level: string; example?: string; example_id?: string; highlight?: string }

const KANA_ROMA: Record<string, string> = { \u3042:"a",\u3044:"i",\u3046:"u",\u3048:"e",\u304a:"o",\u304b:"ka",\u304d:"ki",\u304f:"ku",\u3051:"ke",\u3053:"ko",\u304c:"ga",\u304e:"gi",\u3050:"gu",\u3052:"ge",\u3054:"go",\u3055:"sa",\u3057:"shi",\u3059:"su",\u305b:"se",\u305d:"so",\u3056:"za",\u3058:"ji",\u305a:"zu",\u305c:"ze",\u305e:"zo",\u305f:"ta",\u3061:"chi",\u3064:"tsu",\u3066:"te",\u3068:"to",\u3060:"da",\u3062:"ji",\u3065:"zu",\u3067:"de",\u3069:"do",\u306a:"na",\u306b:"ni",\u306c:"nu",\u306d:"ne",\u306e:"no",\u306f:"ha",\u3072:"hi",\u3075:"fu",\u3078:"he",\u307b:"ho",\u3070:"ba",\u3073:"bi",\u3076:"bu",\u3079:"be",\u307c:"bo",\u3071:"pa",\u3074:"pi",\u3077:"pu",\u307a:"pe",\u307d:"po",\u307e:"ma",\u307f:"mi",\u3080:"mu",\u3081:"me",\u3082:"mo",\u3084:"ya",\u3086:"yu",\u3088:"yo",\u3089:"ra",\u308a:"ri",\u308b:"ru",\u308c:"re",\u308d:"ro",\u308f:"wa",\u3092:"o",\u3093:"n",\u30fc:"" };
const KANA_YOON: Record<string, string> = { \u304d\u3083:"kya",\u304d\u3085:"kyu",\u304d\u3087:"kyo",\u3057\u3083:"sha",\u3057\u3085:"shu",\u3057\u3087:"sho",\u3061\u3083:"cha",\u3061\u3085:"chu",\u3061\u3087:"cho",\u306b\u3083:"nya",\u306b\u3085:"nyu",\u306b\u3087:"nyo",\u3072\u3083:"hya",\u3072\u3085:"hyu",\u3072\u3087:"hyo",\u307f\u3083:"mya",\u307f\u3085:"myu",\u307f\u3087:"myo",\u308a\u3083:"rya",\u308a\u3085:"ryu",\u308a\u3087:"ryo",\u304e\u3083:"gya",\u304e\u3085:"gyu",\u304e\u3087:"gyo",\u3058\u3083:"ja",\u3058\u3085:"ju",\u3058\u3087:"jo",\u3073\u3083:"bya",\u3073\u3085:"byu",\u3073\u3087:"byo",\u3074\u3083:"pya",\u3074\u3085:"pyu",\u3074\u3087:"pyo" };
function toRomaji(kana: string): string {
  let out = "", i = 0;
  while (i < kana.length) {
    const two = kana.slice(i, i + 2);
    if (KANA_YOON[two]) { out += KANA_YOON[two]; i += 2; continue; }
    const ch = kana[i];
    if (ch === "\u3063") { const r = KANA_YOON[kana.slice(i + 1, i + 3)] || KANA_ROMA[kana[i + 1]] || ""; if (r) out += r[0]; i++; continue; }
    out += KANA_ROMA[ch] ?? ch;
    i++;
  }
  return out;
}
/* \u6311\u3080 + \u3044\u3069\u3080 \u2192 \u3044\u3069\u30fb\u3080 (pisah di batas okurigana). */
function okuriDot(word: string, reading: string): string {
  const tail = word.match(/[\u3041-\u3093]+$/);
  if (!tail || tail[0].length >= reading.length) return reading;
  const cut = reading.length - tail[0].length;
  return reading.slice(0, cut) + "\u30fb" + reading.slice(cut);
}
const kanjiCore = (word: string) => word.match(/^[\u4e00-\u9fbf\u3005]+/)?.[0] ?? word;

const KANJI_SRC: KanjiVocab[] = [kotobaN5, kotobaN4, kotobaN3, kotobaN2, kotobaN1]
  .flatMap(d => (d as { vocabulary?: KanjiVocab[] }).vocabulary ?? []);
const KANJI_POOL: KanjiHarian[] = KANJI_SRC
  .filter(w => w.word && /[\u4e00-\u9fbf]/.test(w.word) && w.example)
  .map(w => {
    const reading = w.reading ?? "";
    return {
      word: w.word!, reading, readingDot: okuriDot(w.word!, reading), romaji: toRomaji(reading),
      meaning: w.meaning ?? "", level: w.jlpt_level ?? "N2",
      example: w.example, example_id: w.example_id, highlight: kanjiCore(w.word!),
    };
  });

/* Render contoh kalimat + highlight kanji-nya (#E8704F). */
function renderKjExample(example: string, highlight?: string) {
  if (!highlight || !example.includes(highlight)) return <>{example}</>;
  const i = example.indexOf(highlight);
  return <>{example.slice(0, i)}<span className="hl">{highlight}</span>{example.slice(i + highlight.length)}</>;
}

/** Hari ke-berapa dalam setahun — bikin kartunya ganti tiap hari, bukan acak
 *  tiap render (biar sehari penuh konsisten). */
function hariKe(d: Date) {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

/* Sapaan spesial per orang 💕 (nama + pesan manis di Beranda). */
const SPECIAL: Record<string, { name: string; note: string }> = {
  "azizatulaini70@gmail.com": {
    name: "Ai-chan",
    note: "がんばってね、アイちゃん 💕 — belajar bareng terus ya, kamu pasti bisa. いつも応援してるよ、ゆうちゃんより 🥰",
  },
};

export default function Home() {
  const stats = useUserStats();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalSoal, setTotalSoal] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [kotoba, setKotoba] = useState<number | null>(null);
  const [resume, setResume] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Yusuf");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loveNote, setLoveNote] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ date: string; days: number | null }>({ date: "", days: null });
  const [kanji, setKanji] = useState<KanjiHarian | null>(null);

  const examLabel = stats.examDate
    ? new Date(stats.examDate).toLocaleDateString("id-ID", { month: "short", year: "numeric" })
    : "Des 2026";
  const [focus, setFocus] = useState<Focus[]>([]);
  const [week, setWeek] = useState<WeekDay[]>([]);
  const [activeDays, setActiveDays] = useState(0);

  useEffect(() => {
    async function load() {
      // tanggal + countdown (browser-only → lolos purity)
      const now = new Date();
      const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      // Tanggal ujian pilihan user; kalau dia skip pas onboarding, pakai
      // sesi JLPT terdekat (Desember) sebagai ancar-ancar.
      const exam = stats.examDate ? new Date(stats.examDate) : new Date(2026, 11, 6);
      const days = Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86_400_000));
      setMeta({ date: dateStr, days });
      if (KANJI_POOL.length) setKanji(KANJI_POOL[hariKe(now) % KANJI_POOL.length]);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const special = SPECIAL[(user.email || "").toLowerCase()];
      if (special) { setName(special.name); setLoveNote(special.note); }
      else {
        const first = (user.user_metadata?.full_name || user.email || "Yusuf").split(/[ @]/)[0];
        setName(first.charAt(0).toUpperCase() + first.slice(1));
      }
      // dari user_metadata dulu (Google OAuth), nanti ditimpa profiles.avatar_url kalau ada
      setAvatar(user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null);

      const [profileRes, sessionRes, kotobaRes] = await Promise.all([
        supabase.from("profiles").select("streak, avatar_url").eq("id", user.id).single(),
        supabase.from("sessions").select("id,level,category,title,total,score,created_at,ai_result->section,ai_result->stats,ai_result->kind")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
        supabase.from("saved_words").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (profileRes.data) {
        setStreak(profileRes.data.streak ?? 0);
        if (profileRes.data.avatar_url) setAvatar(profileRes.data.avatar_url);
      }
      if (kotobaRes.count != null) setKotoba(kotobaRes.count);

      const sess = (sessionRes.data ?? []) as unknown as Session[];
      const practiced = sess.filter(r => r.score != null && r.total);       // sesi yang udah dikerjain
      // Riwayat: sembunyiin import bank soal yang belum dikerjain (materi/riwayat split)
      const riwayat = sess.filter(r => !(r.kind === "materi" && r.score == null));

      setSessions(riwayat.slice(0, 4));
      setTotalSoal(sess.reduce((s, r) => s + (r.total ?? 0), 0)); // ukuran library soal (bank + analisis)
      setResume(riwayat.find(r => r.score == null) ?? riwayat[0] ?? sess[0] ?? null);
      if (practiced.length > 0) setAvgScore(Math.round(practiced.reduce((s, r) => s + (r.score! / r.total), 0) / practiced.length * 100));

      /* Fokus per-kategori (all-time, dari ai_result.stats.perCat) */
      const catAgg: Record<string, { a: number; c: number }> = {};
      for (const s of sess) {
        for (const [k, v] of Object.entries(s.stats?.perCat ?? {})) {
          const b = (catAgg[k] ??= { a: 0, c: 0 });
          b.a += v.a ?? 0; b.c += v.c ?? 0;
        }
      }
      setFocus(FOCUS_CATS.map(c => {
        const b = catAgg[c.jp];
        return { ...c, pct: b && b.a > 0 ? Math.round((b.c / b.a) * 100) : null, n: b?.a ?? 0 };
      }));

      /* Aktivitas 7 hari terakhir (soal dijawab per hari, dari stats.answered) */
      const perDay: Record<string, number> = {};
      for (const s of sess) {
        const ans = s.stats?.answered ?? 0;
        if (!ans) continue;
        const d = new Date(s.created_at);
        perDay[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] = (perDay[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] ?? 0) + ans;
      }
      const wk: WeekDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const v = perDay[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] ?? 0;
        wk.push({ d: DAY_LETTER[d.getDay()], v, h: 0, now: i === 0 });
      }
      const maxV = Math.max(1, ...wk.map(w => w.v));
      wk.forEach(w => (w.h = w.v > 0 ? Math.max(8, Math.round((w.v / maxV) * 100)) : 0));
      setWeek(wk);
      setActiveDays(wk.filter(w => w.v > 0).length);

      setLoading(false);
    }
    load();
  // stats.examDate dateng belakangan (profil dibaca async), jadi hitung mundurnya
  // wajib diitung ulang begitu kebaca — kalau dep-nya kosong, yang kepajang
  // selamanya tanggal ancar-ancar.
  }, [stats.examDate]);

  const resumeHref = resume ? (resume.section === "choukai" ? `/choukai/${resume.id}` : `/latihan/${resume.id}`) : "/materi";
  const dash = "—";
  const weakest = useMemo(() => {
    const present = focus.filter(f => f.pct != null && f.n > 0);
    if (!present.length) return null;
    return present.reduce((lo, f) => (f.pct! < lo.pct! ? f : lo));
  }, [focus]);

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
              <h1>おかえり, {name} <span className="jp">{loveNote ? "💕" : "頑張ろう!"}</span></h1>
              {loveNote
                ? <p className="bv-love">{loveNote}</p>
                : <p>{meta.date}{meta.days != null && ` · JLPT ${stats.targetLevel} · ${meta.days} hari lagi menuju ujian`}</p>}
            </div>
            <div className="bv-top-r">
              <span className="bv-pill streak"><span className="fl">🔥</span> <b>{streak}</b> hari</span>
              <div className="bv-xp"><div className="bv-xp-top"><span>Level {stats.level}</span><b>{stats.xp} / {stats.xpTarget} XP</b></div><div className="bv-xp-bar"><i style={{ width: `${Math.round(stats.xp / stats.xpTarget * 100)}%` }} /></div></div>
              <span className="bv-lv">{stats.targetLevel}</span>
              <div className="bv-ava">{avatar ? <img src={avatar} alt={name} className="bv-ava-img" referrerPolicy="no-referrer" /> : name[0]}</div>
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
                  <div className="kj-stage"><span className="kj">{(kanji?.highlight ?? kanji?.word ?? "—").charAt(0) || "—"}</span></div>
                  <div className="kj-meta">
                    {/* Badge level = level asli kanji-nya (data N1-N5). Kartunya
                        "kanji hari ini", jadi badge nunjukin level kanji itu. */}
                    <div className="tagrow">
                      <span className="tag tag-day">● Kanji Hari Ini</span>
                      {kanji?.level && <span className="tag tag-lvl">{kanji.level}</span>}
                    </div>
                    <div className="kj-read">{kanji?.readingDot ?? ""}{kanji?.romaji && <span className="rom">{kanji.romaji}</span>}</div>
                    <div className="kj-mean">{kanji?.meaning ?? "Memuat…"}</div>
                    {kanji?.example && (
                      <div className="kj-ex">
                        {renderKjExample(kanji.example, kanji.highlight)}
                        {kanji.example_id && <span className="tr">{kanji.example_id}</span>}
                      </div>
                    )}
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

              {/* fokus latihan 5 kategori — dari ai_result.stats (real) */}
              <div className="bv-fokus card">
                <div className="f-head"><h3>Fokus Latihan — akurasi per kategori</h3><Link href="/progres?tab=stat">Statistik lengkap →</Link></div>
                <div className="cats">
                  {(focus.length ? focus : FOCUS_CATS.map(c => ({ ...c, pct: null as number | null, n: 0 }))).map(c => (
                    <div key={c.ro} className={`cat c-${c.ro.toLowerCase()}`}>
                      <div className="cat-jp">{c.jp}</div><div className="cat-ro">{c.ro}</div>
                      <div className="cat-bar"><i style={{ width: `${c.pct ?? 0}%` }} /></div>
                      <div className="cat-pct">{c.pct != null ? `${c.pct}%` : "—"}</div><div className="cat-n">{c.n} soal</div>
                    </div>
                  ))}
                </div>
                {weakest ? (
                  <div className="f-note">💡 <span><b>{weakest.jp} paling perlu digenjot ({weakest.pct}%)</b> — dari {weakest.n} soal yang kamu jawab.</span><Link href="/materi" className="btn btn-p sm">Latihan lagi →</Link></div>
                ) : (
                  <div className="f-note">💡 <span>Belum ada data akurasi — <b>kerjain latihan/ujian</b> dulu biar kategori kamu keliatan.</span><Link href="/materi" className="btn btn-p sm">Mulai →</Link></div>
                )}
              </div>

              {/* materi shortcuts */}
              <div className="bv-materi2">
                <Link href="/kamus" className="m-card card"><span className="m-glyph">語</span><div className="m-ic goi">📖</div><div className="m-m"><div className="m-t">Kamus Kotoba</div><div className="m-s">{kotoba != null ? `${kotoba} kata di Kamus kamu` : "Kamus kotoba pribadi"}</div></div></Link>
                <Link href="/materi/bunpou" className="m-card card"><span className="m-glyph">文</span><div className="m-ic bun">📐</div><div className="m-m"><div className="m-t">Bunpou {stats.targetLevel}</div><div className="m-s">Pola grammar lengkap per level</div></div></Link>
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
                  <div className="cd-m"><div className="cd-t">JLPT {stats.targetLevel} · {examLabel}</div><div className="cd-s">{meta.days != null ? `${meta.days} hari lagi — jaga pace kamu, konsisten menang.` : ""}</div></div>
                </div>
              </div>

              <div className="bv-scard card">
                <div className="s-h">Aktivitas 7 hari <span className="r">soal dijawab</span></div>
                <div className="wk">
                  {(week.length ? week : Array.from({ length: 7 }, (_, i) => ({ d: DAY_LETTER[i], h: 0, v: 0, now: i === 6 }))).map((c, i) => (
                    <div className="wkc" key={i}><div className={`wkb${c.v === 0 ? " mut" : ""}${c.now ? " now" : ""}`} style={{ height: `${Math.max(c.h, 5)}%` }} title={`${c.v} soal`} /><span className={`wkl${c.now ? " now" : ""}`}>{c.d}</span></div>
                  ))}
                </div>
                <div className="wk-note">{activeDays > 0 ? <><b>{activeDays} dari 7 hari</b> aktif — streak {streak} hari 🔥 jaga hari ini!</> : <>Belum ada aktivitas minggu ini — <b>mulai hari ini</b> 💪</>}</div>
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

