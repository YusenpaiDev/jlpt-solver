"use client";

import "@/styles/pembayaran.css";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { BATAS, KOSAKATA_FREE, NAMA_FITUR, type Fitur } from "@/lib/batas-paket";
import { PAKET, rupiah } from "@/lib/paket";
import { sisaWaktuReset, type KuotaHabis } from "@/lib/kuota-habis";
import { useTandaHarian } from "@/lib/tanda-harian";
import { Meter } from "./Meter";
import { HonixPy } from "./HonixPy";

/**
 * Jatah harian habis — dua bentuk, per konteks (HANDOFF-pembayaran §5):
 *   · <JatahHabisInline> di chat: bagian dari alur percakapan, jawaban
 *     sebelumnya tetap terbaca. JANGAN modal di sini.
 *   · <JatahHabisDialog> buat aksi bertombol (furigana): lembar bawah di HP,
 *     modal tengah di desktop (beda bentuk murni dari CSS).
 *
 * Tombol tolak ("Tunggu besok") sejajar besarnya sama tombol bayar — bukan ×
 * kecil di pojok. Kalau yang kena 429 udah Pro, gak ada tawaran upgrade.
 *
 * Hōnix tidur di kiri judul, tanpa animasi (HANDOFF-pembayaran "Maskot").
 * Dialog muncul SEKALI per fitur per hari (HANDOFF-honix §4) — 429
 * berikutnya di hari yang sama cukup pil kecil.
 */

const GRATIS_TETAP =
  "Bank soal ujian, latihan dengar, dan materi tetap terbuka gratis.";

function MeterBanding({ k, berdampingan }: { k: KuotaHabis; berdampingan?: boolean }) {
  const nama = NAMA_FITUR[k.feature];
  const pro = BATAS[k.feature].pro;
  const isi = (
    <>
      <Meter label={`${nama} hari ini`} nilai={`${k.used} / ${k.limit}`} persen={100}
        isi="py-f-full" warnaNilai="var(--py-bad)" />
      <Meter label="Dengan Pro" nilai={`${pro} / hari`} persen={100} isi="py-f-acc"
        warnaNilai="var(--py-ok)"
        legend={[
          { warna: "var(--py-bad)", teks: `Free ${k.limit}` },
          { warna: "var(--py-accent)", teks: `Pro ${pro}` },
        ]} />
    </>
  );
  return berdampingan ? <div className="py-nrow">{isi}</div> : <div style={{ marginTop: 14 }}>{isi}</div>;
}

function BarisLain({ fitur }: { fitur: Fitur }) {
  const lain = (["chat", "furigana"] as Fitur[]).filter(f => f !== fitur);
  return (
    <>
      {lain.map(f => (
        <div key={f} className="py-kv">
          <span className="py-kv-k">{NAMA_FITUR[f]}</span>
          <span className="py-kv-v">{BATAS[f].free} → <b className="up">{BATAS[f].pro}</b> / hari</span>
        </div>
      ))}
      <div className="py-kv">
        <span className="py-kv-k">Kosakata</span>
        <span className="py-kv-v">{KOSAKATA_FREE} → <b className="up">tanpa batas</b></span>
      </div>
    </>
  );
}

export function JatahHabisInline({ kuota, onTunggu, sempit = false }: {
  kuota: KuotaHabis;
  /** Tolak — pemanggil yang mutusin (biasanya ngeringkas catatan ini). */
  onTunggu?: () => void;
  /** Panel samping yang sempit: meter tetap ditumpuk walau di desktop. */
  sempit?: boolean;
}) {
  const nama = NAMA_FITUR[kuota.feature];
  if (kuota.plan === "pro") {
    return (
      <div className="py py-notice" role="status">
        <div className="py-stat py-s-warn"><span className="py-d warn" />BATAS HARIAN TERCAPAI</div>
        <p className="py-notice-s">{kuota.message} Reset besok <b>00:00 WIB</b> — sekitar {sisaWaktuReset(kuota.resetAt)}.</p>
      </div>
    );
  }
  return (
    <div className="py py-notice" role="status">
      <div className="py-hx-row">
        <HonixPy pose="tidur" hp={56} desktop={64} diam />
        <div>
          <div className="py-stat py-s-warn"><span className="py-d warn" />JATAH HARI INI HABIS</div>
          <div className="py-notice-t" style={{ marginTop: 7 }}>{nama} sudah {kuota.used} dari {kuota.limit} hari ini</div>
        </div>
      </div>
      <p className="py-notice-s">
        Reset besok <b>00:00 WIB</b> — sekitar {sisaWaktuReset(kuota.resetAt)}. Bank soal ujian, latihan dengar, dan materi <b>tetap terbuka</b>.
      </p>
      <MeterBanding k={kuota} berdampingan={!sempit} />
      <div className="py-notice-a">
        <Link href="/premium" className="py-btn py-btn-p">Lihat Pro</Link>
        <button type="button" className="py-btn py-btn-q" onClick={onTunggu}>Tunggu besok</button>
      </div>
    </div>
  );
}

