"use client";

import "@/styles/pembayaran.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Meter } from "@/components/pembayaran/Meter";
import { PengingatPro } from "@/components/pembayaran/PengingatPro";
import { useUserStats } from "@/lib/use-user-stats";
import { useBayar } from "@/lib/bayar";
import { BATAS, KOSAKATA_FREE, NAMA_FITUR, type Fitur } from "@/lib/batas-paket";
import { PAKET, rupiah } from "@/lib/paket";
import {
  useLangganan, sisaHari, hasilPerpanjang, isiMeter, namaPendek,
  tglPanjang, tglPendek, tglJam, LABEL_TX,
} from "@/lib/langganan";

/**
 * Status langganan (HANDOFF-pembayaran §2 + §4).
 *
 * Mobile satu kolom; desktop dua — kiri masa berlaku + pemakaian, kanan
 * riwayat transaksi. Lifetime: sisa hari, bar, dan tombol perpanjang dihapus
 * sama sekali — bar penuh tanpa ujung justru bikin ragu.
 */

interface Tx { order_id: string; paket_id: string; jumlah: number; status: string; dibuat: string; diperbarui: string }

const PER_HALAMAN = 6;
const FITUR_METER: Fitur[] = ["chat", "furigana"];

export default function Langganan() {
  const stats = useUserStats();
  const l = useLangganan();
  const { bayar, paying, galat } = useBayar();

  const [tx, setTx] = useState<Tx[]>([]);
  const [txMuat, setTxMuat] = useState(true);
  const [adaLagi, setAdaLagi] = useState(false);
  const [pakai, setPakai] = useState<Partial<Record<Fitur, number>>>({});
  const [kosakata, setKosakata] = useState<number | null>(null);

  /* +1 baris dari jatah halaman, buat tau masih ada yang lebih lama. */
  const ambilTx = async (dari: number) => {
    const { data } = await createClient()
      .from("transaksi")
      .select("order_id, paket_id, jumlah, status, dibuat, diperbarui")
      .order("dibuat", { ascending: false })
      .range(dari, dari + PER_HALAMAN);
    return (data ?? []) as Tx[];
  };
  const pasangTx = (baris: Tx[], tambah: boolean) => {
    setAdaLagi(baris.length > PER_HALAMAN);
    setTx(x => [...(tambah ? x : []), ...baris.slice(0, PER_HALAMAN)]);
    setTxMuat(false);
  };

  useEffect(() => {
    let batal = false;
    (async () => {
      const baris = await ambilTx(0);
      if (!batal) pasangTx(baris, false);
    })();
    return () => { batal = true; };
  }, []);

  /* Pemakaian hari ini — sisa_kuota() cuma baca, gak ngabisin jatah. */
  useEffect(() => {
    if (!l.loaded) return;
    let batal = false;
    (async () => {
      const sb = createClient();
      const hasil = await Promise.all(FITUR_METER.map(f =>
        sb.rpc("sisa_kuota", { p_fitur: f, p_batas: l.isPro ? BATAS[f].pro : BATAS[f].free })));
      const { data: n } = await sb.rpc("jumlah_kotoba_saya");
      if (batal) return;
      const p: Partial<Record<Fitur, number>> = {};
      hasil.forEach(({ data }, i) => {
        const b = Array.isArray(data) ? data[0] : data;
        p[FITUR_METER[i]] = Number(b?.terpakai) || 0;
      });
      setPakai(p);
      setKosakata(typeof n === "number" ? n : null);
    })();
    return () => { batal = true; };
  }, [l.loaded, l.isPro]);

  const sisa = sisaHari(l.premiumUntil);
  const berjangka = l.isPro && !l.isLifetime && sisa != null && sisa > 0;
  const segeraHabis = berjangka && sisa! <= 7;

  /* Awal periode = pembayaran lunas terakhir yang bukan Lifetime. Kalau gak
     ketemu (mis. Pro dikasih manual), bar dianggap periode 30 hari. */
  const lunasTerakhir = tx.find(t => t.status === "lunas" && t.paket_id !== "lifetime");
  const awal = lunasTerakhir ? new Date(lunasTerakhir.diperbarui) : null;
  const totalHari = awal && l.premiumUntil
    ? Math.max(1, Math.round((new Date(l.premiumUntil).getTime() - awal.getTime()) / 86_400_000))
    : 30;
  const terpakaiHari = Math.max(0, totalHari - (sisa ?? 0));

  const ujian = PAKET["pro-ujian"];
  const bulanan = PAKET["pro-bulanan"];
  const sampaiUjian = hasilPerpanjang(berjangka ? l.premiumUntil : null, ujian.bulan);

  const lifetimeTx = tx.find(t => t.paket_id === "lifetime" && t.status === "lunas");

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />

      <main className="app-shell">
        <UserBar streakDays={stats.streak} xp={stats.xp} xpTarget={stats.xpTarget}
          avatarLetter={stats.initial} isPro={stats.isPro} />

        <div className="py">
          <Breadcrumb items={[{ label: "Pengaturan", href: "/pengaturan" }, { label: "Langganan" }]} />
          <div className="py-hd" style={{ marginTop: 10 }}>
            <div>
              <h1>Langganan <span className="jp">会員</span></h1>
              <p className="sub">Masa berlaku, pemakaian harian, dan riwayat pembayaranmu.</p>
            </div>
            {berjangka && (
              <button type="button" className="py-btn py-btn-p py-hd-cta"
                disabled={paying != null} onClick={() => bayar("pro-bulanan")}>
                {paying === "pro-bulanan" ? "Membuka pembayaran…" : "Perpanjang sekarang"}
              </button>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <PengingatPro panjang totalHari={totalHari} onPerpanjang={() => bayar("pro-bulanan")} />
          </div>

          {!l.loaded ? (
            <p className="py-kosong">Memuat…</p>
          ) : (
            <div className="py-cols">
              {/* ── kiri: status + pemakaian ── */}
              <section>
                {l.isLifetime ? (
                  <>
                    <div className="py-lt-head">
                      <div className="py-seal gold" aria-hidden>永</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="py-stat py-s-ok"><span className="py-d ok" />BERLAKU SELAMANYA</div>
                        <div className="py-lt-name">Sensei JLPT Lifetime</div>
                      </div>
                    </div>
                    <p className="py-lead">
                      Tidak ada tanggal berakhir dan tidak ada tagihan berulang. Jatah harianmu tetap di tingkat Pro selamanya.
                    </p>
                  </>
                ) : berjangka ? (
                  <>
                    <div className={`py-stat ${segeraHabis ? "py-s-warn" : "py-s-ok"}`}>
                      <span className={`py-d ${segeraHabis ? "warn" : "ok"}`} />
                      {segeraHabis ? "SEGERA HABIS" : "AKTIF"}
                    </div>
                    <p className="py-remain">
                      <span className="n">{sisa} hari</span> lagi
                      <em>Pro{lunasTerakhir ? ` — ${namaPendek(lunasTerakhir.paket_id).replace(/^Pro — /, "")}` : ""} · berakhir {tglJam(l.premiumUntil!)}</em>
                    </p>
                    <div className="py-ring">
                      <i className={segeraHabis ? "py-f-warn" : "py-f-ok"}
                        style={{ width: `${Math.min(100, (terpakaiHari / totalHari) * 100)}%` }} />
                    </div>
                    <div className="py-dline">
                      <span>{awal ? `mulai ${tglPendek(awal)}` : ""}</span>
                      <span>{terpakaiHari} / {totalHari} hari</span>
                    </div>
                  </>
                ) : l.isPro ? (
                  <>
                    <div className="py-stat py-s-ok"><span className="py-d ok" />AKTIF</div>
                    <p className="py-lead">Akses Pro di akunmu diberikan langsung, tanpa tanggal berakhir.</p>
                  </>
                ) : (
                  <>
                    <div className="py-stat py-s-off"><span className="py-d off" />TIDAK AKTIF</div>
                    <p className="py-lead">
                      {l.premiumUntil
                        ? <>Pro-mu berakhir {tglPanjang(l.premiumUntil)}. Akunmu sekarang di paket <b>Free</b> — catatan, kosakata, dan riwayatmu tetap tersimpan.</>
                        : <>Kamu di paket <b>Free</b>. Bank soal ujian, latihan dengar, dan materi terbuka penuh; jatah fitur AI dibatasi per hari.</>}
                    </p>
                  </>
                )}

                <hr className="py-hr" />
                <div className="py-eyebrow">Pemakaian hari ini</div>
                <div className="py-usage2">
                  {FITUR_METER.map(f => {
                    const batas = l.isPro ? BATAS[f].pro : BATAS[f].free;
                    const n = pakai[f] ?? 0;
                    return (
                      <Meter key={f} label={NAMA_FITUR[f]} nilai={`${n} / ${batas}`}
                        persen={(n / batas) * 100} isi={isiMeter(n, batas)} />
                    );
                  })}
                  {l.isPro ? (
                    <Meter penuh label="Kosakata disimpan" nilai="Tanpa batas" warnaNilai="var(--py-ok)"
                      persen={100} isi="py-f-ok" />
                  ) : (
                    <Meter penuh label="Kosakata disimpan"
                      nilai={`${kosakata ?? 0} / ${KOSAKATA_FREE}`}
                      persen={((kosakata ?? 0) / KOSAKATA_FREE) * 100}
                      isi={isiMeter(kosakata ?? 0, KOSAKATA_FREE)} />
                  )}
                </div>
                <p className="py-foot">
                  Batas reset tiap <b>00:00 WIB</b>.
                  {berjangka && " Kalau langgananmu habis, angka ini turun ke batas Free."}
                </p>

                {!l.isLifetime && (berjangka || !l.isPro) && (
                  <>
                    <hr className="py-hr" />
                    <div className="py-acts" style={{ marginTop: 0 }}>
                      <button type="button" className="py-btn py-btn-p" disabled={paying != null}
                        onClick={() => bayar("pro-bulanan")}>
                        {paying === "pro-bulanan"
                          ? "Membuka pembayaran…"
                          : `${berjangka ? "Perpanjang" : "Aktifkan Pro"} 1 bulan · ${rupiah(bulanan.harga)}`}
                      </button>
                      <Link href="/premium" className="py-btn py-btn-q">Lihat paket lain</Link>
                    </div>
                    {galat && <p className="py-galat" role="alert">{galat}</p>}
                    <p className="py-foot">
                      {berjangka
                        ? <>Ambil <b>Paket Ujian</b> (6 bulan, {rupiah(ujian.harga)}) dan sisa {sisa} harimu ikut ditambahkan — berlaku sampai <b>{tglPanjang(sampaiUjian)}</b>.</>
                        : <>Bayar sekali per periode, <b>tidak menagih otomatis</b>. Paket Ujian 6 bulan ≈ <b>{rupiah(Math.round(ujian.harga / 6))}/bulan</b>.</>}
                    </p>
                  </>
                )}

                {berjangka && (
                  <>
                    <hr className="py-hr tight" />
                    <Link href="/langganan/berhenti" className="py-btn-t left">Kalau mau berhenti ›</Link>
                  </>
                )}
              </section>

              {/* ── kanan: riwayat transaksi ── */}
              <section aria-labelledby="py-riwayat">
                <div className="py-eyebrow" id="py-riwayat">Riwayat transaksi</div>
                {txMuat ? (
                  <p className="py-kosong">Memuat…</p>
                ) : tx.length === 0 ? (
                  <p className="py-kosong">Belum ada transaksi.</p>
                ) : (
                  <>
                    {tx.map(t => {
                      const st = LABEL_TX[t.status] ?? { teks: t.status.toUpperCase(), kelas: "py-s-off" };
                      return (
                        <div key={t.order_id} className="py-tx">
                          <div style={{ minWidth: 0 }}>
                            <div className="py-tx-p">{namaPendek(t.paket_id)}</div>
                            <div className="py-tx-m">{tglPendek(t.dibuat)} · <span className="oid">{t.order_id}</span></div>
                          </div>
                          <div>
                            <div className="py-tx-a">{rupiah(t.jumlah)}</div>
                            <div className={`py-tx-s ${st.kelas}`}>{st.teks}</div>
                          </div>
                        </div>
                      );
                    })}
                    {l.isLifetime && lifetimeTx && (
                      <>
                        <hr className="py-hr tight" />
                        <div className="py-kv"><span className="py-kv-k">Dibeli</span><span className="py-kv-v">{tglPanjang(lifetimeTx.diperbarui)}</span></div>
                        <div className="py-kv"><span className="py-kv-k">Nomor pesanan</span><span className="py-kv-v mono">{lifetimeTx.order_id}</span></div>
                      </>
                    )}
                  </>
                )}
                <p className="py-foot">
                  Semua transaksi tercatat sebagai <b>WILDbyZ</b> di mutasi rekening atau tagihan kartumu — itu nama merchant pembayaran kami, bukan tagihan asing.
                </p>
                {adaLagi && (
                  <button type="button" className="py-btn-t left" onClick={async () => pasangTx(await ambilTx(tx.length), true)}>
                    Tampilkan lebih lama
                  </button>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
