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
import { muatBunpou, muatKotoba, type DekBunpou, type DekKotoba } from "@/lib/dek-materi";
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
    void Promise.all([muatKotoba(lv), muatBunpou(lv)]).then(([k, b]) => {
      if (batal) return;
      setDekK(k); setDekB(b);
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
    return {
      K, P, tk, tb, lanjutK, lanjutB,
      kataK: urut(kataK, tk?.grup), kataB: urut(kataB, tb?.grup),
      jumlahKelompokK: kataK.length, jumlahKelompokB: kataB.length,
      rawan: dekB.patterns.filter(p => p.confusableWith.length > 0).length,
      disimpan: dekK.vocabulary.filter(w => favorit.has(w.word)).length,
      baru: K[0] + K[1] + K[2] + P[0] + P[1] + P[2] === 0 && !tk && !tb,
    };
  }, [dekK, dekB, progK, progB, favorit, terakhir, lv]);

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

              <div className="today">
                <section className="card lj">
                  <div className="eyebrow">{hasil.baru ? "Mulai belajar" : "Lanjut dari terakhir"}</div>
                  {hasil.lanjutK && (
                    <div className="lj-r">
                      <span className="lj-g k" lang="ja">{hasil.lanjutK.jp.slice(0, 1)}</span>
                      <span>
                        <b>{hasil.baru ? "Mulai dari kelompok pertama: " : "Kotoba · "}<span lang="ja">{hasil.lanjutK.jp}</span> {hasil.lanjutK.nama}</b>
                        <small>{hasil.baru ? `${hasil.lanjutK.total} kata` : `${hasil.lanjutK.empat[0] + hasil.lanjutK.empat[1]} dari ${hasil.lanjutK.total} kata dimulai${hasil.tk ? ` · ${kapan(hasil.tk.at)}` : ""}`}</small>
                        {!hasil.baru && <div className="mbar"><i style={{ width: `${persenDimulai(hasil.lanjutK.empat)}%` }} /></div>}
                      </span>
                      <Link className="btn btn-p" href={hasil.lanjutK.href}>{hasil.baru ? "Mulai" : "Lanjut"}</Link>
                    </div>
                  )}
                  {hasil.lanjutB && (
                    <div className="lj-r">
                      <span className="lj-g b" lang="ja">{hasil.lanjutB.jp.slice(0, 1)}</span>
                      <span>
                        <b>{hasil.baru ? "Atau Bunpou: " : "Bunpou · "}<span lang="ja">{hasil.lanjutB.jp}</span> {hasil.lanjutB.nama}</b>
                        <small>
                          {hasil.baru ? `${hasil.lanjutB.total} pola`
                            : hasil.tb?.pola ? <>Terakhir dibuka <span lang="ja">{hasil.tb.pola}</span> · {kapan(hasil.tb.at)}</>
                            : `${hasil.lanjutB.empat[0] + hasil.lanjutB.empat[1]} dari ${hasil.lanjutB.total} pola dimulai${hasil.tb ? ` · ${kapan(hasil.tb.at)}` : ""}`}
                        </small>
                      </span>
                      <Link className="btn btn-g" href={hasil.lanjutB.href}>{hasil.baru ? "Mulai" : "Lanjut"}</Link>
                    </div>
                  )}
                </section>
                <PintuCepat salahK={hasil.K[2]} salahP={hasil.P[2]} rawan={hasil.rawan} />
              </div>

              <div className="kb">
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
                <Link className="card dr2 bs" href="/bank-soal">
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
      </main>
    </>
  );
}

function PintuCepat({ salahK, salahP, rawan }: { salahK: number; salahP: number; rawan: number }) {
  const salah = salahK + salahP;
  const ulang = salahK > 0 ? "/latihan/kotoba?mode=ulang&count=10" : "/latihan/kilat?mode=ulang&count=10&teknik=lewat";
  return (
    <div className="qd">
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