/* Pemanggil ngirim onClose sebagai arrow baru tiap render. Disimpan di ref
   biar efek fokus / timer gak ke-reset tiap parent render. */
function useCallbackTerbaru(f: () => void) {
  const ref = useRef(f);
  useEffect(() => { ref.current = f; });
  return ref;
}

export function JatahHabisDialog({ kuota, onClose }: { kuota: KuotaHabis | null; onClose: () => void }) {
  const { ids: sudahHariIni, tandai } = useTandaHarian("honix-jatah-v1");
  if (!kuota) return null;
  return sudahHariIni.includes(kuota.feature)
    ? <JatahHabisPil key={kuota.feature} kuota={kuota} onClose={onClose} />
    : <JatahHabisSheet key={kuota.feature} kuota={kuota}
        onClose={() => { tandai(kuota.feature); onClose(); }} />;
}

function JatahHabisSheet({ kuota, onClose }: { kuota: KuotaHabis; onClose: () => void }) {
  const tolakRef = useRef<HTMLButtonElement>(null);
  const tutupRef = useCallbackTerbaru(onClose);

  useEffect(() => {
    const pemicu = document.activeElement as HTMLElement | null;
    tolakRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") tutupRef.current(); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); pemicu?.focus?.(); };
  }, [tutupRef]);

  const nama = NAMA_FITUR[kuota.feature];
  const pro = kuota.plan === "pro";

  return (
    <div className="py py-mask" onClick={onClose}>
      <div className="py-sheet" role="dialog" aria-modal="true" aria-labelledby="py-jh-judul"
        onClick={e => e.stopPropagation()}>
        <div className="py-grip" />
        <div className="py-hx-row">
          <HonixPy pose="tidur" hp={64} desktop={76} diam />
          <div>
            <div className="py-stat py-s-warn"><span className="py-d warn" />
              {pro ? "BATAS HARIAN TERCAPAI" : "JATAH HARI INI HABIS"}
            </div>
            <h3 id="py-jh-judul" className="py-h3" style={{ marginTop: 9 }}>
              {nama} sudah {kuota.used} dari {kuota.limit}
            </h3>
            <p className="py-lead" style={{ marginTop: 4 }}>Reset besok <b>00:00 WIB</b> — sekitar {sisaWaktuReset(kuota.resetAt)}.</p>
          </div>
        </div>

        {pro ? (
          <>
            <p className="py-foot">{kuota.message}</p>
            <div className="py-acts">
              <button ref={tolakRef} type="button" className="py-btn py-btn-q" onClick={onClose}>Oke</button>
            </div>
          </>
        ) : (
          <>
            <hr className="py-hr tight" />
            <MeterBanding k={kuota} />
            <hr className="py-hr tight" />
            <BarisLain fitur={kuota.feature} />
            <div className="py-acts">
              <Link href="/premium" className="py-btn py-btn-p">
                Pro · {rupiah(PAKET["pro-bulanan"].harga)}/bln
              </Link>
              <button ref={tolakRef} type="button" className="py-btn py-btn-q" onClick={onClose}>Tunggu besok</button>
            </div>
            <p className="py-foot">
              Paket Ujian 6 bulan ≈ <b>{rupiah(Math.round(PAKET["pro-ujian"].harga / 6))}/bulan</b>. Bayar sekali per periode, <b>tidak menagih otomatis</b>. {GRATIS_TETAP}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Versi kecil — 429 kedua dst. di hari yang sama (mock 5a ".comp").
 *  Gak modal, gak ngambil fokus, hilang sendiri 4 detik. */
function JatahHabisPil({ kuota, onClose }: { kuota: KuotaHabis; onClose: () => void }) {
  const tutupRef = useCallbackTerbaru(onClose);
  useEffect(() => {
    const t = setTimeout(() => tutupRef.current(), 4000);
    return () => clearTimeout(t);
  }, [tutupRef]);
  return (
    <div className="py py-comp-wrap" role="status">
      <button type="button" className="py-comp" onClick={onClose}>
        {NAMA_FITUR[kuota.feature]} habis — reset {sisaWaktuReset(kuota.resetAt)}
        <span className="s" aria-hidden="true">×</span>
      </button>
    </div>
  );
}
