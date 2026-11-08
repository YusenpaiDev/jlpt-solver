"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-misi.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { honixSrc, type HonixPose } from "@/lib/honix-pose";
import { ITEM_PENYELAMAT, MENIT_PENYELAMAT, PACE_MISI, langkahBerikut, urlLangkah, urlPenyelamat } from "@/lib/misi-harian";
import { useMisiHarian, type AlasanBolong } from "@/lib/use-misi-harian";

const BOLONG: Record<AlasanBolong, [string, string]> = {
  sibuk: ["Lagi sibuk", "Wajar. Gimana kalau turun ke Santai 10 menit dulu? Bisa naik lagi kapan aja."],
  capek: ["Capek", "Istirahat juga bagian dari belajar. Mau coba Santai 10 menit seminggu ini?"],
  lupa: ["Lupa", "Santai cuma 10 menit, lebih gampang nyelip di hari yang padat. Mau coba?"],
  susah: ["Materinya susah", "Misi besok Honix isi lebih banyak ulang, materi barunya dikurangin. Mau sekalian turun ke Santai?"],
  lain: ["Lainnya", "Oke. Mau turun ke Santai 10 menit dulu biar enteng?"],
};

function Kepala({ eyebrow, judul, menit, target }: { eyebrow: string; judul: string; menit: number; target: number }) {
  return (
    <>
      <div className="misi-h">
        <div><div className="eyebrow">{eyebrow}</div><div className="misi-t">{judul}</div></div>
        <div className="misi-min"><b>{menit}</b> / {target} menit</div>
      </div>
      <div className="mbar" role="progressbar" aria-label="Menit belajar hari ini" aria-valuenow={menit} aria-valuemin={0} aria-valuemax={target}>
        <i style={{ width: `${Math.min(100, (menit / target) * 100)}%` }} />
      </div>
    </>
  );
}

