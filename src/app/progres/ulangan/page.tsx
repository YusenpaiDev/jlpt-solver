"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStats } from "@/lib/use-user-stats";
import { useKurikulum, type Ulangan } from "@/lib/use-kurikulum";
import { ATURAN, fiturLive } from "@/lib/kurikulum-config";
import { nilaiUlangan, seninDari } from "@/lib/kurikulum";
import { susunUlangan, type Soal } from "@/lib/soal-kurikulum";
import { catatItem, catatJenis, simpanUlangan } from "@/lib/kurikulum-db";
import { DEV_BYPASS } from "@/lib/dev-materi";
import { BelumMulai, Disiapkan, Kerangka } from "@/components/kurikulum/Bagian";
import { Kuis, type Jawaban } from "@/components/kurikulum/Kuis";
import { HasilUlangan, unitUlangan, BAGIAN_ULANGAN } from "@/components/kurikulum/Ulangan";

/** Ulangan mingguan: 24 soal dari unit minggu lalu (HANDOFF-kurikulum §10). */
export default function UlanganPage() {
  const stats = useUserStats();
  const router = useRouter();
  const k = useKurikulum(stats.targetLevel, stats.loaded);
  const [hasil, setHasil] = useState<{ baris: Ulangan; soalLupa: Soal[] } | null>(null);
  const [ulang, setUlang] = useState<Soal[] | null>(null);
  const [galat, setGalat] = useState(false);
  const crumb = [{ label: "Progres", href: "/progres?tab=ulangan" }, { label: "Ulangan mingguan" }];

  const u = k.siap ? unitUlangan(k) : null;
  const lalu = k.ulangan.filter(x => x.minggu < seninDari(k.hariIni)).pop();
  const soal = useMemo(() => {
    if (!u || !k.dekK || !k.dekB) return [];
    const lupa = (lalu?.item_lupa ?? []).map(x => x.kunci);
    return susunUlangan(k.unit[u - 1], k.dekK.vocabulary, k.dekB.patterns, lupa, ATURAN.ulangan, Number(seninDari(k.hariIni).replaceAll("-", "")));
  }, [u, k.dekK, k.dekB, k.unit, lalu, k.hariIni]);

  if (!fiturLive("ulangan")) return <Kerangka stats={stats} crumb={crumb}><Disiapkan judul="Ulangan mingguan" isi="Tiap Senin ±10 menit: materi & kesalahan minggu lalu ditanya ulang dalam bentuk baru. Gantiin tes mini." /></Kerangka>;
  if (!k.siap) return <Kerangka stats={stats} crumb={crumb}><p className="ku-muat" role="status">Menyiapkan ulangan…</p></Kerangka>;
  if (k.belumMulai) return <Kerangka stats={stats} crumb={crumb}><BelumMulai level={stats.targetLevel} penempatan={fiturLive("penempatan")} /></Kerangka>;

  const selesai = async (j: Jawaban[]) => {
    const h = nilaiUlangan(j.map(x => ({ bagian: x.soal.bagian, benar: x.benar })));
    const salah = j.filter(x => !x.benar && x.soal.item);
    const lupa = salah.map(x => ({ jenis: x.soal.item!.jenis, kunci: x.soal.item!.kunci, arti: x.soal.item!.arti, baca: x.soal.item!.baca }));
    const baris: Ulangan = { minggu: seninDari(k.hariIni), unit: u!, benar: h.benar, total: h.total, per_bagian: h.perBagian, item_lupa: lupa };
    setHasil({ baris, soalLupa: salah.map(x => x.soal) });
    if (DEV_BYPASS) return;
    try { await simpanUlangan(baris.minggu, baris.unit, h, lupa); } catch { setGalat(true); }
    /* Yang lupa → status belajar, jatuh tempo besok; yang nempel naik tahap. */
    for (const x of j) {
      if (x.soal.item) void catatItem(x.soal.item.jenis, x.soal.item.kunci, stats.targetLevel, x.benar);
      if (x.soal.jenis) void catatJenis(x.soal.jenis, x.benar);
    }
  };

  const segmen = BAGIAN_ULANGAN.map(b => ({ k: b.k, n: soal.filter(s => s.bagian === b.k).length })).filter(s => s.n > 0);
  return (
    <Kerangka stats={stats} crumb={crumb}>
      {ulang ? (
        <Kuis soal={ulang} segmen={[{ k: "Ulang yang lupa", n: ulang.length }]} label="Ulang yang lupa" detikPerSoal={25}
          onKeluar={() => setUlang(null)}
          onSelesai={j => { if (!DEV_BYPASS) for (const x of j) if (x.soal.item) void catatItem(x.soal.item.jenis, x.soal.item.kunci, stats.targetLevel, x.benar); setUlang(null); router.push("/"); }} />
      ) : hasil ? (
        <>
          {galat && <p className="bad-t" role="alert" style={{ fontSize: 13, marginBottom: 12 }}>Hasilnya belum kesimpan. Jawabanmu tetap ngisi jadwal ulang.</p>}
          <HasilUlangan baris={hasil.baris} lalu={lalu} onUlang={hasil.soalLupa.length ? () => setUlang(hasil.soalLupa) : undefined} />
        </>
      ) : !u ? (
        <p className="ku-muat">Ulangan pertama muncul Senin depan, setelah unit minggu ini selesai.</p>
      ) : soal.length ? (
        <Kuis soal={soal} segmen={segmen} label={`Ulangan minggu ${u}`} detikPerSoal={25} onKeluar={() => router.push("/progres?tab=ulangan")} onSelesai={selesai} />
      ) : <p className="ku-muat" role="status">Menyiapkan soal…</p>}
    </Kerangka>
  );
}
