"use client";

import "@/styles/pembayaran.css";
import Link from "next/link";
import { Meter } from "./Meter";
import { HonixPy } from "./HonixPy";
import { BATAS } from "@/lib/batas-paket";
import { rupiah } from "@/lib/paket";
import { namaPendek, durasiPaket, tglPanjang, tglPendek, jam } from "@/lib/langganan";

const SUPPORT = "yusufnashirsyarifuddin@gmail.com";

export interface Status {
  order_id: string;
  paket_id: string;
  jumlah: number;
  status: "pending" | "aktif" | "gagal" | "kadaluarsa" | "refund";
  dibuat: string;
  premium_until: string | null;
  is_lifetime: boolean;
}

/* ── 1a CEK ── */
export function Cek({ data, orderId }: { data: Status | null; orderId: string | null }) {
  const oid = data?.order_id ?? orderId;
  return (
    <>
      <HonixPy pose="tunggu" hp={104} desktop={112} className="py-hx-solo" />
      <div className="py-stat py-s-go"><span className="py-d go" />MEMERIKSA</div>
      <h2 className="py-h2" style={{ marginTop: 14 }}>Sebentar, kami pastikan pembayaranmu sampai</h2>
      <p className="py-lead">
        Jangan tutup halaman ini dulu. Biasanya beberapa detik. Kalau kamu pakai transfer bank atau virtual account, bisa lebih lama.
      </p>
      <hr className="py-hr" />
      <div className="py-step"><span className="mk ok">✓</span>
        <span>Pesanan dibuat{oid && <em>{oid}{data ? ` · ${namaPendek(data.paket_id)}` : ""}</em>}</span>
      </div>
      <div className="py-step"><span className="mk ok">✓</span><span>Pembayaranmu terkirim</span></div>
      <div className="py-step"><span className="py-spin" aria-hidden />
        <span>Menunggu konfirmasi bank<em>Status ditanya tiap 3 detik</em></span>
      </div>
      <div className="py-step wait"><span className="mk wait">—</span><span>Pro dinyalakan</span></div>
      <p className="py-foot">Halaman ini menyegarkan sendiri. <b>Tidak perlu bayar ulang.</b></p>
    </>
  );
}

/* ── 1b AKTIF — satu-satunya layar bersegel ── */
export function Aktif({ data }: { data: Status }) {
  const lifetime = data.paket_id === "lifetime" || data.is_lifetime;
  return (
    <>
      <div className="py-hx-wrap">
        <HonixPy pose="senang" hp={132} desktop={150} />
        <div className="py-seal" aria-hidden>極</div>
      </div>
      <div className="py-stat py-s-ok center" style={{ marginTop: 14 }}><span className="py-d ok" />PRO AKTIF</div>
      <h2 className="py-h2 py-center" style={{ marginTop: 12 }}>Akunmu sudah terbuka</h2>
      <p className="py-lead py-center">
        {lifetime
          ? <>Lifetime — <b>berlaku selamanya</b>.</>
          : <>{namaPendek(data.paket_id)}, berlaku sampai <b>{data.premium_until ? tglPanjang(data.premium_until) : "—"}</b>.</>}
      </p>
      <hr className="py-hr" />
      <div className="py-eyebrow">Batasmu naik mulai sekarang</div>
      <Meter label="Chat AI" persen={100} isi="py-f-acc"
        nilai={<>{BATAS.chat.pro} / hari<span className="py-gain">+{BATAS.chat.pro - BATAS.chat.free}</span></>}
        legend={[
          { warna: "var(--surface-3)", teks: `Free ${BATAS.chat.free}` },
          { warna: "var(--py-accent)", teks: `Pro ${BATAS.chat.pro}` },
        ]} />
      <Meter label="Furigana" persen={100} isi="py-f-acc"
        nilai={<>{BATAS.furigana.pro} / hari<span className="py-gain">+{BATAS.furigana.pro - BATAS.furigana.free}</span></>} />
      <Meter label="Kosakata disimpan" persen={100} isi="py-f-ok"
        nilai={`Tanpa batas`} warnaNilai="var(--py-ok)" />
      <hr className="py-hr" />
      <div className="py-kv"><span className="py-kv-k">Dibayar</span><span className="py-kv-v">{rupiah(data.jumlah)}</span></div>
      <div className="py-kv"><span className="py-kv-k">Nomor pesanan</span><span className="py-kv-v mono">{data.order_id}</span></div>
      <div className="py-acts">
        <Link href="/" className="py-btn py-btn-p grow">Mulai belajar</Link>
        <Link href="/langganan" className="py-btn py-btn-q">Status langganan</Link>
      </div>
      <p className="py-foot">
        Di mutasi rekeningmu transaksi ini tercatat sebagai <b>WILDbyZ</b>, bukan Sensei JLPT. Itu nama merchant pembayaran kami.
      </p>
    </>
  );
}

