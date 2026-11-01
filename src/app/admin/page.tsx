import type { Metadata } from "next";
import { connection } from "next/server";
import { wajibAdmin } from "@/lib/admin/akses";
import { ambilDasbor, type DasborAdmin } from "@/lib/admin/data";
import { dasborContoh } from "@/lib/admin/contoh";
import { PAKET, adalahPaket } from "@/lib/paket";
import "./admin.css";

export const metadata: Metadata = { title: "Admin · Sensei JLPT", robots: { index: false, follow: false } };

const rp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const angka = (n: number) => n.toLocaleString("id-ID");
const tgl = (iso: string) => new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/* Nama dari paket.ts dibuang awalan "Sensei JLPT" — langganan.ts punya versi
   pendeknya, tapi itu modul "use client" (gak bisa dipanggil dari server). */
const namaPendek = (id: string) => (adalahPaket(id) ? PAKET[id].nama.replace(/^Sensei JLPT /, "") : id);
const NAMA_FITUR: Record<string, string> = { chat: "Chat Sensei", furigana: "Furigana", "tugas-generate": "Lembar tugas AI" };

function Kartu({ label, nilai, sub, nada }: { label: string; nilai: string; sub?: string; nada?: "ok" | "warn" | "bad" }) {
  return (
    <div className={`adm-kartu${nada ? ` ${nada}` : ""}`}>
      <span className="adm-label">{label}</span>
      <strong>{nilai}</strong>
      {sub && <span className="adm-sub">{sub}</span>}
    </div>
  );
}

function Batang({ data, label }: { data: { tanggal: string; n: number }[]; label: string }) {
  const maks = Math.max(1, ...data.map(d => d.n));
  return (
    <figure className="adm-batang" aria-label={label}>
      <div className="adm-batang-isi">
        {data.map(d => <span key={d.tanggal} style={{ height: `${(d.n / maks) * 100}%` }} title={`${d.tanggal}: ${d.n}`} />)}
      </div>
      <figcaption><span>{data[0]?.tanggal.slice(5)}</span><span>{label} · maks {maks}</span><span>hari ini</span></figcaption>
    </figure>
  );
}

/**
 * Dasbor admin — cuma email di ADMIN_EMAILS (selain itu 404). Gak ada link di
 * menu. Di mode dev bypass pakai data contoh, gak nyentuh DB.
 */
