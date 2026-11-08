"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { HonixEmpty } from "@/components/honix/HonixEmpty";
import { GantiTarget } from "@/components/v2/GantiTarget";
import { useUserStats } from "@/lib/use-user-stats";
import { gabungBankSoal, type SetUjian, type SesiMilik, type SetKatalog } from "@/lib/bank-soal";

/* Deck Kotoba level target: buat angka di kartu Kotoba. Sumbernya sama dengan
   /materi/kotoba, jadi jumlah katanya selalu cocok. */
interface DekKotoba { source: string; vocabulary: { word: string }[]; }
const DEK_KOTOBA: Record<Lv, () => Promise<DekKotoba>> = {
  N5: () => import("@/data/kotoba/N5.json").then(m => m.default as DekKotoba),
  N4: () => import("@/data/kotoba/N4.json").then(m => m.default as DekKotoba),
  N3: () => import("@/data/kotoba/N3.json").then(m => m.default as DekKotoba),
  N2: () => import("@/data/kotoba/N2.json").then(m => m.default as DekKotoba),
  N1: () => import("@/data/kotoba/N1.json").then(m => m.default as DekKotoba),
};

type Lv = "N1" | "N2" | "N3" | "N4" | "N5";

type Exam = SetUjian;
type ExType = "筆記" | "聴解";
function exType(e: Exam): ExType { return e.section === "choukai" ? "聴解" : "筆記"; }