/* ── 1c DIPROSES — mencegah bayar dua kali ── */
export function Diproses({ data, kini, orderId, berhenti, memeriksa, onPeriksa }: {
  data: Status | null; kini: number; orderId: string | null; berhenti: boolean; memeriksa: boolean; onPeriksa: () => void;
}) {
  /* Bar perkiraan: waktu sejak bayar terhadap 3 jam. Minimal 5% biar
     kelihatan ada yang jalan. */
  const sejak = data && kini ? kini - new Date(data.dibuat).getTime() : 0;
  const persen = Math.max(5, Math.min(95, (sejak / (3 * 3_600_000)) * 100));
  const oid = data?.order_id ?? orderId;

  return (
    <>
      {/* Pose baca, bukan senang — jangan kesan Pro udah aktif. */}
      <HonixPy pose="baca" hp={104} desktop={112} className="py-hx-solo" />
      <div className="py-stat py-s-warn"><span className="py-d warn" />MENUNGGU KONFIRMASI BANK</div>
      <h2 className="py-h2" style={{ marginTop: 14 }}>Pembayaranmu sudah kami terima</h2>
      <p className="py-lead">
        Tinggal menunggu konfirmasi dari bank. Untuk transfer dan virtual account ini <b>bisa sampai beberapa jam</b> — normal, dan uangmu aman.
      </p>
      <hr className="py-hr" />
      <Meter label="Perkiraan aktif" nilai="1–3 jam" warnaNilai="var(--py-warn)" persen={persen} isi="py-f-warn" />
      <div className="py-dline">
        <span>{data ? `bayar ${jam(data.dibuat)}` : ""}</span>
        <span>{berhenti ? "pengecekan otomatis berhenti" : "dicek ulang tiap 30 detik"}</span>
      </div>
      <hr className="py-hr" />
      <div className="py-as"><span className="c">✓</span><span><b>Jangan bayar lagi.</b> Pesanan ini sudah tercatat. Bayar dua kali bikin dananya harus dikembalikan manual, dan itu jauh lebih lama.</span></div>
      <div className="py-as"><span className="c">✓</span><span><b>Tidak perlu menunggu di sini.</b> Tutup saja dan lanjut belajar — Pro menyala sendiri begitu konfirmasi masuk.</span></div>
      <hr className="py-hr" />
      {data && (
        <>
          <div className="py-kv"><span className="py-kv-k">Paket</span>
            <span className="py-kv-v">{namaPendek(data.paket_id)}<em>{durasiPaket(data.paket_id)}</em></span></div>
          <div className="py-kv"><span className="py-kv-k">Jumlah</span><span className="py-kv-v">{rupiah(data.jumlah)}</span></div>
          <div className="py-kv"><span className="py-kv-k">Waktu bayar</span>
            <span className="py-kv-v">{tglPendek(data.dibuat)}, {jam(data.dibuat)}</span></div>
        </>
      )}
      {oid && <div className="py-kv"><span className="py-kv-k">Nomor pesanan</span><span className="py-kv-v mono">{oid}</span></div>}
      <div className="py-acts">
        <Link href="/" className="py-btn py-btn-q grow">Lanjut belajar dulu</Link>
        <button type="button" className="py-btn-t" onClick={onPeriksa} disabled={memeriksa}>
          {memeriksa ? "Memeriksa…" : "Periksa status sekarang"}
        </button>
      </div>
      <p className="py-foot">
        Lewat 6 jam belum aktif? Kirim nomor pesanan di atas ke <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> — kami nyalakan manual hari itu juga.
      </p>
    </>
  );
}

/* ── GAGAL — pola DIPROSES, warna --bad ── */
export function Gagal({ data }: { data: Status }) {
  const kadaluarsa = data.status === "kadaluarsa";
  return (
    <>
      <div className="py-stat py-s-bad"><span className="py-d bad" />
        {kadaluarsa ? "PEMBAYARAN KADALUARSA" : "PEMBAYARAN TIDAK BERHASIL"}
      </div>
      <h2 className="py-h2" style={{ marginTop: 14 }}>
        {kadaluarsa ? "Batas waktu pembayarannya lewat" : "Pembayaranmu tidak diteruskan bank"}
      </h2>
      <p className="py-lead">
        {kadaluarsa
          ? <>Pesanan ini ditutup karena pembayarannya tidak masuk sampai batas waktu. <b>Tidak ada dana yang ditarik.</b></>
          : <>Bank atau penyedia pembayaran menolak transaksi ini, jadi Pro <b>belum dinyalakan</b>. Coba lagi dengan metode lain.</>}
      </p>
      <hr className="py-hr" />
      <div className="py-kv"><span className="py-kv-k">Paket</span>
        <span className="py-kv-v">{namaPendek(data.paket_id)}<em>{durasiPaket(data.paket_id)}</em></span></div>
      <div className="py-kv"><span className="py-kv-k">Jumlah</span><span className="py-kv-v">{rupiah(data.jumlah)}</span></div>
      <div className="py-kv"><span className="py-kv-k">Nomor pesanan</span><span className="py-kv-v mono">{data.order_id}</span></div>
      <div className="py-acts">
        <Link href="/premium" className="py-btn py-btn-p grow">Coba bayar lagi</Link>
        <Link href="/" className="py-btn py-btn-q">Kembali ke Beranda</Link>
      </div>
      <p className="py-foot">
        Saldomu terlanjur terpotong? Kirim nomor pesanan di atas ke <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> — kami cek dan selesaikan.
      </p>
    </>
  );
}

export function Galat({ pesan }: { pesan: string | null }) {
  return (
    <>
      <div className="py-stat py-s-off"><span className="py-d off" />STATUS TIDAK DITEMUKAN</div>
      <h2 className="py-h2" style={{ marginTop: 14 }}>Kami belum menemukan pesananmu</h2>
      <p className="py-lead">
        {pesan ?? "Status pesanan tidak bisa dibaca."} Kalau kamu baru saja membayar, buka riwayat transaksi di halaman langganan.
      </p>
      <div className="py-acts">
        <Link href="/langganan" className="py-btn py-btn-q grow">Buka halaman langganan</Link>
      </div>
      <p className="py-foot">Butuh bantuan? <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a></p>
    </>
  );
}
