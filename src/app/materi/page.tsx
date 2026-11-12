"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-strategi.css";
import "@/styles/rencana-misi.css";
import "@/styles/materi-bank.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { BarisLevel } from "@/components/rencana/BarisLevel";
import { KartuKurikulumDisiapkan, KartuKurikulumLive } from "@/components/rencana/KartuKurikulum";
import { fiturLive } from "@/lib/kurikulum-config";
import { useUserStats } from "@/lib/use-user-stats";
import { muatBunpou, muatKotoba, muatPrioritas, type DekBunpou, type DekKotoba } from "@/lib/dek-materi";
import { jumlahPaket, paket, paketBerikut, teratas, UKURAN_PAKET } from "@/lib/sering-keluar";
import type { Prioritas } from "@/lib/kurikulum";
import { HonixTurHalaman } from "@/components/honix/HonixTurHalaman";
import { LANGKAH_MATERI } from "@/lib/tur-materi";
import { gabungBankSoal, type SetKatalog } from "@/lib/bank-soal";
import { susunPerjalanan } from "@/lib/perjalanan-soal";
import { bacaTerakhir, kapan, type Terakhir } from "@/lib/terakhir-dibuka";
import { DEV_BYPASS, devBankSoal, devProgres } from "@/lib/dev-materi";
import {
  statusKata, statusPola, hitungEmpat, persenDimulai, persenDikuasai, namaKelompokKata,
  type Empat, type Hitungan,
} from "@/lib/status-materi";

type Lv = "N1" | "N2" | "N3" | "N4" | "N5";

/* Warna 4 status: Dikuasai · Pernah muncul · Sering salah · Baru */
const EMPAT: [string, string][] = [
  ["Dikuasai", "var(--success)"], ["Pernah muncul", "rgba(255,255,255,.5)"],
  ["Sering salah", "var(--danger)"], ["Baru", "var(--surface-3)"],
];
const BARIS = 6;

interface Kelompok { kunci: string; jp: string; nama: string; total: number; empat: Empat; rawan: number; href: string }

/** /materi = tempat belajar: kurikulum + Kotoba & Bunpou
    (HANDOFF-materi-bank-soal §2). Daftar ujian pindah ke /bank-soal. */
