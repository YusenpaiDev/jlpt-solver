"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HonixTur } from "./HonixTur";
import { HonixTawarTur } from "./HonixTawarTur";
import { useHonix } from "@/lib/use-honix";
import { useIsPro } from "@/lib/use-is-pro";
import { createClient } from "@/lib/supabase/client";
import { statusAkses, TRIAL_HARI } from "@/lib/batas-paket";
import { dengarPemicuTur, keputusanTur, LANGKAH_DESKTOP, LANGKAH_HP } from "@/lib/honix-tur";
import { langkahPembukaTrial, langkahPopupTrial, perluPopupTrial, POPUP_TRIAL_HABIS } from "@/lib/peringatan-trial";

const DAFTAR = { desktop: LANGKAH_DESKTOP, hp: LANGKAH_HP };

/**
 * Dipasang sekali di NavRail → ada di tiap halaman yang punya navigasi,
 * gak ada di player latihan / onboarding / login. Keputusan tur diambil
 * sekali per halaman, setelah setelan akun kebaca.
 *
 * Akun trial: balon pembuka tur ngasih tahu aksesnya cuma seminggu, dan
 * sekali lagi popup pas sisa ≤ 48 jam (lonceng/banner tetap jalan terus).
 */
export function HonixTurHost() {
  const { setelan, siap, ubah } = useHonix();
  const router = useRouter();
  const isPro = useIsPro();
  const [dibuat, setDibuat] = useState<string | null>(null);
  const [mode, setMode] = useState<"tur" | "tawar" | "trial" | null>(null);
  const [diputuskan, setDiputuskan] = useState(false);
  const [trialDicek, setTrialDicek] = useState(false);

  useEffect(() => dengarPemicuTur(p => { if (p === "tur" || p === "tawar") setMode(p); }), []);

  /* Tanggal daftar dari sesi lokal — gak nembak server. */
  useEffect(() => {
    let batal = false;
    createClient().auth.getSession().then(({ data }) => {
      if (!batal) setDibuat(data.session?.user.created_at ?? null);
    });
    return () => { batal = true; };
  }, []);

  /* is_pro() gagal kebaca (null) → anggap bukan trial: lebih baik diem
     daripada nyuruh orang Pro berlangganan. */
  const akses = isPro === null || !dibuat ? null : statusAkses(dibuat, isPro);

  /* Diputuskan pas render (bukan di effect) begitu setelan siap — sekali aja. */
  if (siap && !diputuskan) {
    setDiputuskan(true);
    setMode(keputusanTur(setelan.tur, new Date()));
  }
  /* Popup "tinggal 2 hari" dicek sekali, setelah tur (kalau ada) beres. */
  if (siap && diputuskan && mode === null && akses && !trialDicek) {
    setTrialDicek(true);
    if (perluPopupTrial(akses, setelan.tur)) setMode("trial");
  }

  const catat = () => ubah({ tur: { ...setelan.tur, terakhir: new Date().toISOString() } });
  const catatPopup = () => ubah({ tur: { ...setelan.tur, halaman: { ...setelan.tur.halaman, [POPUP_TRIAL_HABIS]: new Date().toISOString() } } });
  const lihatPro = { label: "Lihat paket Pro", onClick: () => router.push("/premium") };

  if (mode === "tur") {
    const pembuka = langkahPembukaTrial(akses, TRIAL_HARI);
    return <HonixTur daftar={DAFTAR} onSelesai={() => { catat(); setMode(null); }}
      pembuka={pembuka} aksiPembuka={pembuka ? { label: "Lihat Pro", onClick: lihatPro.onClick } : null}
      aksiAkhir={{ label: "Mulai latihan", onClick: () => router.push("/latihan/kilat") }} />;
  }
  if (mode === "trial" && akses) {
    return <HonixTur daftar={{ desktop: [langkahPopupTrial(akses)] }}
      onSelesai={() => { catatPopup(); setMode(null); }} aksiAkhir={lihatPro} />;
  }
  if (mode === "tawar") {
    return <HonixTawarTur onLihat={() => { catat(); setMode("tur"); }} onNanti={() => { catat(); setMode(null); }} />;
  }
  return null;
}
