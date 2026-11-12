"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-misi.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { honixSrc, type HonixPose } from "@/lib/honix-pose";
import "@/styles/kurikulum.css";
import "@/styles/alur.css";
import { ITEM_PENYELAMAT, MENIT_PENYELAMAT, PACE_MISI, langkahBerikut, urlLangkah, urlPenyelamat, type Langkah } from "@/lib/misi-harian";
import { namaUnit, rencanaKurikulum, setUnit, urlKurikulum } from "@/lib/misi-kurikulum";
import { useMisiHarian, type AlasanBolong } from "@/lib/use-misi-harian";
import { useKurikulum } from "@/lib/use-kurikulum";
import { ATURAN, fiturLive } from "@/lib/kurikulum-config";
import { gabungPerCat, labelPosisi, materiPerHari, seninDari } from "@/lib/kurikulum";
import { alasanLatihan, alasanMateri, alasanSalah, alasanTempo, detailTempo } from "@/lib/alasan-misi";
import { tanggalLokal } from "@/lib/aktivitas";
import { hitungPerkiraan, type SesiSkor } from "@/components/kurikulum/Perkiraan";
import { KartuKenalan } from "@/components/alur/KartuKenalan";
import { Strip } from "@/components/kurikulum/Bagian";
import { judulUlangan, unitUlangan } from "@/components/kurikulum/Ulangan";
import { MomenKurikulum, type IsiMomen } from "@/components/kurikulum/Momen";

const BOLONG: Record<AlasanBolong, [string, string]> = {
  sibuk: ["Lagi sibuk", "Wajar. Gimana kalau turun ke Santai 10 menit dulu? Bisa naik lagi kapan aja."],
  capek: ["Capek", "Istirahat juga bagian dari belajar. Mau coba Santai 10 menit seminggu ini?"],
  lupa: ["Lupa", "Santai cuma 10 menit, lebih gampang nyelip di hari yang padat. Mau coba?"],
  susah: ["Materinya susah", "Misi besok Honix isi lebih banyak ulang, materi barunya dikurangin. Mau sekalian turun ke Santai?"],
  lain: ["Lainnya", "Oke. Mau turun ke Santai 10 menit dulu biar enteng?"],
};

function Kepala({ eyebrow, judul, menit, target, peta = false }: { eyebrow: string; judul: string; menit: number; target: number; peta?: boolean }) {
  return (
    <>
      <div className="misi-h">
        <div>
          {peta
            ? <div className="mku-h"><div className="eyebrow">{eyebrow}</div><Link href="/kurikulum">Peta →</Link></div>
            : <div className="eyebrow">{eyebrow}</div>}
          <div className="misi-t">{judul}</div>
        </div>
        <div className="misi-min"><b>{menit}</b> / {target} menit</div>
      </div>
      <div className="mbar" role="progressbar" aria-label="Menit belajar hari ini" aria-valuenow={menit} aria-valuemin={0} aria-valuemax={target}>
        <i style={{ width: `${Math.min(100, (menit / target) * 100)}%` }} />
      </div>
    </>
  );
}

const KUNCI_LEWAT = "honix:lewat-ulangan";
const KUNCI_MOMEN = "honix:momen-unit";
const baca = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const tulis = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* mode privat */ } };

