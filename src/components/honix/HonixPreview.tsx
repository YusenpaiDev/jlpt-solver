"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Honix } from "./Honix";
import { HonixEmpty } from "./HonixEmpty";
import { HonixFinishDialog } from "./HonixFinishDialog";
import { HonixReaction } from "./HonixReaction";
import { laporkanXp } from "@/lib/honix-level";
import { tesSuaraHonix } from "@/lib/honix-sfx";
import { useHonix } from "@/lib/use-honix";
import { resetBerikutnya } from "@/lib/batas-paket";
import { Cek, Aktif, Diproses, Gagal, type Status } from "@/components/pembayaran/StatusPembayaran";
import { JatahHabisSheet, JatahHabisInline } from "@/components/pembayaran/JatahHabis";
import { HonixTawarTur } from "./HonixTawarTur";
import type { KuotaHabis } from "@/lib/kuota-habis";

const DEMO_STATUS: Status = {
  order_id: "PRATINJAU-LOKAL-BUKAN-TRANSAKSI", paket_id: "pro-bulanan", jumlah: 129000,
  status: "pending", dibuat: "2026-10-08T08:00:00+07:00", premium_until: "2026-11-08T08:00:00+07:00", is_lifetime: false,
};

/** Hanya dipasang oleh route development; komponen sama dengan layar aplikasi. */
export function HonixPreview() {
  const { kurangiGerak } = useHonix();
  const [demoKuota] = useState<KuotaHabis>(() => ({
    feature: "chat", used: 5, limit: 5, resetAt: resetBerikutnya(), plan: "free", message: "Jatah hari ini habis.",
  }));
  const [scene, setScene] = useState("materi");
  const [skor, setSkor] = useState<number | null>(null);
  const [reaksi, setReaksi] = useState<"ok" | "no" | null>(null);
  const [kuota, setKuota] = useState<KuotaHabis | null>(null);
  const urutan = useRef(0);
  const tutup = () => setSkor(null);
  return (
    <main className={`hx hx-preview${kurangiGerak ? " hx-rm" : ""}`}>
      <header><h1>Honix · pratinjau lokal</h1><p>Data contoh untuk pemeriksaan tampilan. Tidak membuat pembayaran atau menyimpan XP.</p></header>
      <div className="hx-preview-tools">
        <label>Keadaan <select value={scene} onChange={e => setScene(e.target.value)}>
          <option value="materi">Materi kosong</option><option value="sensei">Chat Sensei</option>
          <option value="cek">Pembayaran · memeriksa</option><option value="aktif">Pembayaran · Pro aktif</option>
          <option value="diproses">Pembayaran · diproses</option><option value="gagal">Pembayaran · gagal</option>
          <option value="chat">Jatah chat habis</option><option value="chat-pro">Jatah Pro habis</option>
          <option value="tawar-tur">Tawaran tur bulanan</option>
        </select></label>
        <button className="hx-btn hx-btn-g" onClick={() => laporkanXp({ userId: `preview-${++urutan.current}`, sebelum: 998, sesudah: 1006 })}>Naik level</button>
        {[10, 8, 6, 3].map(n => <button key={n} className="hx-btn hx-btn-g" onClick={() => setSkor(n)}>Hasil {n}/10</button>)}
        <button className="hx-btn hx-btn-g" onClick={() => setReaksi("ok")}>5 benar beruntun</button>
        <button className="hx-btn hx-btn-g" onClick={() => setReaksi("no")}>3 salah beruntun</button>
        <button className="hx-btn hx-btn-g" onClick={() => setKuota({ ...demoKuota, feature: "furigana", used: 20, limit: 20 })}>Jatah furigana habis</button>
        <button className="hx-btn hx-btn-g" onClick={tesSuaraHonix}>Tes semua suara</button>
        <Link className="hx-btn hx-btn-g" href="/pengaturan">Pengaturan</Link>
      </div>
      <section className="hx-preview-stage">
        {scene === "tawar-tur" && <HonixTawarTur onLihat={() => setScene("materi")} onNanti={() => setScene("materi")} />}
        {scene === "materi" && <HonixEmpty momen="kosongMateri"
          body="Set ujianmu akan muncul di sini. Sambil menunggu, kamu bisa belajar Bunpou dan Kotoba."
          cta={<Link href="/materi/bunpou" className="hx-btn hx-btn-p">Belajar Bunpou</Link>} />}
        {scene === "sensei" && <div className="glass-card side-card sensei-card">
          <div className="sensei-intro"><Honix pose="tunjuk" size={64} sizeHp={52} idle="none" alt="" />
            <div><div className="sensei-name">Sensei AI</div><div className="sensei-status">Online · siap bantu</div></div></div>
          <div className="sensei-suggest"><button className="suggest-pill">Kenapa jawaban ini benar?</button><button className="suggest-pill">Kasih contoh kalimat lain</button></div>
        </div>}
        {(["cek", "aktif", "diproses", "gagal"].includes(scene)) && <div className="py py-receipt">
          {scene === "cek" && <Cek data={DEMO_STATUS} orderId={DEMO_STATUS.order_id} />}
          {scene === "aktif" && <Aktif data={{ ...DEMO_STATUS, status: "aktif" }} />}
          {scene === "diproses" && <Diproses data={DEMO_STATUS} kini={Date.parse("2026-10-08T08:30:00+07:00")} orderId={DEMO_STATUS.order_id} berhenti={false} memeriksa={false} onPeriksa={() => setScene("aktif")} />}
          {scene === "gagal" && <Gagal data={{ ...DEMO_STATUS, status: "gagal" }} />}
        </div>}
        {scene === "chat" && <JatahHabisInline kuota={demoKuota} onTunggu={() => setScene("sensei")} />}
        {scene === "chat-pro" && <JatahHabisInline kuota={{ ...demoKuota, plan: "pro", used: 50, limit: 50 }} />}
        {reaksi && <HonixReaction key={reaksi} kind={reaksi} beruntun={reaksi === "ok" ? 5 : 3} onSelesai={() => setReaksi(null)} />}
      </section>
      {skor != null && <HonixFinishDialog skor={skor} total={10} xp={skor * 8} streak={3} onCobaLagi={tutup} onLanjut={tutup} onPembahasan={tutup} onTutup={tutup} />}
      {kuota && <JatahHabisSheet kuota={kuota} onClose={() => setKuota(null)} />}
    </main>
  );
}
