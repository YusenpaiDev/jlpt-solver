"use client";

import "@/styles/pembayaran.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuroraBackground } from "@/components/v2";
import { Cek, Aktif, Diproses, Gagal, Galat, type Status } from "@/components/pembayaran/StatusPembayaran";
import { useHonix } from "@/lib/use-honix";
import { putarHonix } from "@/lib/honix-sfx";

/**
 * Halaman balik dari Midtrans (HANDOFF-pembayaran §1).
 *
 * Yang nyalain Pro cuma webhook server — halaman ini NANYA statusnya, gak
 * pernah nganggep. Alurnya:
 *
 *   masuk → GET /api/payment/status tiap 3 detik            → CEK
 *   20 detik masih pending → polling turun jadi 30 detik    → DIPROSES
 *   10 menit di DIPROSES   → polling berhenti, tinggal tombol "Periksa"
 *   aktif                                                   → AKTIF
 *   gagal / kadaluarsa                                      → GAGAL
 *
 * DIPROSES itu layar paling penting: tujuannya mencegah orang bayar dua kali.
 * Makanya judulnya "sudah kami terima", warnanya --warn (bukan error), dan
 * gak ada tombol oranye — tombol oranye kebaca "bayar lagi".
 *
 * Tampil tanpa nav rail: di titik ini orangnya belum tentu udah punya akses.
 */

type Keadaan = "cek" | "aktif" | "diproses" | "gagal" | "galat";


const CEPAT = 3_000;
const LAMBAT = 30_000;
const BATAS_CEK = 20_000;
const BATAS_PROSES = 10 * 60_000;


export default function PremiumSukses() {
  const { kurangiGerak } = useHonix();
  const [keadaan, setKeadaan] = useState<Keadaan>("cek");
  const [data, setData] = useState<Status | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [berhenti, setBerhenti] = useState(false);
  const [memeriksa, setMemeriksa] = useState(false);
  /* Jam terakhir status ditanya — buat bar perkiraan. Disimpan di state,
     bukan Date.now() waktu render, biar render tetap murni. */
  const [kini, setKini] = useState(0);
  const orderId = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mulai = useRef(0);
  const masukProses = useRef<number | null>(null);

  useEffect(() => {
    if (keadaan === "gagal" || keadaan === "galat") return;
    const chirp = setTimeout(() => putarHonix("chirp"), 100);
    const chime = keadaan === "aktif" ? setTimeout(() => putarHonix("chime"), 600) : undefined;
    return () => { clearTimeout(chirp); clearTimeout(chime); };
  }, [keadaan]);

  /** Status, "fatal" (401/404 — percuma diulang), atau null (jaringan; ulangi). */
  const ambil = useCallback(async (): Promise<Status | "fatal" | null> => {
    const q = orderId.current ? `?order_id=${encodeURIComponent(orderId.current)}` : "";
    try {
      const res = await fetch(`/api/payment/status${q}`, { cache: "no-store" });
      const j = await res.json();
      if (res.status === 401 || res.status === 404) { setGalat(j.error ?? null); return "fatal"; }
      if (!res.ok) return null;
      setData(j);
      setKini(Date.now());
      return j as Status;
    } catch {
      return null;
    }
  }, []);

  const putaran = useCallback(async () => {
    const s = await ambil();
    if (s === "fatal") { setKeadaan("galat"); return; }
    if (s?.status === "aktif") { setKeadaan("aktif"); return; }
    if (s && s.status !== "pending") { setKeadaan("gagal"); return; }

    if (Date.now() - mulai.current < BATAS_CEK) {
      timer.current = setTimeout(putaran, CEPAT);
      return;
    }
    setKeadaan(k => (k === "cek" ? "diproses" : k));
    masukProses.current ??= Date.now();
    if (Date.now() - masukProses.current >= BATAS_PROSES) { setBerhenti(true); return; }
    timer.current = setTimeout(putaran, LAMBAT);
  }, [ambil]);

  useEffect(() => {
    /* Dibaca dari window, bukan useSearchParams(): hook itu maksa halaman
       dibungkus Suspense, dan nilainya cuma dibutuhin sekali di awal. */
    orderId.current = new URLSearchParams(window.location.search).get("order_id");
    mulai.current = Date.now();
    putaran();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [putaran]);

  const periksaSekarang = async () => {
    setMemeriksa(true);
    const s = await ambil();
    setMemeriksa(false);
    if (s === "fatal" || !s) return;
    if (s.status === "aktif") setKeadaan("aktif");
    else if (s.status !== "pending") setKeadaan("gagal");
  };

  return (
    <>
      <AuroraBackground />
      <main className={`py py-receipt-page${kurangiGerak ? " hx-rm" : ""}`}>
        <div className="py-receipt">
          <div className="py-top">
            <Link href="/" className="py-top-bk" aria-label="Kembali ke Beranda">‹</Link>Pembayaran
          </div>

          {keadaan === "cek" && <Cek data={data} orderId={orderId.current} />}
          {keadaan === "aktif" && data && <Aktif data={data} />}
          {keadaan === "diproses" && (
            <Diproses data={data} kini={kini} orderId={orderId.current} berhenti={berhenti}
              memeriksa={memeriksa} onPeriksa={periksaSekarang} />
          )}
          {keadaan === "gagal" && data && <Gagal data={data} />}
          {keadaan === "galat" && <Galat pesan={galat} />}
        </div>
      </main>
    </>
  );
}