export default function MateriPage() {
  const stats = useUserStats();
  const lv = stats.targetLevel as Lv;
  const [dekK, setDekK] = useState<DekKotoba | null>(null);
  const [dekB, setDekB] = useState<DekBunpou | null>(null);
  const [prio, setPrio] = useState<Prioritas>({});
  const [progK, setProgK] = useState<Map<string, Hitungan>>(new Map());
  const [progB, setProgB] = useState<Map<string, Hitungan>>(new Map());
  const [favorit, setFavorit] = useState<Set<string>>(new Set());
  const [jumlahSet, setJumlahSet] = useState<Record<string, number>>({});
  const [terakhir, setTerakhir] = useState<Terakhir>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setTerakhir(bacaTerakhir());
      if (DEV_BYPASS) {
        const mode = new URLSearchParams(window.location.search).get("dev");
        const d = ["N1", "N2", "N3", "N4", "N5"].map(l => devBankSoal(l, mode));
        const semua = gabungBankSoal([], d.flatMap(x => x.katalog));
        setJumlahSet(Object.fromEntries(["N1", "N2", "N3", "N4", "N5"].map(l => [l, susunPerjalanan(semua.filter(s => s.level === l)).filter(p => p.status !== "segera").length])));
        return;
      }
      if (!user) return;
      const [kp, bp, sw, kat] = await Promise.all([
        supabase.from("kotoba_progress").select("word, benar, salah").eq("user_id", user.id),
        supabase.from("bunpou_progress").select("pattern, benar, salah").eq("user_id", user.id),
        supabase.from("saved_words").select("kanji").eq("user_id", user.id).eq("favorite", true),
        supabase.rpc("daftar_katalog"),
      ]);
      setProgK(new Map((kp.data ?? []).map(r => [r.word, { benar: r.benar ?? 0, salah: r.salah ?? 0 }])));
      setProgB(new Map((bp.data ?? []).map(r => [r.pattern, { benar: r.benar ?? 0, salah: r.salah ?? 0 }])));
      setFavorit(new Set((sw.data ?? []).map(r => r.kanji)));
      const semua = gabungBankSoal([], kat.error ? [] : (kat.data ?? []) as SetKatalog[]);
      const per: Record<string, number> = {};
      for (const l of ["N1", "N2", "N3", "N4", "N5"]) {
        per[l] = susunPerjalanan(semua.filter(s => s.level === l)).filter(p => p.status !== "segera").length;
      }
      setJumlahSet(per);
    }
    void load();
  }, []);

  useEffect(() => {
    if (!stats.loaded) return;
    let batal = false;
    void Promise.all([muatKotoba(lv), muatBunpou(lv), muatPrioritas(lv)]).then(([k, b, p]) => {
      if (batal) return;
      setDekK(k); setDekB(b); setPrio(p);
      if (DEV_BYPASS) {
        const d = devProgres(k.vocabulary.map(w => w.word), b.patterns.map(p => p.pattern), new URLSearchParams(window.location.search).get("dev"));
        setProgK(new Map(d.kata.map(r => [r.word, r])));
        setProgB(new Map(d.pola.map(r => [r.pattern, r])));
      }
    });
    return () => { batal = true; };
  }, [stats.loaded, lv]);

  const hasil = useMemo(() => {
    if (!dekK || !dekB) return null;
    const sk = (w: { word: string }) => statusKata(progK.get(w.word));
    const sp = (p: { pattern: string }) => statusPola(progB.get(p.pattern));
    const tk = terakhir.kotoba?.level === lv ? terakhir.kotoba : undefined;
    const tb = terakhir.bunpou?.level === lv ? terakhir.bunpou : undefined;

    const kataK: Kelompok[] = dekK.groupOrder.map(g => {
      const isi = dekK.vocabulary.filter(w => w.group === g);
      const n = namaKelompokKata(g);
      return { kunci: g, jp: n.jp, nama: n.id, total: isi.length, empat: hitungEmpat(isi, sk), rawan: 0, href: `/materi/kotoba?grup=${encodeURIComponent(g)}` };
    }).filter(k => k.total > 0);
    const kataB: Kelompok[] = dekB.groups.map(g => {
      const isi = dekB.patterns.filter(p => p.functionGroup === g.key);
      return { kunci: g.key, jp: g.jp, nama: g.name, total: isi.length, empat: hitungEmpat(isi, sp), rawan: isi.filter(p => p.confusableWith.length > 0).length, href: `/materi/bunpou?grup=${encodeURIComponent(g.key)}` };
    }).filter(k => k.total > 0);

    /* Terakhir dibuka di atas, sisanya urutan bawaan. */
    const urut = (daftar: Kelompok[], kunci?: string) => {
      const t = daftar.find(k => k.kunci === kunci);
      return t ? [t, ...daftar.filter(k => k !== t)] : daftar;
    };
    /* Belum ada catatan "terakhir" di perangkat ini → kelompok yang lagi
       dikerjain (paling banyak dimulai tapi belum penuh), kalau gak ada yang pertama. */
    const tebak = (daftar: Kelompok[]) =>
      [...daftar].filter(k => persenDimulai(k.empat) < 100).sort((a, b) => persenDimulai(b.empat) - persenDimulai(a.empat))[0] ?? daftar[0];

    const K = hitungEmpat(dekK.vocabulary, sk);
    const P = hitungEmpat(dekB.patterns, sp);
    const lanjutK = kataK.find(k => k.kunci === tk?.grup) ?? tebak(kataK);
    const lanjutB = kataB.find(k => k.kunci === tb?.grup) ?? tebak(kataB);
    /* Paling sering keluar di soal, paket 10 (beres = semua udah pernah dilatih). */
    const topK = teratas(dekK.vocabulary, w => w.word, prio.kata);
    const topB = teratas(dekB.patterns, p => p.pattern, prio.pola);
    const sering = {
      kata: { isi: topK.map(w => w.word), berikut: paketBerikut(topK, w => sk(w) !== "new") },
      pola: { isi: topB.map(p => p.pattern), berikut: paketBerikut(topB, p => sp(p) !== "new") },
    };
    return {
      K, P, tk, tb, lanjutK, lanjutB, sering,
      kataK: urut(kataK, tk?.grup), kataB: urut(kataB, tb?.grup),
      jumlahKelompokK: kataK.length, jumlahKelompokB: kataB.length,
      rawan: dekB.patterns.filter(p => p.confusableWith.length > 0).length,
      disimpan: dekK.vocabulary.filter(w => favorit.has(w.word)).length,
      baru: K[0] + K[1] + K[2] + P[0] + P[1] + P[2] === 0 && !tk && !tb,
    };
  }, [dekK, dekB, progK, progB, favorit, terakhir, lv, prio]);

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={stats.streak} xp={stats.xp} xpTarget={stats.xpTarget} avatarLetter={stats.initial} isPro={stats.isPro} />
        <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Materi" }]} />

        <div className="rbk mbk">
          <div className="head">
            <div>
              <h1 className="h1">Materi<span className="jp-g" lang="ja">教材</span></h1>
              <BarisLevel level={lv} examDate={stats.examDate} />
            </div>
          </div>

          {!hasil ? <p className="mb-muat" role="status">Memuat materi…</p> : (
            <>
              <div className="mt-sec">
                {fiturLive("kurikulum")
                  ? <KartuKurikulumLive level={lv} />
                  : <KartuKurikulumDisiapkan level={lv} kata={dekK?.vocabulary.length ?? 0} pola={dekB?.patterns.length ?? 0} />}
              </div>

              {(hasil.sering.kata.isi.length > 0 || hasil.sering.pola.isi.length > 0) && <KartuSering lv={lv} sering={hasil.sering} />}

              <div className="today">
                <section className="card lj" data-tur="mt-lanjut">
                  <div className="eyebrow">{hasil.baru ? "Mulai belajar" : "Lanjut dari terakhir"}</div>
                  {hasil.lanjutK && (
                    <BarisLanjut jenis="kata" k={hasil.lanjutK} baru={hasil.baru} kapan={hasil.tk ? kapan(hasil.tk.at) : ""}
                      href={`/latihan/kotoba?group=${encodeURIComponent(hasil.lanjutK.kunci)}&count=10`} />
                  )}
                  {hasil.lanjutB && (
                    <BarisLanjut jenis="pola" k={hasil.lanjutB} baru={hasil.baru} kapan={hasil.tb ? kapan(hasil.tb.at) : ""} polaTerakhir={hasil.tb?.pola}
                      href={`/latihan/kilat?group=${encodeURIComponent(hasil.lanjutB.kunci)}&count=5`} />
                  )}
                </section>
                <PintuCepat salahK={hasil.K[2]} salahP={hasil.P[2]} rawan={hasil.rawan} />
              </div>

              <div className="kb" data-tur="mt-panel">
                <Panel judul="Kotoba" jp="語彙" ket={`${(dekK?.vocabulary.length ?? 0).toLocaleString("id-ID")} kata ${lv} · ${hasil.jumlahKelompokK} kelompok`}
                  empat={hasil.K} kelompok={hasil.kataK} satuan="kata" terakhir={hasil.tk?.grup}
                  semua={{ href: "/materi/kotoba", teks: `Semua ${hasil.jumlahKelompokK} kelompok →` }}
                  catatan={`⭐ ${hasil.disimpan} kata disimpan ke Kamus`} />
                <Panel judul="Bunpou" jp="文法" ket={`${dekB?.patterns.length ?? 0} pola ${lv} · ${hasil.jumlahKelompokB} kelompok fungsi`}
                  empat={hasil.P} kelompok={hasil.kataB} satuan="pola" terakhir={hasil.tb?.grup}
                  semua={{ href: "/materi/bunpou", teks: `Semua ${hasil.jumlahKelompokB} kelompok →` }}
                  catatan={`${hasil.rawan} pola rawan ketuker`} />
              </div>

              <div className="drs">
                <Link className="card dr2" href="/strategi">
                  <span className="sb-g" lang="ja">戦</span>
                  <span><b>Strategi ujian {lv}</b><small>Waktu per bagian, skor aman, urutan ngerjain</small></span>
                  <span className="btn btn-g">Buka</span>
                </Link>
                <Link className="card dr2 bs" href="/latihan/set">
                  <span className="sb-g" lang="ja">問</span>
                  <span><b>Latihan soal format JLPT</b><small>Bank Soal · {jumlahSet[lv] ? `${jumlahSet[lv]} set ${lv}` : "belum ada set"}, <span lang="ja">筆記</span> + <span lang="ja">聴解</span></small></span>
                  <span className="btn btn-g">Bank Soal →</span>
                </Link>
              </div>

              <div className="sec-h"><div className="h2">Materi mendatang</div><span className="note">Belum bisa dibuka</span></div>
              <div className="up">
                {([["漢", "Kanji", "Bacaan & tulisan per level"], ["聴", "Choukai terstruktur", "Latihan dengar per jenis soal"], ["読", "Dokkai", "Bacaan bertahap per panjang teks"]] as const).map(([g, t, d]) => (
                  <div className="card upc" key={t}>
                    <span className="sb-g" lang="ja">{g}</span>
                    <span><b>{t}</b><small>{d}</small></span>
                    <span className="chip">Segera</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {/* Tur pop-up sekali: ini loh mulai dari mana. */}
        {hasil && <HonixTurHalaman id="materi" langkah={LANGKAH_MATERI} />}
      </main>
    </>
  );
}

function PintuCepat({ salahK, salahP, rawan }: { salahK: number; salahP: number; rawan: number }) {
  const salah = salahK + salahP;
  const ulang = salahK > 0 ? "/latihan/kotoba?mode=ulang&count=10" : "/latihan/kilat?mode=ulang&count=10&teknik=lewat";
  return (
    <div className="qd" data-tur="mt-pintu">
      {salah > 0 ? (
        <Link className="card qd-b" href={ulang}>
          <span className="qd-i" lang="ja" style={{ color: "var(--danger)", background: "rgba(224,86,111,.14)" }}>誤</span>
          <span><b>Ulang yang sering salah</b><small>Kata & pola yang paling sering meleset</small></span>
          <span className="qd-n">{salah}</span>
        </Link>
      ) : (
        <div className="card qd-b off" aria-disabled="true">
          <span className="qd-i" lang="ja" style={{ color: "var(--danger)", background: "rgba(224,86,111,.14)" }}>誤</span>
          <span><b>Ulang yang sering salah</b><small>Belum ada. Muncul setelah kamu latihan.</small></span>
          <span className="qd-n">0</span>
        </div>
      )}
      <Link className="card qd-b" href="/latihan/kilat">
        <span className="qd-i" lang="ja" style={{ color: "var(--pt)", background: "rgba(221,65,36,.14)" }}>速</span>
        <span><b>Latihan Kilat</b><small>Drill 10 soal pola Bunpou</small></span>
        <span className="qd-n" />
      </Link>
      <Link className="card qd-b" href="/materi/bunpou?status=warn">
        <span className="qd-i" lang="ja" style={{ color: "#9CCBCD", background: "rgba(74,124,126,.2)" }}>比</span>
        <span><b>Bandingin pola rawan ketuker</b><small>Grup pola yang gampang ketuker</small></span>
        <span className="qd-n">{rawan}</span>
      </Link>
    </div>
  );
}

function BarStatus({ e }: { e: Empat }) {
  return (
    <div className="stb" role="img" aria-label={EMPAT.map(([t], i) => `${t} ${e[i]}`).join(", ")}>
      {e.slice(0, 3).map((v, i) => v > 0 && <i key={i} style={{ flex: v, background: EMPAT[i][1] }} />)}
      {e[3] > 0 && <i style={{ flex: e[3], background: "transparent" }} />}
    </div>
  );
}

function Panel({ judul, jp, ket, empat, kelompok, satuan, terakhir, semua, catatan }: {
  judul: string; jp: string; ket: string; empat: Empat; kelompok: Kelompok[]; satuan: "kata" | "pola";
  terakhir?: string; semua: { href: string; teks: string }; catatan: string;
}) {
  return (
    <section className="card kbp">
      <div className="kbp-h">
        <div>
          <div className="kbp-t">{judul}<span className="jp-g" lang="ja">{jp}</span></div>
          <div className="kbp-c">{ket}</div>
        </div>
        <div className="kbp-big"><b>{persenDikuasai(empat)}%</b><small>dikuasai</small></div>
      </div>
      <BarStatus e={empat} />
      <div className="sleg">
        {EMPAT.map(([t, w], i) => (
          <div key={t}>
            <span><i style={{ background: w, boxShadow: i === 3 ? "inset 0 0 0 1px var(--line-2)" : undefined }} />{t}</span>
            <b>{empat[i].toLocaleString("id-ID")}</b>
          </div>
        ))}
      </div>
      <ul className="gl">
        {kelompok.slice(0, BARIS).map(k => (
          <li key={k.kunci}>
            <Link className="gr" href={k.href}>
              <span className="gr-j" lang="ja">{k.jp}</span>
              <span>
                <b>{k.nama}{k.kunci === terakhir && <span className="last">Terakhir</span>}</b>
                <small>
                  <span>{k.total} {satuan}</span>
                  {k.empat[2] > 0 && <span className="bad-t">{k.empat[2]} sering salah</span>}
                  {k.rawan > 0 && <span className="warn-t">{k.rawan} rawan ketuker</span>}
                </small>
              </span>
              <span className="gr-p">{persenDimulai(k.empat)}% dimulai<BarStatus e={k.empat} /></span>
              <span className="gr-go" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="kbp-f">
        <Link className="btn btn-g" href={semua.href}>{semua.teks}</Link>
        <span className="note">{catatan}</span>
      </div>
    </section>
  );
}

/* "Lanjut dari terakhir" (permintaan owner 12 Nov): bahasa sehari-hari dulu,
   istilah Kotoba/Bunpou jadi label kecil; kalimat ajakan + tombol yang bilang
   mau ngapain, langsung ke latihan. Daftar lengkapnya tetap bisa dibuka. */
const JENIS = {
  kata: { label: "Hafalan kata", istilah: "Kotoba", jp: "語彙", satuan: "kata", n: 10, menit: 4, aksi: "Hafalin", cls: "k" },
  pola: { label: "Pola kalimat", istilah: "Bunpou", jp: "文法", satuan: "pola", n: 5, menit: 3, aksi: "Latihan", cls: "b" },
} as const;

function BarisLanjut({ jenis, k, baru, kapan: kpn, polaTerakhir, href }: {
  jenis: keyof typeof JENIS; k: Kelompok; baru: boolean; kapan: string; polaTerakhir?: string; href: string;
}) {
  const J = JENIS[jenis];
  const mulai = k.empat[0] + k.empat[1];
  const sisa = Math.max(0, k.total - mulai);
  const n = Math.min(J.n, baru || sisa === 0 ? k.total : sisa);
  const ajak = baru
    ? `${k.total} ${J.satuan} di kelompok ini. Mulai ${n} dulu, cuma ±${J.menit} menit.`
    : sisa === 0
      ? `Semua ${J.satuan} udah dimulai. Ulang biar makin nempel.`
      : sisa <= J.n
        ? `Tinggal ${sisa} ${J.satuan} lagi. Beresin sekarang, cuma ±${J.menit} menit.`
        : `Tinggal ${sisa} ${J.satuan} lagi. ${n} ${J.satuan} cuma ±${J.menit} menit.`;
  return (
    <div className="lj-r">
      <span className={`lj-g ${J.cls}`} lang="ja">{k.jp.slice(0, 1)}</span>
      <span>
        <span className={`lj-j ${J.cls}`}>{J.label}<em>{J.istilah} <span lang="ja">{J.jp}</span></em></span>
        <b>{k.nama} <span className="lj-jp" lang="ja">{k.jp}</span></b>
        <small>{ajak}</small>
        {(kpn || polaTerakhir) && !baru && (
          <small className="lj-t">Terakhir {polaTerakhir ? <><span lang="ja">{polaTerakhir}</span> · </> : ""}{kpn}</small>
        )}
        <div className="mbar" aria-label={`${mulai} dari ${k.total} ${J.satuan} dimulai`}><i style={{ width: `${persenDimulai(k.empat)}%` }} /></div>
      </span>
      <span className="lj-a">
        <Link className="btn btn-p" href={href}>{sisa > 0 || baru ? `${J.aksi} ${n} ${J.satuan}` : `Ulang ${n} ${J.satuan}`} →</Link>
        <Link className="lj-l" href={k.href}>Lihat daftarnya</Link>
      </span>
    </div>
  );
}

/* "Mulai dari yang paling sering keluar" (permintaan owner 12 Nov): alasan
   konkret buat hafalan + paket 10 yang bisa beres satu-satu. Contoh isi paket
   berikutnya ditunjukin biar kelihatan "ini loh yang dihafal". */
const JENIS_SK = {
  kata: { label: "Hafalan kata", istilah: "Kotoba", satuan: "kata", aksi: "Hafalin", cls: "k", latihan: "/latihan/kotoba", daftar: "/materi/kotoba" },
  pola: { label: "Pola kalimat", istilah: "Bunpou", satuan: "pola", aksi: "Latihan", cls: "b", latihan: "/latihan/kilat", daftar: "/materi/bunpou" },
} as const;

function KartuSering({ lv, sering }: { lv: string; sering: Record<keyof typeof JENIS_SK, { isi: string[]; berikut: number | null }> }) {
  return (
    <section className="card skc" data-tur="mt-sering">
      <div className="eyebrow">Bingung mulai dari mana?</div>
      <b className="skc-t">🔥 Hafalin yang paling sering keluar di soal</b>
      <p className="skc-p">Kata & pola yang paling sering muncul di soal {lv}, dipecah paket {UKURAN_PAKET}. Satu paket cuma ±4 menit.</p>
      <div className="skc-g">
        {(Object.keys(JENIS_SK) as (keyof typeof JENIS_SK)[]).filter(j => sering[j].isi.length > 0).map(j => {
          const J = JENIS_SK[j];
          const { isi, berikut } = sering[j];
          const n = jumlahPaket(isi.length);
          const beres = berikut == null ? n : berikut - 1;
          const contoh = paket(isi, berikut ?? 1).slice(0, 4);
          const href = berikut != null ? `${J.latihan}?sering=1&paket=${berikut}&count=${UKURAN_PAKET}` : `${J.latihan}?sering=1&count=${UKURAN_PAKET}`;
          return (
            <div className="skc-r" key={j}>
              <span className={`lj-j ${J.cls}`}>{J.label}<em>{J.istilah}</em></span>
              <div className="skc-pk" aria-label={`${beres} dari ${n} paket beres`}>
                {Array.from({ length: n }, (_, i) => (
                  <i key={i} className={i < beres ? "ok" : i + 1 === berikut ? "now" : ""}>{i < beres ? "✓" : i + 1}</i>
                ))}
                <span>{berikut != null ? `Paket ${berikut} dari ${n}` : "Semua paket beres 🎉"}</span>
              </div>
              <div className="skc-c" lang="ja">{contoh.map(x => <span key={x}>{x}</span>)}{berikut != null && <small>+{paket(isi, berikut).length - contoh.length} lagi</small>}</div>
              <div className="skc-a">
                <Link className="btn btn-p" href={href}>{berikut != null ? `${J.aksi} paket ${berikut}` : `Ulang ${UKURAN_PAKET} ${J.satuan} acak`} →</Link>
                <Link className="lj-l" href={`${J.daftar}?sering=1`}>Lihat semua {isi.length} {J.satuan}</Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