/** Kartu misi harian di Beranda (handoff Rencana Belajar §3–4). */
export function MisiHarian({ level, rekorStreak }: { level: string; rekorStreak: number }) {
  const m = useMisiHarian(level);
  const [biasa, setBiasa] = useState(false);
  const [pilih, setPilih] = useState<AlasanBolong | null>(null);

  const { tampilSheet, tutupSheet } = m;
  useEffect(() => {
    if (!tampilSheet) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") tutupSheet(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [tampilSheet, tutupSheet]);

  if (!m.siap) return <div className="rbk rbk-misi"><div className="card misi" aria-busy="true" style={{ minHeight: 180 }} /></div>;

  const P = PACE_MISI[m.tingkat];
  const berikut = langkahBerikut(m.rencana, m.langkah);
  const selesai = berikut === null;
  let kartu: React.ReactNode;
  let honix: { pose: HonixPose; bub: string } | null = null;

  if (m.penyelamat && !biasa) {
    const apa = m.salah.kata > 0 ? "kata" : m.salah.pola > 0 ? "pola" : null;
    kartu = (
      <div className="card misi rescue">
        <Kepala eyebrow="Misi penyelamat" judul={`${MENIT_PENYELAMAT} menit aja hari ini`} menit={m.menitHariIni} target={MENIT_PENYELAMAT} />
        <p className="misi-p">{m.bolong.jenis === "p1" ? "Kemarin" : "Beberapa hari ini"} bolong, gak apa-apa. Ulang <b>{ITEM_PENYELAMAT} {apa ?? "kata"}{apa ? " yang sering salah" : ""}</b>, streak nyala lagi.</p>
        <ol className="steps" style={{ gridTemplateColumns: "1fr" }}>
          <li className="st"><span className="st-n">1</span><div><b>Ulang yang salah</b><small>{ITEM_PENYELAMAT} {apa ?? "kata"}{apa ? " sering salah" : ""} · ±{MENIT_PENYELAMAT} menit</small></div></li>
        </ol>
        <div className="misi-cta">
          <Link className="btn btn-p btn-lg" href={urlPenyelamat(m.salah)}>Mulai {MENIT_PENYELAMAT} menit</Link>
          <button type="button" className="btn btn-q" onClick={() => setBiasa(true)}>Misi biasa · {P.m} menit</button>
        </div>
        <p className="note" style={{ marginTop: 10 }}>Rekor {rekorStreak} hari kamu tetap tercatat.</p>
      </div>
    );
    honix = { pose: "bangkit", bub: "Yuk, nyalain lagi bareng Honix." };
  } else {
    const status = (n: number, dilewati: boolean) =>
      dilewati ? "skip" : n <= m.langkah ? "done" : m.langkah > 0 && berikut?.n === n ? "run" : "todo";
    const label = { done: "Selesai", run: "Lagi jalan", skip: "Gak ada yang perlu diulang" } as Record<string, string>;
    const langkah = (
      <ol className="steps">
        {m.rencana.map(l => {
          const s = status(l.n, l.dilewati);
          return (
            <li key={l.n} className={`st ${s}`}>
              <span className="st-n">{s === "done" ? "✓" : l.n}</span>
              <div><b>{l.judul}</b><small>{l.isi}</small><span className="st-s">{label[s] ?? `±${l.menit} menit`}</span></div>
            </li>
          );
        })}
      </ol>
    );
    if (selesai) {
      kartu = (
        <div className="card misi done">
          <Kepala eyebrow="Misi hari ini" judul="Misi selesai" menit={m.menitHariIni} target={P.m} />
          <p className="misi-p"><b>{m.menitHariIni} menit</b> hari ini{m.menitHariIni >= P.m ? `, lewat dari target ${P.m}` : ""}. Cap hari ini udah nempel di kalender.</p>
          {langkah}
          <div className="misi-cta">
            <Link className="btn btn-g" href="/materi">Latihan bebas</Link>
            <Link className="btn btn-q" href="/progres?tab=waktu">Lihat kalender cap →</Link>
          </div>
        </div>
      );
      honix = { pose: "senang", bub: "Misi beres! Besok lanjut lagi, ya." };
    } else {
      const jalan = m.langkah > 0;
      kartu = (
        <div className="card misi">
          <Kepala eyebrow="Misi hari ini" judul={`${P.e} ${P.t} · ${P.m} menit`} menit={m.menitHariIni} target={P.m} />
          {m.rencana[0].dilewati && !jalan && <p className="misi-p">Gak ada yang perlu diulang hari ini. Waktunya dipindah ke materi baru dan latihan soal.</p>}
          {langkah}
          <div className="misi-cta">
            <Link className="btn btn-p btn-lg" href={urlLangkah(berikut, m.salah)}>{jalan ? `Lanjut · ${berikut.judul}` : `Mulai misi · ${P.m} menit`}</Link>
            <span className="note">{jalan ? `Lanjut dari langkah ${berikut.n}. Progres tersimpan otomatis.` : "Tiga langkah, jalan otomatis berurutan."}</span>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="rbk rbk-misi">
      {honix ? (
        <div className="misi-wrap">
          {kartu}
          <div className="misi-hx">
            <div className="bub">{honix.bub}</div>
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix, ukuran tetap */}
            <img className="hx" src={honixSrc(honix.pose)} alt="Honix" />
          </div>
        </div>
      ) : kartu}

      {/* Portal ke body: kolom Beranda punya stacking context sendiri, overlay di dalamnya ketutup kartu lain. */}
      {m.tampilSheet && createPortal(<div className="rbk">
        <div className="ov" onClick={e => { if (e.target === e.currentTarget) m.tutupSheet(); }}>
          <div className="card sheet" role="dialog" aria-modal="true" aria-label="Honix nanya">
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix, ukuran tetap */}
            <img className="hx sh-hx" src={honixSrc("tunggu")} alt="Honix menunggu" />
            <h2>Dua hari gak ketemu.</h2>
            <p>Honix gak marah kok. Lagi kenapa?</p>
            <div className="opts">
              {(Object.keys(BOLONG) as AlasanBolong[]).map(k => (
                <button key={k} type="button" className={`chip${pilih === k ? " sel" : ""}`} aria-pressed={pilih === k} onClick={() => setPilih(k)}>{BOLONG[k][0]}</button>
              ))}
            </div>
            {pilih && (
              <div className="resp" role="status">
                <p>{m.tingkat === "santai" ? "Santai udah paling ringan. Mulai dari misi penyelamat 5 menit aja, ya." : BOLONG[pilih][1]}</p>
                <div className="sh-a">
                  {m.tingkat === "santai"
                    ? <button type="button" className="btn btn-p" onClick={() => m.jawabBolong(pilih, false)}>Oke, 5 menit</button>
                    : <>
                        <button type="button" className="btn btn-p" onClick={() => m.jawabBolong(pilih, true)}>Turunin ke 🌱 Santai · 10 menit</button>
                        <button type="button" className="btn btn-g" onClick={() => m.jawabBolong(pilih, false)}>Tetap {P.e} {P.t}</button>
                      </>}
                </div>
              </div>
            )}
            <button type="button" className="btn btn-q sh-x" onClick={m.tutupSheet}>Nanti aja</button>
          </div>
        </div>
      </div>, document.body)}
    </div>
  );
}
