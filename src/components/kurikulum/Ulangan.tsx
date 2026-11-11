"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-tes.css";
import "@/styles/rencana-misi.css";
import "@/styles/kurikulum.css";

import Link from "next/link";
import { honixSrc } from "@/lib/honix-pose";
import { ATURAN, fiturLive } from "@/lib/kurikulum-config";
import { seninDari } from "@/lib/kurikulum";
import { useKurikulum, type Kurikulum, type Ulangan as BarisUlangan } from "@/lib/use-kurikulum";
import { namaUnit } from "@/lib/misi-kurikulum";
import { BelumMulai } from "@/components/kurikulum/Bagian";

export const BAGIAN_ULANGAN: { k: string; c: string }[] = [
  { k: "Kata", c: "var(--goi)" }, { k: "Pola", c: "var(--bunpou)" }, { k: "Jenis soal", c: "var(--dokkai)" },
];

/** Unit yang diulang minggu ini = unit minggu lalu (bisa 2 kalau dipadatin); [] kalau gak ada. */
export function unitUlangan(k: Kurikulum): number[] {
  return k.kur ? k.lalu.filter(u => u >= k.kur!.unit_mulai) : [];
}

/** "minggu 11" / "unit 5–6" buat judul ulangan. */
export const judulUlangan = (k: Kurikulum, us: number[]) => namaUnit(k, us).toLowerCase();

/** Kenapa minggu ini gak ada ulangan. */
export function tanpaUlangan(k: Kurikulum): string {
  if (k.mode === "akhir") return "Mode akhir: gak ada materi baru, jadi ulangan mingguan diganti set latihan format JLPT di Bank Soal.";
  if (k.minggu > 0 && !k.ini.length) return "Masa cadangan: semua unit udah kebagian. Isi minggu ini ulang yang lemah & simulasi.";
  return "Ulangan pertama muncul Senin depan, setelah unit minggu ini selesai.";
}

/** Tab Ulangan di Progres (gantiin Tes mini, HANDOFF-kurikulum §10). */
export function UlanganTab({ level }: { level: string }) {
  const k = useKurikulum(level);
  if (!k.siap) return <div className="rbk"><p className="ku-muat" role="status">Memuat ulangan…</p></div>;
  if (k.belumMulai) return <div className="rbk"><BelumMulai level={level} penempatan={fiturLive("penempatan")} /></div>;
  const minggu = seninDari(k.hariIni);
  const ini = k.ulangan.find(x => x.minggu === minggu);
  if (ini) {
    const lalu = k.ulangan.filter(x => x.minggu < minggu).pop();
    return <div className="rbk"><HasilUlangan baris={ini} lalu={lalu} /></div>;
  }
  const u = unitUlangan(k);
  const A = ATURAN.ulangan;
  const total = A.kata + A.pola + A.jenis;
  const riwayat = k.ulangan.slice(-3);
  return (
    <div className="rbk">
      <div className="tes-in">
        <section className="card ti">
          <div className="eyebrow">Ulangan mingguan{u.length ? ` · ${judulUlangan(k, u)}` : ""}</div>
          <div className="ti-big">±10 menit<span>·</span>{total} soal</div>
          <div className="comp">{BAGIAN_ULANGAN.map((b, i) => <div key={b.k} style={{ flex: [A.kata, A.pola, A.jenis][i], background: b.c }} />)}</div>
          <div className="comp-l">{BAGIAN_ULANGAN.map((b, i) => <span key={b.k}><i style={{ background: b.c }} />{b.k} {[A.kata, A.pola, A.jenis][i]}</span>)}</div>
          <ul className="rules">
            <li>Kata yang kemarin kamu tebak artinya, sekarang kamu baca kanjinya.</li>
            <li>Pola ditanya lagi pakai contoh kalimat yang beda.</li>
            <li>Waktu cuma dicatat. Dilewati juga gak apa-apa, yang lupa tetap masuk misi.</li>
          </ul>
          <div className="misi-cta">
            {u.length ? <Link className="btn btn-p btn-lg" href="/progres/ulangan">Mulai ulangan</Link>
              : <span className="note">{tanpaUlangan(k)}</span>}
          </div>
        </section>
        <section className="card ti">
          <div className="eyebrow" style={{ color: "var(--dim)" }}>{riwayat.length ? `${riwayat.length} ulangan terakhir` : "Belum ada ulangan"}</div>
          {riwayat.length > 0 && (
            <div className="hist">
              {riwayat.map(r => <div key={r.minggu}><span>Minggu {r.unit}</span><i style={{ "--p": `${(r.benar / r.total) * 100}%` } as React.CSSProperties} /><b>{r.benar} / {r.total}</b></div>)}
            </div>
          )}
          <p className="note" style={{ marginTop: 16 }}>Gantiin tes mini. Hasilnya juga ikut ngisi perkiraan skor.</p>
        </section>
      </div>
    </div>
  );
}

