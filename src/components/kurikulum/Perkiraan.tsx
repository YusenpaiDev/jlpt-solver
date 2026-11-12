"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-tes.css";
import "@/styles/rencana-strategi.css";
import "@/styles/rencana-belajar.css";
import "@/styles/kurikulum.css";
import "@/styles/alur.css";

import { useMemo } from "react";
import Link from "next/link";
import { ATURAN } from "@/lib/kurikulum-config";
import { strategiUntuk } from "@/lib/strategi-ujian";
import { gabungPerCat, perkiraanSkor, tambahHari, type Perkiraan } from "@/lib/kurikulum";
import { KartuKenalan } from "@/components/alur/KartuKenalan";

export interface SesiSkor { created_at: string; stats?: { perCat?: Record<string, { a?: number; c?: number }>; last_practiced_at?: string } | null }

const WARNA: Record<string, string> = { "言語知識": "var(--goi)", "言語知識・読解": "var(--goi)", "読解": "var(--dokkai)", "聴解": "var(--choukai)" };

export function hitungPerkiraan(sesi: SesiSkor[], level: string, hariIni: string): Perkiraan {
  const L = strategiUntuk(level);
  return perkiraanSkor(gabungPerCat(sesi, hariIni, ATURAN.perkiraan.hari), L.skor, L.lulus, ATURAN.perkiraan);
}