/** Kartu misi harian di Beranda (handoff Rencana Belajar §3–4 + tempelan kurikulum §9). */
export function MisiHarian({ level, rekorStreak, sesi }: {
  level: string;
  rekorStreak: number;
  /** sesi 30 hari terakhir (Beranda) — buat alasan langkah latihan */
  sesi?: SesiSkor[];
}) {
  const m = useMisiHarian(level);
  const k = useKurikulum(level);
  const ku = k.siap && k.kur ? k : null;
  const [biasa, setBiasa] = useState(false);
  const [pilih, setPilih] = useState<AlasanBolong | null>(null);
  const senin = ku ? seninDari(ku.hariIni) : "";
  const [lewatSenin, setLewatSenin] = useState(false);
  const [momen, setMomen] = useState<IsiMomen | null>(null);

  /* Minggu baru: momen "unit selesai" sekali per minggu (§8). */
  useEffect(() => {
    if (!ku || !senin) return;
    const lalu = setUnit(ku, ku.lalu);
    if (!lalu) return;
    if (baca(KUNCI_MOMEN) === senin) return;
    tulis(KUNCI_MOMEN, senin);
    const isi: IsiMomen = { jenis: "unit", judul: namaUnit(ku, ku.lalu), kata: lalu.kata.length, pola: lalu.pola.length, berikut: ku.ini.length ? namaUnit(ku, ku.ini) : null };
    const t = setTimeout(() => setMomen(isi), 600);
    return () => clearTimeout(t);
  }, [ku, senin]);

  const { tampilSheet, tutupSheet } = m;
  useEffect(() => {
    if (!tampilSheet) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") tutupSheet(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [tampilSheet, tutupSheet]);

  if (!m.siap) return <div className="rbk rbk-misi"><div className="card misi" aria-busy="true" style={{ minHeight: 180 }} /></div>;

  const P = PACE_MISI[m.tingkat];
  const rencana = ku ? rencanaKurikulum(ku, m.tingkat) : m.rencana;
  const berikut = langkahBerikut(rencana, m.langkah);
  const urlBerikut = (l: Langkah) => (ku ? urlKurikulum(l, ku) : urlLangkah(l, m.salah));
  const posisi = ku ? labelPosisi(ku.mode, ku.ini) : "";
  const pertama = Boolean(ku?.hariPertama);
  const eyebrow = ku ? `${pertama ? "Misi pertama" : "Misi hari ini"} · ${posisi}` : "Misi hari ini";

  /* Satu baris alasan per langkah (HANDOFF-alur-belajar §3). */
  const hariIni = ku?.hariIni ?? tanggalLokal();
  const perCat = gabungPerCat(sesi ?? [], hariIni, ATURAN.perkiraan.hari) as Record<string, { a: number; c: number }>;
  const est = fiturLive("perkiraan") && sesi ? hitungPerkiraan(sesi, level, hariIni) : null;
  const dilatih = est?.bagian.find(b => b.k.startsWith("言語知識"))?.k;
  const tg = ku?.tingkat.get("文法形式の判断");
  const labelUnit = ku && ku.ini.length ? (ku.mode === "normal" ? `Unit minggu ${ku.ini[0]} dari 26` : labelPosisi(ku.mode, ku.ini)) : "";
  const alasan = (l: Langkah): string => {
    if (l.n === 1) return ku ? alasanTempo(ku.tempoItem.length, pertama) : alasanSalah(m.salah.kata, m.salah.pola);
    if (l.n === 2) {
      if (!ku) return `Kata ${level} yang belum pernah kamu latih`;
      if (!ku.ini.length) return ku.mode === "akhir" ? "Ujian udah dekat · fokus ke yang sering salah" : "Semua unit udah kebagian · fokus ke yang sering salah";
      return alasanMateri({ label: labelUnit, hariIni, mulaiPenempatan: (ku.kur?.unit_mulai ?? 1) > 1, hariPertama: pertama });
    }
    return alasanLatihan({
      naik: tg && tg.e.arah === 1 ? { jenis: "文法形式の判断", t: tg.e.tingkat } : null,
      perkiraan: est?.siap && dilatih ? { bagian: est.bagian, dilatih } : null,
      perCat, kategori: "文法", bertingkat: Boolean(ku), pertama,
    });
  };
  const detail = ku && ku.tempoItem.length > 0 ? detailTempo(ku.tempoItem, hariIni, ATURAN.srsInterval) : null;
  const tierKilat = ku?.tingkat.get("文法形式の判断")?.tingkat ?? 1;
  const unitUl = ku ? unitUlangan(ku) : [];
  const ulanganSenin = ku && fiturLive("ulangan") && unitUl.length > 0 && new Date(`${ku.hariIni}T12:00:00`).getDay() === 1
    && !ku.ulangan.some(u => u.minggu === senin) && !lewatSenin && baca(KUNCI_LEWAT) !== senin;
  const selesai = berikut === null;
  let kartu: React.ReactNode;
  let honix: { pose: HonixPose; bub: string } | null = null;

  if (ulanganSenin) {
    kartu = (<>
      <div className="card misi" data-tur="misi">
        <div className="mku-h"><div className="eyebrow">Senin · misi khusus · {posisi}</div><Link href="/kurikulum">Peta kurikulum →</Link></div>
        <div className="misi-t">Ulangan {judulUlangan(ku, unitUl)} · ±10 menit</div>
        <Strip unit={ku.unit} />
        <p className="misi-p">Materi & yang salah minggu lalu, ditanya ulang dalam bentuk baru. <b>24 soal.</b> Misi biasa tetap ada setelahnya.</p>
        <div className="misi-cta">
          <Link className="btn btn-p btn-lg" href="/progres/ulangan">Mulai ulangan</Link>
          <button type="button" className="btn btn-q" onClick={() => { tulis(KUNCI_LEWAT, senin); setLewatSenin(true); }}>Lewati, ke misi biasa</button>
        </div>
        <p className="note" style={{ marginTop: 10 }}>Dilewati juga gak apa-apa. Yang lupa tetap masuk misi minggu ini.</p>
      </div>
      <KartuKenalan id="senin" live={fiturLive("ulangan")} />
    </>);
  } else if (m.penyelamat && !biasa) {
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
    if (ku) label.skip = "Belum ada yang jatuh tempo";
    const langkah = (
      <ol className="steps" data-tur="misi-langkah">
        {rencana.map(l => {
          const s = status(l.n, l.dilewati);
          return (
            <li key={l.n} className={`st ${s}`}>
              <span className="st-n">{s === "done" ? "✓" : l.n}</span>
              <div>
                <b>{l.judul}</b>
                {ku && l.n === 3
                  ? <small>{l.jumlah} soal · <span className="tier">T{tierKilat}</span><span lang="ja">文法形式の判断</span></small>
                  : <small>{pertama && l.n === 1 ? "Belum ada" : l.isi}</small>}
                <span className="why-l">{alasan(l)}</span>
                {l.n === 1 && detail && s !== "done" && (
                  <details className="whyd">
                    <summary>Kenapa {ku!.tempoItem.length} ini?</summary>
                    <ul>
                      {detail.baris.map(([kunci, teks]) => <li key={kunci}><b lang="ja">{kunci}</b><span>{teks}</span></li>)}
                      {detail.sisa > 0 && <li><b /><span>+{detail.sisa} lagi, alasannya sama</span></li>}
                    </ul>
                  </details>
                )}
                <span className="st-s">{label[s] ?? `±${l.menit} menit`}</span>
              </div>
            </li>
          );
        })}
      </ol>
    );
    if (selesai) {
      kartu = (
        <div className="card misi done" data-tur="misi">
          <Kepala eyebrow={eyebrow} peta={Boolean(ku)} judul="Misi selesai" menit={m.menitHariIni} target={P.m} />
          {ku && <div data-tur="strip"><Strip unit={ku.unit} /></div>}
          <p className="misi-p"><b>{m.menitHariIni} menit</b> hari ini{m.menitHariIni >= P.m ? `, lewat dari target ${P.m}` : ""}. Cap hari ini udah nempel di kalender.</p>
          {langkah}
          {ku && (() => {
            const set = setUnit(ku, ku.ini);
            return <div className="tmrw">Besok: <b>{ku.tempoBesok} item</b> jatuh tempo{set ? <> · <b>{materiPerHari(set).kata} kata</b> baru {labelUnit.toLowerCase().replace(" dari 26", "")}</> : null}</div>;
          })()}
          <div className="misi-cta">
            <Link className="btn btn-g" href="/materi">Latihan bebas</Link>
            <Link className="btn btn-q" href="/progres/pamer">Pamerin progres →</Link>
          </div>
        </div>
      );
      honix = { pose: "senang", bub: `Misi beres! ${m.menitHariIni} menit hari ini.` };
    } else {
      const jalan = m.langkah > 0;
      kartu = (
        <div className="card misi" data-tur="misi">
          <Kepala eyebrow={eyebrow} peta={Boolean(ku)} judul={`${P.e} ${P.t} · ${P.m} menit`} menit={m.menitHariIni} target={P.m} />
          {ku && <div data-tur="strip"><Strip unit={ku.unit} /></div>}
          {rencana[0].dilewati && !jalan && <p className="misi-p">Gak ada yang perlu diulang hari ini. Waktunya dipindah ke materi baru dan latihan soal.</p>}
          {ku && !ku.ini.length && <p className="misi-p">{ku.mode === "akhir" ? "Ujian udah dekat, materi baru gak ditambah." : "Semua unit udah kebagian."} Tambahin satu bagian set latihan format JLPT tiap hari. <Link href="/latihan/set?dari=misi">Buka Bank Soal →</Link></p>}
          {langkah}
          <div className="misi-cta">
            <Link className="btn btn-p btn-lg" href={urlBerikut(berikut)}>{jalan ? `Lanjut · ${berikut.judul}` : "Mulai misi hari ini"}</Link>
            <span className="note">{jalan ? `Lanjut dari langkah ${berikut.n}. Progres tersimpan otomatis.` : "Satu-satunya yang wajib tiap hari."}</span>
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

      {momen && <MomenKurikulum isi={momen} onTutup={() => setMomen(null)} />}

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