/** Hasil ulangan (§10): Honix senang kalau naik / ≥ 75%, bangkit kalau turun. */
export function HasilUlangan({ baris, lalu, onUlang }: { baris: BarisUlangan; lalu?: BarisUlangan; onUlang?: () => void }) {
  const d = lalu ? baris.benar - lalu.benar : null;
  const senang = (d != null && d > 0) || baris.benar / baris.total >= ATURAN.ulangan.senang;
  const turun = d != null && d < 0;
  const lupa = baris.item_lupa;
  return (
    <>
      <section className="card tr-h">
        <div>
          <div className="eyebrow">Hasil ulangan · minggu {baris.unit}</div>
          <div className="tr-v">Nempel {baris.benar} dari {baris.total}</div>
          <div className="tr-s" style={{ marginTop: 8 }}>
            {lalu ? `Minggu lalu ${lalu.benar} · ${d! > 0 ? `naik ${d}` : d! < 0 ? `turun ${-d!}` : "sama"}. ` : ""}Yang belum nempel gak hilang, masuk misi minggu ini.
          </div>
        </div>
        {(senang || turun) && (
          // eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix
          <div className="tr-hx"><img className="hx" src={honixSrc(turun && !senang ? "bangkit" : "senang")} alt="Honix" /></div>
        )}
      </section>
      <div className="ul-g" style={{ marginTop: 16 }}>
        <section className="card sr" style={{ marginTop: 0 }}>
          <div className="h2">Per bagian</div>
          {BAGIAN_ULANGAN.map(b => {
            const x = baris.per_bagian[b.k];
            if (!x) return null;
            const y = lalu?.per_bagian[b.k];
            return (
              <div className="srr" key={b.k}>
                <div className="srk">{b.k}</div>
                <div className="srb"><i style={{ width: `${(x.benar / x.total) * 100}%`, background: b.c }} /></div>
                <div className="srv"><b>{x.benar}</b><span> / {x.total}</span>{y && <small className="note">minggu lalu {y.benar}</small>}</div>
              </div>
            );
          })}
        </section>
        <section className="card sr" style={{ marginTop: 0 }}>
          <div className="h2">{lupa.length ? "Masih lupa · masuk misi minggu ini" : "Semua nempel"}</div>
          {lupa.length > 0 ? (
            <ul className="lupa">
              {lupa.slice(0, 8).map(l => (
                <li key={`${l.jenis}:${l.kunci}`}>
                  <span><b lang="ja">{l.kunci}</b>{l.baca && <em lang="ja">{l.baca}</em>}{l.arti}</span>
                  <span className="st-chip">{l.jenis === "kata" ? "Kata" : "Pola"}</span>
                </li>
              ))}
              {lupa.length > 8 && <li><span className="note">+{lupa.length - 8} lagi, ikut diulang</span><span /></li>}
            </ul>
          ) : <p className="note" style={{ margin: "10px 0 16px" }}>Gak ada yang perlu diulang dari minggu lalu. Mantap.</p>}
          <div className="tr-a" style={{ marginTop: 0 }}>
            {lupa.length > 0 && onUlang && <button type="button" className="btn btn-p" onClick={onUlang}>Ulang {lupa.length} sekarang · ±{Math.max(1, Math.round(lupa.length / 2))} menit</button>}
            <Link className="btn btn-q" href="/">{lupa.length ? "Nanti, ikut misi" : "Ke Beranda"}</Link>
          </div>
        </section>
      </div>
    </>
  );
}