export default async function AdminPage() {
  await connection();
  const devBypass = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";
  let d: DasborAdmin;
  if (devBypass) d = dasborContoh();
  else { await wajibAdmin(); d = await ambilDasbor(); }
  const { user, uang, pemakaian, konten } = d;
  const totalSet = pemakaian.setPerHari.reduce((s, x) => s + x.n, 0);
  const maksLevel = Math.max(1, ...Object.values(user.perLevel));

  return (
    <main className="adm">
      <header className="adm-head">
        <div>
          <h1>Dasbor admin</h1>
          <p>Diperbarui {tgl(d.dibuat)} WIB{devBypass && " · data contoh (dev)"}</p>
        </div>
        <a className="adm-btn" href="/admin">↻ Muat ulang</a>
      </header>

      <section className="adm-sek" aria-labelledby="adm-user">
        <h2 id="adm-user">User</h2>
        <div className="adm-grid">
          <Kartu label="Total user" nilai={angka(user.total)} />
          <Kartu label="Baru 7 hari" nilai={angka(user.baru7)} sub={`${angka(user.baru30)} dalam 30 hari`} />
          <Kartu label="Aktif hari ini" nilai={angka(user.aktifHariIni)} sub={`${angka(user.aktif7)} aktif 7 hari`} />
          <Kartu label="Belum onboarding" nilai={angka(user.belumOnboarding)} nada={user.belumOnboarding ? "warn" : undefined} />
        </div>
        <div className="adm-dua">
          <Batang data={user.daftarPerHari} label="User baru per hari" />
          <div className="adm-panel">
            <h3>Level target</h3>
            {["N1", "N2", "N3", "N4", "N5"].map(l => (
              <div key={l} className="adm-bar-baris">
                <span>{l}</span>
                <div><i style={{ width: `${((user.perLevel[l] ?? 0) / maksLevel) * 100}%` }} /></div>
                <b>{angka(user.perLevel[l] ?? 0)}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="adm-sek" aria-labelledby="adm-uang">
        <h2 id="adm-uang">Uang &amp; Pro</h2>
        <div className="adm-grid">
          <Kartu label="Pendapatan bulan ini" nilai={rp(uang.pendapatanBulanIni)} sub={`Total ${rp(uang.pendapatanTotal)}`} nada="ok" />
          <Kartu label="Pro aktif" nilai={angka(uang.proAktif)} sub={`${angka(uang.segeraHabis)} habis ≤7 hari`} nada={uang.segeraHabis ? "warn" : undefined} />
          <Kartu label="Lifetime" nilai={angka(uang.lifetime)} sub={`Whitelist manual ${angka(uang.whitelist)}`} />
          <Kartu label="PENDING > 1 jam" nilai={angka(uang.pendingNyangkut)} sub="Webhook Midtrans macet?" nada={uang.pendingNyangkut ? "bad" : "ok"} />
        </div>
        <div className="adm-dua">
          <div className="adm-panel">
            <h3>Transaksi per status</h3>
            <div className="adm-chip-baris">
              {Object.entries(uang.perStatus).map(([s, n]) => <span key={s} className={`adm-chip st-${s}`}>{s.toUpperCase()} {angka(n)}</span>)}
              {!Object.keys(uang.perStatus).length && <span className="adm-kosong">Belum ada transaksi.</span>}
            </div>
            <h3>Penjualan per paket (LUNAS)</h3>
            <table className="adm-tabel">
              <tbody>
                {Object.entries(uang.perPaket).map(([p, v]) => (
                  <tr key={p}><td>{namaPendek(p)}</td><td>{angka(v.n)}×</td><td>{rp(v.rp)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="adm-panel adm-lebar">
            <h3>10 transaksi terakhir</h3>
            <table className="adm-tabel">
              <thead><tr><th>Nomor pesanan</th><th>User</th><th>Paket</th><th>Jumlah</th><th>Status</th><th>Waktu</th></tr></thead>
              <tbody>
                {uang.terakhir.map(t => (
                  <tr key={t.order_id}>
                    <td className="mono">{t.order_id}</td><td>{t.email ?? "—"}</td>
                    <td>{namaPendek(t.paket_id)}</td><td>{rp(t.jumlah)}</td>
                    <td><span className={`adm-chip st-${t.status}`}>{t.status.toUpperCase()}</span></td><td>{tgl(t.dibuat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!uang.terakhir.length && <p className="adm-kosong">Belum ada transaksi.</p>}
          </div>
        </div>
      </section>

      <section className="adm-sek" aria-labelledby="adm-pakai">
        <h2 id="adm-pakai">Pemakaian</h2>
        <div className="adm-grid">
          <Kartu label="Set dikerjain (30 hari)" nilai={angka(totalSet)} />
          <Kartu label="Soal dijawab (30 hari)" nilai={angka(pemakaian.soalDijawab)} />
          <Kartu label="Pengguna AI hari ini" nilai={angka(pemakaian.penggunaAiHariIni)} />
          <Kartu label="Panggilan AI (7 hari)" nilai={angka(Object.values(pemakaian.ai).reduce((s, a) => s + a.minggu, 0))} sub="Perkiraan biaya: dari sini" />
        </div>
        <div className="adm-dua">
          <Batang data={pemakaian.setPerHari} label="Set dikerjain per hari" />
          <div className="adm-panel">
            <h3>Pemakaian AI</h3>
            <table className="adm-tabel">
              <thead><tr><th>Fitur</th><th>Hari ini</th><th>7 hari</th></tr></thead>
              <tbody>
                {Object.entries(pemakaian.ai).map(([f, a]) => (
                  <tr key={f}><td>{NAMA_FITUR[f] ?? f}</td><td>{angka(a.hariIni)}</td><td>{angka(a.minggu)}</td></tr>
                ))}
              </tbody>
            </table>
            <h3>Set paling sering (30 hari)</h3>
            <ol className="adm-populer">
              {pemakaian.populer.map(p => <li key={p.title}><span className="jp">{p.title}</span><b>{angka(p.n)}</b></li>)}
            </ol>
            {!pemakaian.populer.length && <p className="adm-kosong">Belum ada set dikerjain.</p>}
          </div>
        </div>
      </section>

      <section className="adm-sek" aria-labelledby="adm-konten">
        <h2 id="adm-konten">Konten &amp; kesehatan</h2>
        <div className="adm-dua">
          <div className="adm-panel adm-lebar">
            <h3>Bank soal · {angka(konten.totalBankSoal)} soal</h3>
            <table className="adm-tabel adm-matriks">
              <thead><tr><th /><th className="jp">文字</th><th className="jp">語彙</th><th className="jp">文法</th><th className="jp">読解</th><th>Total</th></tr></thead>
              <tbody>
                {Object.entries(konten.bankSoal).map(([l, k]) => {
                  const total = Object.values(k).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={l}>
                      <th>{l}</th>
                      {(["文字", "語彙", "文法", "読解"] as const).map(c => <td key={c} className={k[c] ? "" : "nol"}>{angka(k[c] ?? 0)}</td>)}
                      <td><b>{angka(total)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="adm-grid adm-grid-1">
            <Kartu label="Sesi dengan soal ditandai REVIEW" nilai={konten.sesiReview == null ? "—" : angka(konten.sesiReview)}
              sub={konten.sesiReview == null ? "Gagal dihitung" : "Cek & betulin teks soalnya"} nada={konten.sesiReview ? "warn" : undefined} />
            <Kartu label="Error 24 jam" nilai={d.error == null ? "—" : angka(d.error.hari)}
              sub={d.error == null ? "Jalankan migration error_log dulu" : d.error.hari ? "Lihat daftar di bawah" : "Aman"}
              nada={d.error == null ? undefined : d.error.hari ? "bad" : "ok"} />
          </div>
        </div>
      </section>

      {d.error && d.error.terbaru.length > 0 && (
        <section className="adm-sek" aria-labelledby="adm-error">
          <h2 id="adm-error">Error terbaru</h2>
          <div className="adm-panel">
            <table className="adm-tabel">
              <thead><tr><th>Waktu</th><th>Sumber</th><th>Halaman</th><th>Pesan</th></tr></thead>
              <tbody>
                {d.error.terbaru.map((e, i) => (
                  <tr key={i}>
                    <td>{tgl(e.waktu)}</td>
                    <td><span className={`adm-chip ${e.sumber === "server" ? "st-gagal" : "st-pending"}`}>{e.sumber.toUpperCase()}</span></td>
                    <td className="mono">{e.path ?? e.rute ?? "—"}</td>
                    <td className="adm-pesan">{e.pesan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
