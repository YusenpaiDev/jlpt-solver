import { LabelDisiapkan } from "@/components/rencana/LabelDisiapkan";
import { FASE, JUMLAH_UNIT } from "@/lib/kurikulum-config";

/** Kartu Kurikulum paling atas /materi, versi "Sedang disiapkan"
    (HANDOFF-materi-bank-soal §2.2): bikin penasaran, tanpa tombol. */
export function KartuKurikulumDisiapkan({ level, kata, pola }: { level: string; kata: number; pola: number }) {
  return (
    <section className="card ku-prep" aria-label="Kurikulum, sedang disiapkan">
      <div>
        <div className="eyebrow" style={{ color: "var(--info-t)" }}>Kurikulum {level}<LabelDisiapkan /></div>
        <b className="kp-t">{JUMLAH_UNIT} minggu terarah sampai hari ujian</b>
        <p>Tiap minggu satu unit: kata, pola, dan jenis soal. Tingkat soal naik sendiri. Sambil nunggu, Kotoba & Bunpou di bawah tetap jalan dan progresnya ikut kebawa.</p>
        <div className="kp-ph">
          {FASE.map(f => (
            <div key={f.id} style={{ flex: f.minggu[1] - f.minggu[0] + 1 }}>
              <i style={{ background: f.warna }} />
              <b>{f.t}</b>
              <small>Minggu {f.minggu[0]}–{f.minggu[1]}{f.tingkat ? ` · ${f.tingkat}` : ""}</small>
            </div>
          ))}
        </div>
        <div className="kp-x">Belum ada tombol di sini. Kartu ini berubah sendiri begitu kurikulum siap.</div>
      </div>
      <div className="kp-as">
        <div><b>{kata.toLocaleString("id-ID")}</b><span>kata {level}</span></div>
        <div><b>{pola}</b><span>pola Bunpou</span></div>
        <div><b>T1–T3</b><span>soal orisinal bertingkat</span></div>
        <div><b>{JUMLAH_UNIT}</b><span>unit mingguan</span></div>
      </div>
    </section>
  );
}
