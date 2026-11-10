"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-belajar.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  jamMenit, rentangBulan, ringkasWaktu, selBulan, tingkatMenit,
} from "@/lib/waktu-kalender";
import type { WaktuBelajar as DataWaktu } from "@/lib/use-waktu-belajar";

export const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BLS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MINGGU = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const URUT_BAGIAN = ["文字", "語彙", "文法", "読解", "聴解"];
const BAGIAN_SUMBER: Record<string, string> = { kotoba: "語彙", bunpou: "文法", choukai: "聴解" };
const NAMA_SUMBER: Record<string, string> = { soal: "Bank Soal", choukai: "Choukai", kotoba: "Kotoba", bunpou: "Bunpou" };

const tgl = (t: string) => new Date(`${t}T00:00`);
const kunci = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Total waktu + kalender cap + detail hari (mockup Rencana Belajar §10). */
export function WaktuBelajar({ waktu, streak, streakTerpanjang, rekapSesi }: {
  waktu: DataWaktu;
  streak: number;
  streakTerpanjang: number;
  /** Soal dijawab + bagian per tanggal lokal. */
  rekapSesi: Map<string, { soal: number; bagian: string[] }>;
}) {
  const { hari, hariIni, pace } = waktu;
  const ring = useMemo(() => ringkasWaktu(hari, hariIni), [hari, hariIni]);
  const rentang = useMemo(() => rentangBulan(hari, hariIni), [hari, hariIni]);
  const awalData = useMemo(() => [...hari.keys()].sort()[0] ?? hariIni, [hari, hariIni]);
  const [bulan, setBulan] = useState<[number, number]>(rentang.akhir);
  const [pilih, setPilih] = useState(hariIni);

  const [y, mo] = bulan;
  const { kosongDepan, jumlahHari } = selBulan(y, mo);
  const keNomor = ([a, b]: [number, number]) => a * 12 + b;
  const bisaMundur = keNomor(bulan) > keNomor(rentang.awal);
  const bisaMaju = keNomor(bulan) < keNomor(rentang.akhir);
  const geser = (n: number) => { const t = keNomor(bulan) + n; setBulan([Math.floor(t / 12), t % 12]); };

  let hariBulan = 0, menitBulan = 0;
  const sel = [];
  for (let d = 1; d <= jumlahHari; d++) {
    const k = kunci(y, mo, d);
    const h = hari.get(k);
    const m = h?.menit ?? 0;
    const ada = m > 0 || Boolean(h?.aktif);
    if (ada) { hariBulan++; menitBulan += m; }
    const nonaktif = k > hariIni || k < awalData;
    const rek = ring.rekor?.tanggal === k;
    sel.push(
      <button key={k} type="button" className={`cd${k === pilih ? " sel" : ""}${k === hariIni ? " td" : ""}`}
        disabled={nonaktif} onClick={() => setPilih(k)}
        aria-label={`${d} ${BLN[mo]}, ${h?.aktif && !m ? "ada latihan, menit belum tercatat" : `${m} menit`}`}
        aria-pressed={k === pilih}>
        <span className="cd-n">{d}</span>
        {ada && <span className={`stamp t${Math.max(1, tingkatMenit(m))}${rek ? " gold" : ""}`} style={{ animationDelay: `${d * 12}ms` }} aria-hidden="true">{rek ? "極" : "学"}</span>}
      </button>,
    );
  }

  const h = hari.get(pilih);
  const sesi = rekapSesi.get(pilih);
  const m = h?.menit ?? 0;
  const adaLatihan = m > 0 || Boolean(h?.aktif) || Boolean(sesi);
  const bagian = URUT_BAGIAN.filter(b => sesi?.bagian.includes(b) || h?.sumber.some(s => BAGIAN_SUMBER[s] === b));
  const lewat = (h?.sumber ?? []).map(s => NAMA_SUMBER[s]).filter(Boolean);
  const dt = tgl(pilih);
  const rekorDt = ring.rekor ? tgl(ring.rekor.tanggal) : null;

  return (
    <div className="rbk rbk-waktu">
      <div className="wk-h"><div className="h2">Waktu belajar<span className="jp-g" lang="ja">時間</span></div><Link className="btn btn-g" href="/progres/pamer">Pamerin ↗</Link></div>

      <section className="card tw">
        <div>
          <div className="eyebrow">Total waktu belajar</div>
          <div className="tw-big"><b>{Math.floor(ring.totalMenit / 60)}</b><span>jam{ring.totalMenit % 60 ? ` ${ring.totalMenit % 60} menit` : ""}</span></div>
          <p className="tw-s">{ring.sejak
            ? <>Sejak {(d => `${d.getDate()} ${BLS[d.getMonth()]} ${d.getFullYear()}`)(tgl(ring.sejak))} · {ring.hariBelajar} hari belajar</>
            : "Menit belajar mulai dicatat begitu kamu latihan."}</p>
        </div>
        <div className="tw-g">
          <div className="tws"><span>Hari ini</span><b>{ring.hariIni} mnt</b><small>target {pace} menit</small></div>
          <div className="tws"><span>7 hari terakhir</span><b>{jamMenit(ring.tujuhHari)}</b><small>{ring.rataTujuhHari} menit/hari</small></div>
          <div className="tws rec"><span>Rekor hari terlama</span><b>{ring.rekor ? jamMenit(ring.rekor.menit) : "—"}</b><small>{rekorDt ? `${HARI[rekorDt.getDay()]}, ${rekorDt.getDate()} ${BLS[rekorDt.getMonth()]}` : "belum ada"}</small></div>
          <div className="tws"><span>Streak</span><b>{streak} hari</b><small>terpanjang {streakTerpanjang} hari</small></div>
        </div>
      </section>

      <div className="pg">
        <section className="card cal" aria-label="Kalender cap belajar">
          <div className="cal-h">
            <div className="cal-nav">
              <button type="button" onClick={() => geser(-1)} disabled={!bisaMundur} aria-label="Bulan sebelumnya">‹</button>
              <b>{BLN[mo]} {y}</b>
              <button type="button" onClick={() => geser(1)} disabled={!bisaMaju} aria-label="Bulan berikutnya">›</button>
            </div>
            <div className="cal-sum"><b>{hariBulan} hari</b> · {jamMenit(menitBulan)}</div>
          </div>
          <div className="cg">
            {MINGGU.map(w => <div className="cw" key={w}>{w}</div>)}
            {Array.from({ length: kosongDepan }, (_, i) => <div className="cd emp" key={`k${i}`} />)}
            {sel}
          </div>
          <div className="leg">
            <span><i className="stamp t1" />&lt; 10 mnt</span><span><i className="stamp t2" />10–19</span>
            <span><i className="stamp t3" />20–39</span><span><i className="stamp t4" />40+</span>
            <span><i className="stamp t4 gold" />Rekor</span>
          </div>
        </section>

        <aside className="card dd" key={pilih} aria-live="polite">
          <div className="dd-d">{HARI[dt.getDay()]}, {dt.getDate()} {BLN[dt.getMonth()]}</div>
          {adaLatihan ? (
            <>
              {m > 0
                ? <div className="dd-m">{m}<span>menit belajar</span></div>
                : <div className="dd-m">—<span>menit belum tercatat</span></div>}
              {ring.rekor?.tanggal === pilih && <span className="chip sec" style={{ ["--c" as string]: "var(--warning)", marginTop: 10 }}>Rekor hari terlama</span>}
              <ul className="dd-l">
                <li>Soal dijawab<b>{sesi?.soal ?? 0}</b></li>
                <li>Latihan lewat<b>{lewat.length ? lewat.join(" · ") : "—"}</b></li>
                <li>Target harian<b className={m >= pace ? "ok-t" : ""}>{m >= pace ? "✓ Tercapai" : `${m} / ${pace} menit`}</b></li>
              </ul>
              {bagian.length > 0 && <div className="dd-tags">{bagian.map(b => <span className="chip" lang="ja" key={b}>{b}</span>)}</div>}
            </>
          ) : (
            <>
              <div className="dd-m">0<span>menit</span></div>
              <p className="dd-e">Gak ada belajar hari ini. Gak apa-apa, yang penting besoknya lanjut.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