/** Perkiraan skor di Progres (HANDOFF-kurikulum §11). Selalu "perkiraan", bukan skor resmi. */
export function PerkiraanSkor({ sesi, level, hariIni }: { sesi: SesiSkor[]; level: string; hariIni: string }) {
  const p = useMemo(() => hitungPerkiraan(sesi, level, hariIni), [sesi, level, hariIni]);
  const tren = useMemo(() => [5, 4, 3, 2, 1, 0].map(w => {
    const hari = tambahHari(hariIni, -7 * w);
    const x = hitungPerkiraan(sesi, level, hari);
    const [, m, d] = hari.split("-").map(Number);
    return { label: w === 0 ? "Ini" : `${d}/${m}`, total: x.siap ? x.total : null };
  }), [sesi, level, hariIni]);
  const A = ATURAN.perkiraan;

  if (!p.siap) {
    const perHari = 30;
    return (
      <div className="rbk"><section className="card est">
        <div className="eyebrow">Perkiraan skor · kalau ujiannya hari ini</div>
        <div className="tr-v" style={{ color: "var(--text)" }}>Belum bisa dihitung</div>
        <p className="tr-s" style={{ marginTop: 8 }}>Baru <b>{p.jawaban} jawaban</b> dalam {A.hari} hari. {p.kurang > 0 ? `Butuh ±${p.kurang} jawaban lagi, kira-kira ${Math.max(1, Math.ceil(p.kurang / perHari))} hari misi.` : `Tiap bagian butuh minimal ${A.minBagian} jawaban.`}</p>
        <div className="few-b"><i style={{ width: `${Math.min(100, (p.jawaban / A.minTotal) * 100)}%` }} /></div>
        <div className="note">{p.jawaban} / {A.minTotal} jawaban</div>
        <div className="mins">
          {p.bagian.map(b => (
            <div className="mn" key={b.k}>
              <div className="mn-k" lang="ja">{b.k}<small>{b.s}</small></div>
              <div className="mn-b" style={{ background: "repeating-linear-gradient(90deg,var(--surface-3) 0 6px,transparent 6px 10px)" }} />
              <div className="mn-v">{b.jawaban} jawaban</div>
            </div>
          ))}
        </div>
        <p className="note" style={{ marginTop: 14 }}>Perkiraan muncul begitu ada {A.minTotal} jawaban, minimal {A.minBagian} per bagian.</p>
      </section></div>
    );
  }

  const rendah = p.bagian.find(b => !b.aman);
  return (
    <div className="rbk"><section className="card est">
      <div className="est-top">
        <div>
          <div className="eyebrow">Perkiraan skor · kalau ujiannya hari ini</div>
          <div className="est-n">{p.total}<span>/ {p.maks}</span></div>
          <p className="tr-s">Nilai lulus {p.lulus} · {p.diatasLulus ? <b className="ok-t">perkiraan: di atas nilai lulus</b> : <b className="bad-t">perkiraan: belum lulus</b>}<br />Dari {p.jawaban} jawaban · {A.hari} hari terakhir</p>
        </div>
        <div>
          <div className="trd-h">Tren per minggu</div>
          <div className="trd">
            <div className="trd-l" style={{ bottom: `${(p.lulus / p.maks) * 80}%` }}><span>lulus {p.lulus}</span></div>
            {tren.map(t => (
              <div key={t.label}>
                <b>{t.total ?? "–"}</b>
                <i style={{ height: `${((t.total ?? 0) / p.maks) * 80}%` }} />
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {p.bagian.map(b => (
        <div className={`srr${b.aman ? "" : " low"}`} key={b.k}>
          <div className="srk" lang="ja">{b.k}<small>{b.s} · {b.jawaban} jawaban</small></div>
          <div className="srb"><i style={{ width: `${(b.nilai / b.max) * 100}%`, background: b.aman ? WARNA[b.k] : "var(--danger)" }} /><em style={{ left: `${(b.min / b.max) * 100}%` }}><span>min {b.min}</span></em></div>
          <div className="srv">
            <b>{b.nilai}</b><span> / {b.max}</span>
            <small className={b.aman ? "ok-t" : "bad-t"}>{b.aman ? "Aman" : "Di bawah minimum"}</small>
            {!b.akurat && <span className="est-dn">Masih kira-kira · butuh ±{A.akurat - b.jawaban} jawaban lagi</span>}
          </div>
        </div>
      ))}
      {rendah && p.total >= p.lulus && (
        <div className="why">Total <b>{p.total}</b> udah lewat nilai lulus {p.lulus}, tapi <b lang="ja">{rendah.k}</b> cuma <b>{rendah.nilai}</b>. Di bawah minimum {rendah.min} di satu bagian = <b>gak lulus</b>, walau total cukup.</div>
      )}
      <div className="warnbox">Satu bagian di bawah minimum = <b>gak lulus</b>, walau totalnya cukup.</div>
      <p className="note" style={{ marginTop: 12 }}>Perkiraan, bukan skor resmi. Dihitung ulang tiap kamu jawab soal.</p>
    </section></div>
  );
}

/** Versi mini di sidebar Beranda (§11). */
export function PerkiraanMini({ sesi, level, hariIni }: { sesi: SesiSkor[]; level: string; hariIni: string }) {
  const p = useMemo(() => hitungPerkiraan(sesi, level, hariIni), [sesi, level, hariIni]);
  return (
    <div className="rbk"><div className="card kme">
      <div className="mcal-h"><b>Perkiraan skor</b><Link href="/progres?tab=perkiraan">Detail →</Link></div>
      {p.siap ? (
        <>
          <div className="kme-n"><b>{p.total}</b><span>/ {p.maks} · lulus {p.lulus}</span></div>
          {p.bagian.map(b => (
            <div className="kme-r" key={b.k}>
              <span lang="ja">{b.k}</span>
              <div className="mn-b"><em style={{ width: `${(b.nilai / b.max) * 100}%`, background: b.aman ? WARNA[b.k] : "var(--danger)" }} /><i style={{ left: `${(b.min / b.max) * 100}%` }} /></div>
              <b>{b.nilai}</b>
            </div>
          ))}
          <p className="mcal-f">Perkiraan dari {p.jawaban} jawaban · bukan skor resmi</p>
        </>
      ) : (
        <div className="estf">
          <p className="note">Butuh ±{ATURAN.perkiraan.minTotal} jawaban biar bisa dihitung.</p>
          <div className="few-b"><i style={{ width: `${Math.min(100, (p.jawaban / ATURAN.perkiraan.minTotal) * 100)}%` }} /></div>
          <div className="note">{p.jawaban} / {ATURAN.perkiraan.minTotal} jawaban</div>
        </div>
      )}
    </div>
    {/* Pertama kali perkiraan berubah dari "butuh jawaban" ke angka (HANDOFF-alur-belajar §4). */}
    <KartuKenalan id="perkiraan" live={p.siap} />
    </div>
  );
}
