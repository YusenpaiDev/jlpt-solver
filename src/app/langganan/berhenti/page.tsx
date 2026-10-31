"use client";

import "@/styles/pembayaran.css";
import { useState } from "react";
import Link from "next/link";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { useUserStats } from "@/lib/use-user-stats";
import { useBayar } from "@/lib/bayar";
import { useLangganan, sisaHari, tglPanjang } from "@/lib/langganan";

/**
 * "Kalau mau berhenti" (HANDOFF-pembayaran §6).
 *
 * Gak ada yang dibatalkan, karena gak ada tagihan otomatis. Satu-satunya
 * tombol cuma MATIIN PENGINGAT H-7/H-3/H-1 — Pro tetap jalan penuh sampai hari
 * terakhir. Gak ada status "dibatalkan", gak ada survei alasan, masa berlaku
 * gak disentuh.
 */

const SUPPORT = "yusufnashirsyarifuddin@gmail.com";

export default function Berhenti() {
  const stats = useUserStats();
  const l = useLangganan();
  const { bayar, paying, galat } = useBayar();
  const [simpan, setSimpan] = useState(false);
  const [gagal, setGagal] = useState(false);

  /* Toggle = "matikan pengingat", jadi NYALA berarti pengingatnya MATI. */
  const mati = !l.pengingat;
  const ubah = async () => {
    setSimpan(true);
    setGagal(false);
    const ok = await l.setPengingat(mati);
    if (!ok) setGagal(true);
    setSimpan(false);
  };

  const sisa = sisaHari(l.premiumUntil);
  const berjangka = l.isPro && !l.isLifetime && sisa != null && sisa > 0;

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />

      <main className="app-shell">
        <UserBar streakDays={stats.streak} xp={stats.xp} xpTarget={stats.xpTarget}
          avatarLetter={stats.initial} isPro={stats.isPro} />

        <div className="py">
          <Breadcrumb items={[
            { label: "Pengaturan", href: "/pengaturan" },
            { label: "Langganan", href: "/langganan" },
            { label: "Berhenti" },
          ]} />
          <div className="py-hd" style={{ marginTop: 10 }}>
            <h1>Tidak ada yang perlu dibatalkan</h1>
          </div>

          <div className="py-cols">
            <section>
              <p className="py-lead" style={{ marginTop: 0 }}>
                Sensei JLPT <b>tidak menagih otomatis</b>. Kamu bayar sekali untuk satu periode, dan langganannya berhenti sendiri saat masa berlakunya lewat. Cukup tidak perpanjang.
              </p>
              <hr className="py-hr" />
              <div className="py-tg-row">
                <div>
                  <div className="py-tg-t" id="py-tg-label">Matikan pengingat perpanjangan</div>
                  <div className="py-tg-s">
                    Kami berhenti mengingatkan di H-7, H-3, dan H-1.
                    {berjangka && <> Pro kamu <b>tetap jalan penuh</b> sampai {tglPanjang(l.premiumUntil!)}.</>}
                  </div>
                </div>
                <button type="button" role="switch" aria-checked={mati} aria-labelledby="py-tg-label"
                  className={`py-tg${mati ? " on" : ""}`} onClick={ubah} disabled={!l.loaded || simpan} />
              </div>
              {gagal && <p className="py-galat" role="alert">Gagal menyimpan. Coba lagi sebentar.</p>}
              <p className="py-pp">
                Setelah masa berlaku lewat, akses belajar berakhir. Semua catatan, kosakata, dan riwayat latihanmu <b>tetap tersimpan</b> — berlangganan kembali untuk melanjutkan.
              </p>
              <p className="py-pp">
                Data belajarmu <b>tidak dihapus</b>. Masa percobaan tidak dimulai ulang setelah langganan habis.
              </p>
              {berjangka && (
                <div className="py-acts">
                  <button type="button" className="py-btn py-btn-q" disabled={paying != null}
                    onClick={() => bayar("pro-bulanan")}>
                    {paying ? "Membuka pembayaran…" : "Perpanjang saja"}
                  </button>
                </div>
              )}
              {galat && <p className="py-galat" role="alert">{galat}</p>}
              <p className="py-foot">
                Ada masalah dengan pembayaran atau merasa tertagih keliru? Hubungi <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> dengan nomor pesanan dari <Link href="/langganan">riwayat transaksi</Link>.
              </p>
            </section>

            <section>
              <div className="py-eyebrow">Setelah langganan berakhir</div>
              <div className="py-kv"><span className="py-kv-k">Chat AI</span>
                <span className="py-kv-v"><b className="down">Perlu langganan aktif</b></span></div>
              <div className="py-kv"><span className="py-kv-k">Furigana</span>
                <span className="py-kv-v"><b className="down">Perlu langganan aktif</b></span></div>
              <div className="py-kv"><span className="py-kv-k">Kosakata disimpan</span>
                <span className="py-kv-v"><b>Tetap tersimpan</b></span></div>
              <p className="py-foot">
                Bank soal, latihan dengar, dan materi dapat digunakan selama trial atau langganan aktif.
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