function examMeta(title: string): { label: string; sortKey: number } {
  const m = title.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月/);
  if (m) return { label: `${m[1]}年${m[2]}月`, sortKey: +m[1] * 100 + +m[2] };
  return { label: title.slice(0, 20), sortKey: 0 };
}
function relDate(iso: string | null): string {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d < 1) return "hari ini"; if (d < 2) return "kemarin";
  if (d < 7) return `${d} hari lalu`; if (d < 30) return `${Math.floor(d / 7)} minggu lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
const pctOf = (e: Exam) => (e.score != null && e.total > 0 ? Math.round((e.score / e.total) * 100) : null);

/* 1 ujian = 1 grup (tanggal) berisi bagian 筆記 + 聴解 */
interface Group { key: string; level: Lv; label: string; sortKey: number; hisho?: Exam; choukai?: Exam; }
type StatusF = "all" | "incomplete" | "done";
const DEFAULT_SHOWN = 5;

export default function MateriHub() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [muat, setMuat] = useState<"loading" | "ready" | "error">("loading");
  /* Progres materi belajar — dihitung dari data, bukan dipatok. Yang diukur
     "ditandai/disimpan", bukan "dikuasai": itu yang beneran kelacak. */
  const [bunpou, setBunpou] = useState({ total: 0, ditandai: 0 });
  const [kataFavorit, setKataFavorit] = useState<Set<string>>(new Set());
  const [dekKotoba, setDekKotoba] = useState<DekKotoba | null>(null);
  const [statusF, setStatusF] = useState<StatusF>("all");
  const [showAll, setShowAll] = useState(false);
  /* judul set yang lagi disiapin salinannya (klik pertama) + pesan kalau gagal */
  const [membuka, setMembuka] = useState<string | null>(null);
  const [gagalBuka, setGagalBuka] = useState<string | null>(null);
  const router = useRouter();

  const stats = useUserStats();

  /* Tanggal ujian dari pilihan user; "Desember 2026" cuma ancar-ancar buat yang
     belum nentuin (sesi JLPT terdekat). */
  const targetDate = stats.examDate
    ? new Date(stats.examDate).toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    : "Desember 2026";

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMuat("error"); return; }
      const [ex, kat, bp, sw] = await Promise.all([
        supabase.from("sessions")
          .select("id, level, title, total, score, created_at, ai_result->section, ai_result->ready")
          .eq("user_id", user.id)
          .eq("ai_result->>kind", "materi")
          .order("created_at", { ascending: false }),
        supabase.rpc("daftar_katalog"),
        supabase.from("bunpou_patterns").select("favorite").eq("user_id", user.id),
        supabase.from("saved_words").select("kanji").eq("user_id", user.id).eq("favorite", true),
      ]);
      if (ex.error) { setMuat("error"); return; }
      /* Katalog gagal kebaca (mis. migration belum jalan) → tetap tampilin
         salinan yang udah dimiliki, jangan bikin halaman error. */
      setExams(gabungBankSoal((ex.data ?? []) as SesiMilik[], kat.error ? [] : (kat.data ?? []) as SetKatalog[]));
      setMuat("ready");

      const pola = bp.data ?? [];
      setBunpou({ total: pola.length, ditandai: pola.filter(r => r.favorite).length });

      setKataFavorit(new Set((sw.data ?? []).map(r => r.kanji)));
    }
    load().catch(() => setMuat("error"));
  }, []);

  /* Datang dari menu "Bank Soal": daftar ujian baru kebentuk setelah data
     masuk, jadi geser ulang ke sana begitu siap (scroll bawaan Next kecepetan). */
  useEffect(() => {
    if (muat !== "ready" || !stats.loaded || window.location.hash !== "#bank-soal") return;
    requestAnimationFrame(() => document.getElementById("bank-soal")?.scrollIntoView({ block: "start" }));
  }, [muat, stats.loaded]);

  const perLevel = useMemo(() => {
    const m: Record<string, Exam[]> = {};
    exams.forEach(e => (m[e.level] ??= []).push(e));
    return m;
  }, [exams]);

  /* Bank Soal cuma nampilin level target. Level lain dibuka lewat ganti target. */
  const lv: Lv = stats.targetLevel;
  const setLevelIni = useMemo(() => (stats.loaded ? perLevel[lv] ?? [] : []), [stats.loaded, perLevel, lv]);

  useEffect(() => {
    if (!stats.loaded) return;
    let batal = false;
    void DEK_KOTOBA[lv]().then(d => { if (!batal) setDekKotoba(d); });
    return () => { batal = true; };
  }, [stats.loaded, lv]);

  const kotobaTotal = dekKotoba?.vocabulary.length ?? 0;
  const kotobaTersimpan = useMemo(
    () => (dekKotoba?.vocabulary ?? []).filter(w => kataFavorit.has(w.word)).length,
    [dekKotoba, kataFavorit],
  );

  /* group per tanggal → {hisho, choukai} */
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const e of setLevelIni) {
      const { label, sortKey } = examMeta(e.title);
      const key = `${e.level}·${label}`;
      let g = map.get(key);
      if (!g) { g = { key, level: e.level as Lv, label, sortKey }; map.set(key, g); }
      if (exType(e) === "聴解") g.choukai = e; else g.hisho = e;
    }
    return [...map.values()].sort((a, b) => b.sortKey - a.sortKey);
  }, [setLevelIni]);

  const gStatus = (g: Group): StatusF => {
    const parts = [g.hisho, g.choukai].filter(Boolean) as Exam[];
    const doneN = parts.filter(e => pctOf(e) != null).length;
    if (doneN === 0) return "incomplete"; // belum mulai = belum lengkap
    if (doneN === parts.length) return "done";
    return "incomplete";
  };
  const filtered = useMemo(() => statusF === "all" ? groups : groups.filter(g => gStatus(g) === statusF), [groups, statusF]);
  const shown = showAll ? filtered : filtered.slice(0, DEFAULT_SHOWN);
  const moreN = filtered.length - shown.length;

  const jumlahUjian = new Set(setLevelIni.map(e => examMeta(e.title).label)).size;

  /* pace: berapa set (grup) kelar minggu ini */
  const pace = useMemo(() => {
    const wk = Date.now() - 7 * 86_400_000;
    const doneThisWk = setLevelIni.filter(e => pctOf(e) != null && e.created_at != null && +new Date(e.created_at) >= wk).length;
    return { doneThisWk, target: 2 };
  }, [setLevelIni]);

  /* NEXT: grup terbaru yang belum lengkap di level yang dimiliki */
  const next = useMemo(() => groups.find(g => gStatus(g) !== "done"), [groups]);

  const openPart = async (e?: Exam) => {
    if (!e || e.ready === false || membuka) return;
    const ke = (id: string) => router.push(exType(e) === "聴解" ? `/choukai/${id}` : `/latihan/${id}`);
    if (e.id) { ke(e.id); return; }
    if (!e.katalogId) return;
    /* Pertama kali dibuka: database nyalin set dari katalog ke akun ini. */
    setMembuka(e.title); setGagalBuka(null);
    const { data, error } = await createClient().rpc("ambil_set", { p_katalog: e.katalogId });
    if (error || typeof data !== "string") {
      setMembuka(null);
      if (error?.message?.includes("subscription_required")) { router.push("/langganan"); return; }
      setGagalBuka(`Set ${examMeta(e.title).label} ${exType(e)} belum bisa dibuka. Coba lagi sebentar.`);
      return;
    }
    ke(data);
  };

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={stats.streak} xp={stats.xp} xpTarget={stats.xpTarget} avatarLetter={stats.initial} isPro={stats.isPro} />

        <div className="materi-v3">
          <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Materi" }]} />

          <div className="m3-hd">
            <div>
              <h1>Materi <span className="jp">教材</span></h1>
              <p>Bank soal ujian lengkap + materi belajar terstruktur. Kotoba personal kamu ada di <Link href="/kamus">Kamus →</Link></p>
            </div>
            <div className="m3-pace">
              <div className="m3-pace-top"><span className="t">Pace menuju {stats.targetLevel} · {targetDate}</span><span className="badge">{pace.doneThisWk >= pace.target ? "ON TRACK" : "AYO"}</span></div>
              <div className="main">Kerjain <b>{pace.target} set / minggu</b> biar konsisten sampai ujian ✓</div>
              <div className="sub">Minggu ini: <b>{pace.doneThisWk} / {pace.target} set</b>{pace.doneThisWk < pace.target && " — lanjut yuk"}</div>
            </div>
          </div>

          {/* Tujuan menu "Bank Soal" di sidebar (/materi#bank-soal). */}
          <div id="bank-soal" className="m3-jangkar" />

          {/* NEXT hero */}
          {next && (
            <div className="m3-next">
              <div>
                <div className="eyebrow"><span className="d" />Berikutnya buat kamu</div>
                <div className="t"><span className="jpt">{next.label}</span> — ujian {next.level}</div>
                <div className="meta">
                  {next.hisho && <span>✍️ <b>筆記 {next.hisho.total} soal</b></span>}
                  {next.choukai && <span>🎧 <b>聴解 {next.choukai.total} soal</b></span>}
                </div>
              </div>
              <div className="acts">
                {next.hisho && next.hisho.ready !== false && <button className="btn btn-p" onClick={() => openPart(next.hisho)}>▶ Mulai 筆記</button>}
                {next.choukai && next.choukai.ready !== false && <button className="btn btn-g" onClick={() => openPart(next.choukai)}>🎧 Atau 聴解 dulu</button>}
              </div>
            </div>
          )}

          {/* filter */}
          <div className="m3-bar">
            <span className="fchip on">{lv} <span className="c">{jumlahUjian} ujian</span></span>
            <GantiTarget />
            <span className="m3-div" />
            {([["all", "Semua"], ["incomplete", "Belum lengkap"], ["done", "✓ Selesai"]] as const).map(([v, l]) => (
              <button key={v} className={`fchip${statusF === v ? " on" : ""}`} onClick={() => { setStatusF(v); setShowAll(false); }}>{l}</button>
            ))}
            <span className="bar-r">1 ujian = 筆記 + 聴解 · klik bagian buat mulai</span>
          </div>
          {gagalBuka && <p className="m3-empty" role="alert">{gagalBuka}</p>}

          {/* exam grid */}
          <div className="m3-exams">
            {shown.map(g => {
              const parts = [g.hisho, g.choukai].filter(Boolean) as Exam[];
              const doneN = parts.filter(e => pctOf(e) != null).length;
              const total = parts.reduce((n, e) => n + e.total, 0);
              const badge = doneN === parts.length && parts.length > 1 ? { t: "✓ LENGKAP", c: "done" }
                : g.hisho && pctOf(g.hisho) != null ? { t: `✓ 筆記 ${pctOf(g.hisho)}%`, c: "done" }
                : g.choukai && pctOf(g.choukai) != null ? { t: `✓ 聴解 ${pctOf(g.choukai)}%`, c: "done" }
                : null;
              return (
                <div key={g.key} className="exam card">
                  <span className="exam-glyph">験</span>
                  <div className="exam-top">
                    <span className="exam-t">{g.label}</span>
                    {badge && <span className={`exam-badge eb-${badge.c}`}>{badge.t}</span>}
                  </div>
                  <div className="exam-s">Ujian {g.level} · <b>{total} soal</b></div>
                  <div className="parts">
                    <Part e={g.hisho} type="筆記" onOpen={openPart} membuka={membuka} />
                    <Part e={g.choukai} type="聴解" onOpen={openPart} membuka={membuka} />
                  </div>
                </div>
              );
            })}
            {moreN > 0 && (
              <button className="more" onClick={() => setShowAll(true)}>
                <div style={{ textAlign: "center" }}>
                  <div className="n">+{moreN} ujian lagi</div>
                  <div className="l">makin lama makin klasik</div>
                  <div className="a">Tampilkan semua {lv} →</div>
                </div>
              </button>
            )}
            {muat === "loading" || !stats.loaded ? <p className="m3-empty" role="status">Memuat materi…</p>
              : muat === "error" ? <div className="m3-empty" role="alert">Materi belum bisa dimuat. <button type="button" className="btn btn-g" onClick={() => window.location.reload()}>Coba lagi</button></div>
              : setLevelIni.length === 0 ? (
                <div className="hx-empty-wide">
                  <HonixEmpty momen="kosongMateri"
                    body={`Set ujian ${lv} belum tersedia. Sambil menunggu, kamu bisa belajar Bunpou dan Kotoba.`}
                    cta={<Link href="/materi/bunpou" className="hx-btn hx-btn-p">Belajar Bunpou</Link>} />
                </div>
              ) : shown.length === 0 && <p className="m3-empty">Belum ada ujian di filter ini.</p>}
          </div>

          {/* Materi Belajar */}
          <div className="m3-sec"><h2>Materi Belajar</h2><span className="b">2</span><span className="r">Referensi + drill — nyambung ke status latihanmu</span></div>
          <div className="m3-duo">
            <Link href="/materi/bunpou" className="mat card gold">
              <div className="mat-g gold"><span className="gl">文</span></div>
              <div className="mat-b">
                <span className="mat-eyebrow gold">Tata Bahasa</span>
                <span className="mat-t">Bunpou</span>
                <span className="mat-d">Pola grammar JLPT lengkap per level: penjelasan, penyambungan, contoh kalimat, drill per pola.</span>
                <div className="mat-foot">
                  <div className="mat-track"><i className="gold" style={{ width: `${bunpou.total > 0 ? Math.round((bunpou.ditandai / bunpou.total) * 100) : 0}%` }} /></div>
                  <span className="mat-pct">
                    {bunpou.total === 0 ? "belum ada pola" : `${bunpou.ditandai} dari ${bunpou.total} pola ditandai`}
                  </span>
                  <span className="mat-go">Buka Bunpou →</span>
                </div>
              </div>
            </Link>
            <Link href="/materi/kotoba" className="mat card" style={{ textDecoration: "none" }}>
              <div className="mat-g"><span className="gl">語</span></div>
              <div className="mat-b">
                <span className="mat-eyebrow">Kosakata Terstruktur</span>
                <span className="mat-t">Kotoba</span>
                <span className="mat-d">{kotobaTotal > 0 ? `${kotobaTotal} kata ${lv}` : `Kosakata ${lv}`}{dekKotoba && <> · <b>{dekKotoba.source}</b></>} — flash mode per tema, simpan ⭐ ke Kamus.</span>
                <div className="mat-foot">
                  <div className="mat-track"><i style={{ width: `${kotobaTotal > 0 ? Math.round((kotobaTersimpan / kotobaTotal) * 100) : 0}%` }} /></div>
                  <span className="mat-pct">{kotobaTersimpan} dari {kotobaTotal} kata disimpan</span>
                  <span className="mat-go">Buka Kotoba →</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Mendatang */}
          <div className="m3-sec"><h2>Materi Mendatang</h2><span className="b muted">3</span></div>
          <div className="m3-soon card">
            {[["字", "Kanji", "Karakter per level, urutan stroke"], ["聴", "Choukai", "Listening dengan audio terstruktur"], ["読", "Dokkai", "Teks bacaan panjang + pembahasan"]].map(([g, t, d]) => (
              <div className="soon-i" key={t}>
                <span className="soon-ic">{g}<span className="lk">🔒</span></span>
                <div><div className="soon-t">{t}</div><div className="soon-s">{d}</div></div>
              </div>
            ))}
            <div className="soon-vote"><span className="t">Mana yang paling kamu butuhin?</span><button className="vbtn" onClick={() => alert("Makasih! Fitur vote materi lagi disiapin 🙌")}>Vote materi berikutnya →</button></div>
          </div>
        </div>
      </main>
    </>
  );
}

/* satu bagian ujian (筆記 / 聴解) di dalam kartu */
function Part({ e, type, onOpen, membuka }: { e?: Exam; type: ExType; onOpen: (e?: Exam) => void; membuka: string | null }) {
  const isCho = type === "聴解";
  if (!e) {
    return (
      <div className="part disabled">
        <span className={`part-ic ${isCho ? "pi-l" : "pi-w"}`}>{isCho ? "🎧" : "✍️"}</span>
        <div className="part-m"><div className="part-t">{type}</div><div className="part-s">Belum tersedia</div></div>
        <span className="part-soon">segera</span>
      </div>
    );
  }
  if (e.ready === false) {
    return (
      <div className="part soon">
        <span className={`part-ic ${isCho ? "pi-l" : "pi-w"}`}>{isCho ? "🎧" : "✍️"}</span>
        <div className="part-m"><div className="part-t">{type} · {e.total} soal</div><div className="part-s">Lagi disiapin — segera hadir</div></div>
        <span className="part-soon">🔒 SOON</span>
      </div>
    );
  }
  const pct = pctOf(e);
  const bad = pct != null && pct < 65;
  const click = () => onOpen(e);
  return (
    <div className="part" onClick={click} role="button" tabIndex={0}
      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); click(); } }}>
      <span className={`part-ic ${isCho ? "pi-l" : "pi-w"}`}>{isCho ? "🎧" : "✍️"}</span>
      <div className="part-m">
        <div className="part-t">{type} · {e.total} soal</div>
        <div className="part-s">{membuka === e.title ? "Menyiapkan soal…" : pct != null ? `Terakhir ${pct}% · ${relDate(e.created_at)}` : isCho ? "~50 menit · audio" : "belum dikerjain"}</div>
      </div>
      {pct != null
        ? <><span className="part-score" style={bad ? { background: "rgba(212,160,74,0.15)", color: "var(--warning)" } : undefined}>{pct}%</span><span className="part-go">{bad ? "↻ Ulangi" : "Review"}</span></>
        : <span className="part-go">Mulai →</span>}
    </div>
  );
}
