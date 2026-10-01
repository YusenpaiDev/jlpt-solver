"use client";

import "@/styles/pembayaran.css";
import { useState } from "react";
import Link from "next/link";
import { useLangganan, sisaHari, sudahDitutup, tutupPeringatan, tglPanjang } from "@/lib/langganan";

/**
 * Peringatan Pro mau habis — Beranda & /langganan (HANDOFF-pembayaran §3).
 *
 * Sepasang hairline + bar hari terpakai, bukan kartu berwarna. Muncul di sisa
 * ≤ 7 hari; ditutup → diem sampai H-3, lalu H-1. Mati total kalau user
 * matiin pengingat di /langganan/berhenti.
 *
 * `totalHari` dipakai buat bar; tanpa itu dianggap periode 30 hari.
 */
export function PengingatPro({ totalHari = 30, panjang = false, onPerpanjang }: {
  totalHari?: number;
  /** Versi /langganan: kalimat bawa tanggal berakhir. */
  panjang?: boolean;
  /** Ada → tombolnya langsung buka pembayaran, bukan pindah ke /langganan. */
  onPerpanjang?: () => void;
}) {
  const l = useLangganan();
  const [baruDitutup, setBaruDitutup] = useState(false);
  const sisa = sisaHari(l.premiumUntil);
  /* localStorage dibaca waktu render, tapi baru kejadian setelah l.loaded —
     dan itu cuma bisa true di browser, jadi render server tetap null. */
  const tutup = baruDitutup || (l.loaded && sisa != null && sudahDitutup(sisa));

  if (!l.loaded || l.isLifetime || !l.pengingat || sisa == null || sisa <= 0 || sisa > 7 || tutup) {
    return null;
  }

  const terpakai = Math.max(0, Math.min(100, ((totalHari - sisa) / totalHari) * 100));
  const tutupSekarang = () => { tutupPeringatan(sisa); setBaruDitutup(true); };

  return (
    <div className="py">
      <div className="py-warn" role="status">
        <div>
          <div className="py-warn-t">
            {sisa === 1 ? "Pro kamu habis besok" : `Pro kamu habis ${sisa} hari lagi`}
          </div>
          <div className="py-warn-s">
            {panjang
              ? <>Perpanjang sebelum {tglPanjang(l.premiumUntil!)} — sisa hari ikut ditambahkan, tidak hangus.</>
              : <>Sisa hari ikut ditambahkan kalau diperpanjang — tidak hangus.</>}
          </div>
          <div className="py-wbar"><i style={{ width: `${terpakai}%` }} /></div>
        </div>
        {onPerpanjang
          ? <button type="button" className="py-btn py-btn-q py-warn-cta" onClick={onPerpanjang}>Perpanjang</button>
          : <Link href="/langganan" className="py-btn py-btn-q py-warn-cta">Perpanjang sekarang</Link>}
        <button type="button" className="py-warn-x" onClick={tutupSekarang} aria-label="Tutup pengingat">×</button>
      </div>
      {onPerpanjang
        ? <button type="button" className="py-btn-t left py-warn-a" onClick={onPerpanjang}>Perpanjang sekarang ›</button>
        : <Link href="/langganan" className="py-warn-a">Perpanjang sekarang ›</Link>}
    </div>
  );
}
