"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-strategi.css";
import "@/styles/rencana-misi.css";
import "@/styles/rencana-pamer.css";
import "@/styles/materi-bank.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { BarisLevel } from "@/components/rencana/BarisLevel";
import { LabelDisiapkan } from "@/components/rencana/LabelDisiapkan";
import { useUserStats } from "@/lib/use-user-stats";
import { honixSrc } from "@/lib/honix-pose";
import { fiturLive } from "@/lib/kurikulum-config";
import { kapan } from "@/lib/terakhir-dibuka";
import { gabungBankSoal, type SetUjian, type SesiMilik, type SetKatalog } from "@/lib/bank-soal";
import { DEV_BYPASS, devBankSoal } from "@/lib/dev-materi";
import {
  susunPerjalanan, berikutnya, ringkasan, cocokSaring, menyala, AMBANG_ULANG,
  type Pos, type Bagian, type Saring,
} from "@/lib/perjalanan-soal";

const DITAMPILKAN = 9;
const SARING: [Saring, string][] = [["semua", "Semua"], ["belum", "Belum lengkap"], ["selesai", "Selesai"]];
const BADGE: Partial<Record<Pos["status"], [string, string]>> = {
  sebagian: ["bd-run", "Sedang jalan"], bagus: ["bd-ok", "✓ Selesai"],
  kurang: ["bd-low", "Perlu diulang"], segera: ["bd-seg", "Segera"],
};
const LABEL = (b: Bagian) => (b.set.section === "choukai" ? "聴解" : "筆記");

/** Bank Soal: set latihan format JLPT sebagai perjalanan 桜 → 鳳
    (HANDOFF-materi-bank-soal §3). Pindahan dari daftar ujian di /materi. */
