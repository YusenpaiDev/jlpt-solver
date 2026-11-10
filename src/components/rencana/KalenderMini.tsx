"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-belajar.css";
import Link from "next/link";
import { jamMenit, ringkasWaktu, selBulan, tingkatMenit } from "@/lib/waktu-kalender";
import { useWaktuBelajar } from "@/lib/use-waktu-belajar";
import { useCapBaru } from "@/lib/use-cap-baru";
import { BLN } from "./WaktuBelajar";

const BLS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Cap belajar bulan ini, versi kecil di sidebar Beranda. */
export function KalenderMini() {
  const { siap, hari, hariIni } = useWaktuBelajar();
  const y = Number(hariIni.slice(0, 4)), mo = Number(hariIni.slice(5, 7)) - 1;
  const { kosongDepan, jumlahHari } = selBulan(y, mo);
  const rekor = ringkasWaktu(hari, hariIni).rekor?.tanggal;
  /* Animasi "ngecap" pas cap hari ini baru muncul / naik tingkat. */
  const hIni = hari.get(hariIni), mIni = hIni?.menit ?? 0;
  const putar = useCapBaru(siap, hariIni, mIni > 0 || hIni?.aktif ? Math.max(1, tingkatMenit(mIni)) : 0);

  let aktif = 0, menit = 0;
  const sel = [];
  for (let d = 1; d <= jumlahHari; d++) {
    const k = `${hariIni.slice(0, 8)}${String(d).padStart(2, "0")}`;
    const h = hari.get(k);
    const m = h?.menit ?? 0;
    const ada = m > 0 || Boolean(h?.aktif);
    if (ada) { aktif++; menit += m; }
    /* Sama kayak kalender Progres: cap 学, ukurannya ngikut menit, hari rekor cap emas 極. */
    const ngecap = k === hariIni && putar > 0;
    sel.push(
      <i key={ngecap ? `${k}-${putar}` : k} className={`mg${k > hariIni ? " fut" : ""}${k === hariIni ? " td" : ""}${ngecap ? " ngecap" : ""}`} title={`${d} ${BLS[mo]} · ${m} menit`}>
        {ada && <span className={`stamp t${Math.max(1, tingkatMenit(m))}${k === rekor ? " gold" : ""}${ngecap ? " ngecap" : ""}`} style={ngecap ? undefined : { animationDelay: `${d * 12}ms` }}>{k === rekor ? "極" : "学"}</span>}
      </i>,
    );
  }

  return (
    <div className="rbk">
      <div className="card mcal">
        <div className="mcal-h"><b>Cap belajar · {BLN[mo]}</b><Link href="/progres?tab=waktu">Kalender →</Link></div>
        <div className="mgrid" aria-hidden="true">
          {Array.from({ length: kosongDepan }, (_, i) => <i className="mg emp" key={`k${i}`} />)}
          {sel}
        </div>
        <div className="mcal-f">{siap ? `${aktif} hari belajar · ${jamMenit(menit)} bulan ini` : "memuat…"}</div>
      </div>
    </div>
  );
}
