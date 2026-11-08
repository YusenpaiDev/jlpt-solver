"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-strategi.css";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { KartuTeknik } from "@/components/rencana/KartuTeknik";
import { useUserStats } from "@/lib/use-user-stats";
import { useTeknikDisembunyikan } from "@/lib/use-teknik";
import { NAMA_BAGIAN, TEKNIK, strategiUntuk, type JenisSoal } from "@/lib/strategi-ujian";

/* Latihan yang paling nyambung buat tiap jenis soal. 文法形式 punya Latihan Kilat
   sendiri; sisanya latihan lewat Bank Soal. */
const LATIHAN: Partial<Record<JenisSoal, string>> = { bunpou: "/latihan/kilat?teknik=lewat" };

const pct = (v: number) => `${(v / 180) * 100}%`;

/** Contekan hari ujian per level target (handoff Rencana Belajar §6). */
export default function StrategiPage() {
  const stats = useUserStats();
  const router = useRouter();
  const teknik = useTeknikDisembunyikan();
  const [buka, setBuka] = useState<JenisSoal | null>(null);

  const L = strategiUntuk(stats.targetLevel);
  const total = L.waktu.reduce((n, b) => n + b.m, 0);
  const sesi = stats.examDate
    ? new Date(`${stats.examDate.slice(0, 10)}T00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    : "Sesi ujian belum dipilih";

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={stats.streak} xp={stats.xp} xpTarget={stats.xpTarget} avatarLetter={stats.initial} isPro={stats.isPro} />
        <Breadcrumb items={[{ label: "Bank Soal", href: "/materi#bank-soal" }, { label: "Strategi ujian" }]} />

        <div className="rbk">
          <div className="head">
            <div>
              <div className="eyebrow">{stats.loaded ? `${stats.targetLevel} · ${sesi}` : " "}</div>
              <h1 className="h1">Strategi ujian<span className="jp-g" lang="ja">戦略</span></h1>
              <p className="sub">Contekan buat hari ujian: waktu, nilai yang harus diamankan, dan urutan ngerjain.</p>
            </div>
          </div>

          <div className="sg">
            <section className="card cheat">
              <div className="eyebrow">Target skor aman</div>
              <div className="cheat-n">Incar <b>{L.aman}</b>, bukan <s>{L.lulus}</s>.</div>
              <p>Nilai lulus {L.lulus}/180. Kasih bantalan {L.aman - L.lulus} poin buat soal yang meleset.</p>
              <div className="scale">
                <i style={{ width: pct(L.aman) }} />
                <div className="mk r" style={{ left: pct(L.lulus) }}><span>Lulus {L.lulus}</span></div>
                <div className="mk safe" style={{ left: pct(L.aman) }}><span>Incar {L.aman}</span></div>
              </div>
              <div className="scale-x"><span>0</span><span>180</span></div>
              <div className="mins">
                <div className="h2" style={{ fontSize: 14 }}>Nilai minimum per bagian</div>
                {L.skor.map(s => (
                  <div className="mn" key={s.k}>
                    <div className="mn-k" lang="ja">{s.k}<small>{s.s}</small></div>
                    <div className="mn-b" aria-hidden="true"><em style={{ width: `${(s.min / s.max) * 100}%` }} /><i style={{ left: `${(s.min / s.max) * 100}%` }} /></div>
                    <div className="mn-v">min <b>{s.min}</b> / {s.max}</div>
                  </div>
                ))}
                <div className="warnbox">Satu bagian di bawah minimum = <b>gak lulus</b>, walau totalnya cukup.</div>
              </div>
            </section>

            <section className="card tcard">
              <div className="h2">Waktu ujian · {total} menit</div>
              <div className="tl-bar" aria-hidden="true">
                {L.waktu.map(b => <div key={b.k} style={{ flex: b.m, background: `var(--${b.c})` }} lang="ja">{b.k} · {b.m}</div>)}
              </div>
              <div className="tl-list">
                {L.waktu.map(b => (
                  <Fragment key={b.k}>
                    <div className="tl-r"><span lang="ja"><i style={{ background: `var(--${b.c})` }} />{b.k}</span><b>{b.m} menit</b></div>
                    {b.saran && <div className="tl-sp">Saran Honix: {b.saran.map(([k, m], i) => <span key={k}>{i > 0 && " · "}<b lang="ja">{k}</b> {m}</span>)}</div>}
                  </Fragment>
                ))}
              </div>
            </section>

            <section className="card tcard">
              <div className="h2">Urutan ngerjain</div>
              <ol className="ord">
                <li><div><b lang="ja">文字・語彙</b> dulu<small>Cepat, jangan mikir lama. Tahu ya tahu.</small></div></li>
                <li><div><b lang="ja">文法</b><small>Coret pilihan yang bentuknya gak nyambung.</small></div></li>
                <li><div><b lang="ja">読解</b>, mulai dari <b lang="ja">情報検索</b><small>Soal paling belakang, poinnya paling gampang diamankan. Lalu 短文 → 中文 → 長文.</small></div></li>
                <li><div>Isi semua jawaban<small>Gak ada pengurangan nilai. Jangan ada yang kosong.</small></div></li>
                <li><div><b lang="ja">聴解</b> ikutin audio<small>Pakai jeda sebelum soal buat baca pilihan jawaban.</small></div></li>
              </ol>
            </section>
          </div>

          <div className="sec-h"><div className="h2">Teknik per jenis soal</div><span className="note">Muncul sebelum latihan jenis soal itu</span></div>
          <div className="tk-grid">
            {TEKNIK.map(t => {
              const off = teknik.daftar.includes(t.id);
              return (
                <button key={t.id} type="button" className="card tkc" onClick={() => setBuka(t.id)}>
                  <span className="chip sec" style={{ ["--c" as string]: `var(--${t.sec})`, alignSelf: "flex-start" }} lang="ja">{NAMA_BAGIAN[t.sec]}</span>
                  <div className="tkc-t" lang="ja">{t.t}</div>
                  <div className="tkc-s">{t.i} · {t.tips[0]}</div>
                  <div className="tkc-f">{off ? <span className="off">Disembunyikan sebelum latihan</span> : <span>Tampil sebelum latihan</span>}<span>Buka →</span></div>
                </button>
              );
            })}
          </div>
          <p className="offi">Angka resmi dari jlpt.jp. Cek ulang sebelum ujian.</p>
        </div>

        {buka && (
          <KartuTeknik
            jenis={buka}
            disembunyikan={teknik.daftar.includes(buka)}
            onAtur={s => teknik.atur(buka, s)}
            onMulai={() => router.push(LATIHAN[buka] ?? "/materi#bank-soal")}
            onLewati={() => setBuka(null)}
            linkStrategi={false}
          />
        )}
      </main>
    </>
  );
}