export default function BankSoalPage() {
  const stats = useUserStats();
  const router = useRouter();
  const [semua, setSemua] = useState<SetUjian[]>([]);
  const [muat, setMuat] = useState<"loading" | "ready" | "error">("loading");
  const [saring, setSaring] = useState<Saring>("semua");
  const [lengkap, setLengkap] = useState(false);
  /* set yang lagi disiapin salinannya (klik pertama) + pesan kalau gagal */
  const [membuka, setMembuka] = useState<string | null>(null);
  const [gagal, setGagal] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (DEV_BYPASS) {
        const mode = new URLSearchParams(window.location.search).get("dev");
        const d = ["N1", "N2", "N3", "N4", "N5"].map(l => devBankSoal(l, mode));
        setSemua(gabungBankSoal(d.flatMap(x => x.milik), d.flatMap(x => x.katalog)));
        setMuat("ready");
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMuat("error"); return; }
      const [milik, katalog] = await Promise.all([
        supabase.from("sessions")
          .select("id, level, title, total, score, created_at, ai_result->section, ai_result->ready, ai_result->stats")
          .eq("user_id", user.id)
          .eq("ai_result->>kind", "materi")
          .order("created_at", { ascending: false }),
        supabase.rpc("daftar_katalog"),
      ]);
      if (milik.error) { setMuat("error"); return; }
      /* Katalog gagal kebaca → tetap tampilin salinan yang udah dimiliki. */
      setSemua(gabungBankSoal((milik.data ?? []) as SesiMilik[], katalog.error ? [] : (katalog.data ?? []) as SetKatalog[]));
      setMuat("ready");
    }
    load().catch(() => setMuat("error"));
  }, []);

  /* Cuma level target. Level lain dibuka lewat ganti target. */
  const lv = stats.targetLevel;
  const pos = useMemo(() => (stats.loaded ? susunPerjalanan(semua.filter(s => s.level === lv)) : []), [semua, stats.loaded, lv]);
  const nx = useMemo(() => berikutnya(pos), [pos]);
  const rk = useMemo(() => ringkasan(pos), [pos]);
  const cocok = pos.filter(p => cocokSaring(p, saring));
  const tampil = lengkap ? cocok : cocok.slice(0, DITAMPILKAN);
  const jumlah = (f: Saring) => pos.filter(p => cocokSaring(p, f)).length;

  const buka = async (b?: Bagian) => {
    if (!b || b.status === "segera" || membuka) return;
    const e = b.set;
    const ke = (id: string) => router.push(e.section === "choukai" ? `/choukai/${id}` : `/latihan/${id}`);
    if (e.id) { ke(e.id); return; }
    if (!e.katalogId) return;
    /* Pertama kali dibuka: database nyalin set dari katalog ke akun ini. */
    setMembuka(e.katalogId); setGagal(null);
    const { data, error } = await createClient().rpc("ambil_set", { p_katalog: e.katalogId });
    if (error || typeof data !== "string") {
      setMembuka(null);
      if (error?.message?.includes("subscription_required")) { router.push("/langganan"); return; }
      setGagal(`Set ${LABEL(b)} ini belum bisa dibuka. Coba lagi sebentar.`);
      return;
    }
    ke(data);
  };

  const siap = muat === "ready" && stats.loaded;
  const akhir = pos[pos.length - 1];

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={stats.streak} xp={stats.xp} xpTarget={stats.xpTarget} avatarLetter={stats.initial} isPro={stats.isPro} />
        <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Bank Soal" }]} />

        <div className="rbk mbk">
          <div className="head">
            <div>
              <h1 className="h1">Bank Soal<span className="jp-g" lang="ja">問題集</span></h1>
              <BarisLevel level={lv} examDate={stats.examDate} />
              <p className="sub" style={{ marginTop: 8 }}>
                {pos.length > 0
                  ? <>Set latihan format JLPT, disusun jadi perjalanan dari <span lang="ja">{pos[0].kj}</span> sampai <span lang="ja">{akhir.kj}</span>. Tiap set yang kamu selesaikan nyalain satu pos.</>
                  : <>Set latihan format JLPT: <span lang="ja">筆記</span> + <span lang="ja">聴解</span> beraudio, susunan & jumlah soal sama kayak ujian.</>}
              </p>
            </div>
            {siap && pos.length > 0 && (
              <div className="bs-sum">
                <div><b>{rk.siap}</b><span>set</span></div>
                <div><b>{rk.selesai}</b><span>selesai</span></div>
                <div><b>{rk.belumLengkap}</b><span>belum lengkap</span></div>
                <div><b>{rk.rataHikki != null ? `${rk.rataHikki}%` : "–"}</b><span>rata-rata <span lang="ja">筆記</span></span></div>
              </div>
            )}
          </div>

          {!siap ? (
            muat === "error"
              ? <div className="mb-gagal" role="alert">Bank Soal belum bisa dimuat. <button type="button" className="btn btn-g" onClick={() => window.location.reload()}>Coba lagi</button></div>
              : <p className="mb-muat" role="status">Memuat Bank Soal…</p>
          ) : pos.length === 0 ? (
            <>
              <section className="card emp">
                <img className="hx" src={honixSrc("tunggu")} alt="Honix menunggu" />
                <div>
                  <div className="eyebrow">Bank Soal {lv}</div>
                  <h2>Set latihan {lv} belum ada</h2>
                  <p>Set latihan format JLPT untuk {lv} lagi kami susun. Daripada nunggu, latihan {lv} tetap bisa jalan lewat Kotoba, Bunpou, dan Latihan Kilat di Materi.</p>
                  <div className="nx-a">
                    <Link className="btn btn-p" href="/materi">Ke Materi</Link>
                    <Link className="btn btn-q" href="/strategi">Lihat strategi ujian {lv}</Link>
                  </div>
                </div>
              </section>
              <Banner lv={lv} />
            </>
          ) : (
            <>
              <Perjalanan pos={pos} posBerikut={nx?.pos.no ?? 0} />
              {nx && <Berikutnya nx={nx} jumlahPos={pos.length} onBuka={buka} membuka={membuka} />}
              <Banner lv={lv} />
              {gagal && <p className="mb-gagal" role="alert">{gagal}</p>}

              <div className="flt">
                <div className="seg" role="tablist" aria-label="Saring set">
                  {SARING.map(([v, l]) => (
                    <button key={v} type="button" role="tab" aria-selected={saring === v} className={saring === v ? "on" : ""}
                      onClick={() => { setSaring(v); setLengkap(false); }}>{l} · {jumlah(v)}</button>
                  ))}
                </div>
                <span className="note">Urut perjalanan</span>
              </div>

              <div className="exs">
                {tampil.map((p, i) => <KartuPos key={p.no} p={p} i={i} lv={lv} n={pos.length} onBuka={buka} membuka={membuka} />)}
              </div>
              {tampil.length === 0 && <p className="mb-muat">Belum ada set di saringan ini.</p>}
              {cocok.length > DITAMPILKAN && !lengkap && (
                <div className="more2"><button type="button" className="btn btn-g" onClick={() => setLengkap(true)}>Tampilkan semua {cocok.length} set</button></div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function Banner({ lv }: { lv: string }) {
  const simulasi = fiturLive("simulasi");
  return (
    <div className="bnr">
      <Link className="card dr2" href="/strategi">
        <span className="sb-g" lang="ja">戦</span>
        <span><b>Strategi ujian {lv}</b><small>Baca dulu sebelum ngerjain satu set penuh</small></span>
        <span className="btn btn-g">Buka</span>
      </Link>
      {simulasi ? (
        <Link className="card dr2" href="/progres?tab=simulasi">
          <span className="sb-g" lang="ja">模</span>
          <span><b>Simulasi bulanan</b><small>Ujian penuh sesuai waktu resmi, sebulan sekali</small></span>
          <span className="btn btn-g">Buka</span>
        </Link>
      ) : (
        <div className="card dr2 off" aria-disabled="true">
          <span className="sb-g" lang="ja">模</span>
          <span><b>Simulasi bulanan<LabelDisiapkan kecil /></b><small>Ujian penuh sesuai waktu resmi, sebulan sekali</small></span>
          <span />
        </div>
      )}
    </div>
  );
}

function Perjalanan({ pos, posBerikut }: { pos: Pos[]; posBerikut: number }) {
  const nyala = pos.filter(menyala).length;
  const akhir = pos[pos.length - 1];
  return (
    <section className="card jrc" aria-label="Perjalanan Bank Soal">
      <div className="jr-h">
        <div>
          <div className="eyebrow">Perjalanan <span lang="ja">{pos[0].kj} → {akhir.kj}</span></div>
          <b className="jr-t">{nyala} pos menyala · {pos.length - nyala} lagi ke <span lang="ja">{akhir.kj}</span></b>
        </div>
        <div className="jr-leg" aria-hidden="true">
          <span><i className="jr-d t-bagus" />Menyala</span>
          <span><i className="jr-d t-kurang" />Perlu diulang</span>
          <span><i className="jr-d t-sebagian" />Lagi jalan</span>
          <span><i className="jr-d t-belum" />Belum</span>
        </div>
      </div>
      <div className="jr-w">
        <ol className="jr" style={{ "--n": pos.length } as React.CSSProperties}>
          {pos.map(p => (
            <li key={p.no} className={`jr-p${p.no === pos.length ? " end" : ""}`}>
              <span className={`jr-d t-${p.status}`} lang="ja" title={`Pos ${p.no} · ${p.ro}`} aria-label={`Pos ${p.no} ${p.ro}: ${STATUS_TEKS[p.status]}`}>{p.kj}</span>
              {p.no === posBerikut && <img className="jr-hx" src={honixSrc("kepala")} alt="Honix di sini" />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const STATUS_TEKS: Record<Pos["status"], string> = {
  belum: "belum", sebagian: "lagi jalan", kurang: "perlu diulang", bagus: "menyala", segera: "segera",
};

function Berikutnya({ nx, jumlahPos, onBuka, membuka }: {
  nx: NonNullable<ReturnType<typeof berikutnya>>; jumlahPos: number;
  onBuka: (b?: Bagian) => void; membuka: string | null;
}) {
  const { pos: p, bagian: b, alasan } = nx;
  const lanjut = alasan === "lanjut";
  const sibuk = membuka != null && membuka === b.set.katalogId;
  return (
    <section className="card nx">
      <div>
        <div className="eyebrow">Berikutnya buat kamu</div>
        <div className="nx-t">
          <span className={`ex-tok big t-${p.status}`} lang="ja" aria-hidden="true">{p.kj}</span>
          <span>
            <span><span lang="ja">{p.kj}</span> {p.ro} · <span lang="ja">{LABEL(b)}</span></span>
            <small className="ex-no">Pos {String(p.no).padStart(2, "0")} dari {jumlahPos}</small>
          </span>
        </div>
        <p className="nx-p">
          {lanjut
            ? <>Berhenti di soal {b.dijawab} dari {b.set.total}{b.set.terakhir ? ` · ${kapan(b.set.terakhir)}` : ""}. Lanjutin dulu yang setengah jalan.</>
            : <>Pos berikutnya di perjalananmu. Mulai dari <span lang="ja">筆記</span>, <span lang="ja">聴解</span> bisa di hari lain.</>}
        </p>
        {lanjut && <div className="mbar"><i style={{ width: `${(b.dijawab / Math.max(1, b.set.total)) * 100}%` }} /></div>}
        <div className="nx-a">
          <button type="button" className="btn btn-p btn-lg" disabled={sibuk} onClick={() => onBuka(b)}>
            {sibuk ? "Menyiapkan soal…" : lanjut ? `Lanjut dari soal ${b.dijawab + 1}` : <>Mulai <span lang="ja">{LABEL(b)}</span> · {b.set.total} soal</>}
          </button>
        </div>
      </div>
      <div className="nx-side">
        <div><span>Waktu</span><b>dicatat, gak dibatasi</b></div>
        {p.hikki && <div><span lang="ja">筆記</span><b>{p.hikki.set.total} soal · ~105 mnt</b></div>}
        {p.choukai && <div><span lang="ja">聴解</span><b>{p.choukai.set.total} soal · audio</b></div>}
      </div>
    </section>
  );
}

function KartuPos({ p, i, lv, n, onBuka, membuka }: {
  p: Pos; i: number; lv: string; n: number; onBuka: (b?: Bagian) => void; membuka: string | null;
}) {
  const jeda = { animationDelay: `${Math.min(i, 8) * 40}ms` };
  if (p.status === "segera") {
    return (
      <article className="card ex seg" style={jeda} aria-label={`Pos ${p.no} ${p.ro}, segera`}>
        <span className="ex-gl" lang="ja" aria-hidden="true">準</span>
        <div className="ex-top">
          <span className="ex-t"><span lang="ja">{p.kj}</span> {p.ro}</span>
          <span className="ex-bd bd-seg">Segera</span>
        </div>
        <div className="ex-s">Pos {String(p.no).padStart(2, "0")} / {n} · set ini lagi kami lengkapi</div>
        <div className="sg-parts">
          <div><span className="pt-ic pi-w" lang="ja">筆</span><span lang="ja">筆記</span><i className="sg-dots" aria-hidden="true"><b /><b /><b /></i></div>
          <div><span className="pt-ic pi-l" lang="ja">聴</span><span lang="ja">聴解</span><i className="sg-dots" aria-hidden="true"><b /><b /><b /></i></div>
        </div>
        <p className="sg-n">Muncul di sini begitu lengkap. Gak perlu ngapa-ngapain.</p>
      </article>
    );
  }
  const bagian = [p.hikki, p.choukai].filter(Boolean) as Bagian[];
  const total = bagian.reduce((t, b) => t + b.set.total, 0);
  const skor = bagian.map(b => b.skor).filter((x): x is number => x != null);
  const rendah = bagian.find(b => b.skor != null && b.skor < AMBANG_ULANG);
  const bd = BADGE[p.status];
  return (
    <article className="card ex" style={jeda}>
      <div className="ex-top">
        <span className={`ex-tok t-${p.status}`} lang="ja" aria-hidden="true">{p.kj}</span>
        <span className="ex-nm">
          <span className="ex-t"><span lang="ja">{p.kj}</span> {p.ro}</span>
          <span className="ex-no">Pos {String(p.no).padStart(2, "0")} / {n}</span>
        </span>
        {bd && <span className={`ex-bd ${bd[0]}`}>{bd[1]}</span>}
      </div>
      <div className="ex-s">
        {p.status === "bagus" && skor.length ? <>Rata-rata <b>{Math.round(skor.reduce((a, c) => a + c, 0) / skor.length)}%</b></>
          : p.status === "kurang" ? `Skor di bawah ${AMBANG_ULANG}% di salah satu bagian`
          : <>Format JLPT {lv} · <b>{total} soal</b></>}
      </div>
      <div className="parts">
        <BarisBagian b={p.hikki} jenis="筆記" onBuka={onBuka} membuka={membuka} />
        <BarisBagian b={p.choukai} jenis="聴解" onBuka={onBuka} membuka={membuka} />
      </div>
      {p.status === "kurang" && rendah && <div className="ex-hint">Saran: ulangi <span lang="ja">{LABEL(rendah)}</span>, mulai dari soal yang salah.</div>}
    </article>
  );
}

function BarisBagian({ b, jenis, onBuka, membuka }: { b?: Bagian; jenis: "筆記" | "聴解"; onBuka: (b?: Bagian) => void; membuka: string | null }) {
  const w = jenis === "筆記";
  const ic = <span className={`pt-ic ${w ? "pi-w" : "pi-l"}`} lang="ja" aria-hidden="true">{w ? "筆" : "聴"}</span>;
  if (!b || b.status === "segera") {
    return (
      <div className="pt dis">
        {ic}
        <span><span className="pt-t" lang="ja">{jenis}{b ? ` · ${b.set.total} soal` : ""}</span><span className="pt-s">{b ? "Belum lengkap" : "Belum tersedia"}</span></span>
        <span className="pt-r"><span className="note">Segera</span></span>
      </div>
    );
  }
  const sibuk = membuka != null && membuka === b.set.katalogId;
  const judul = <span className="pt-t"><span lang="ja">{jenis}</span> · {b.set.total} soal</span>;
  let sub: React.ReactNode, kanan: React.ReactNode;
  if (sibuk) { sub = "Menyiapkan soal…"; kanan = null; }
  else if (b.status === "belum") { sub = w ? "~105 menit · 4 kategori" : "~50 menit · audio"; kanan = <span className="pt-go">Mulai →</span>; }
  else if (b.status === "sebagian") {
    sub = `Berhenti di soal ${b.dijawab}${b.set.terakhir ? ` · ${kapan(b.set.terakhir)}` : ""}`;
    kanan = <><span className="pt-bar"><i style={{ width: `${(b.dijawab / Math.max(1, b.set.total)) * 100}%` }} /></span><span className="pt-go">Lanjut →</span></>;
  } else {
    const rendah = (b.skor ?? 0) < AMBANG_ULANG;
    sub = b.set.terakhir ? `Selesai · ${kapan(b.set.terakhir)}` : "Selesai";
    kanan = <><span className={`pt-sc${rendah ? " low" : ""}`}>{b.skor}%</span><span className="pt-go">{rendah ? "Ulangi" : "Review"}</span></>;
  }
  return (
    <button type="button" className="pt" disabled={membuka != null} onClick={() => onBuka(b)}>
      {ic}
      <span>{judul}<span className="pt-s">{sub}</span></span>
      <span className="pt-r">{kanan}</span>
    </button>
  );
}
