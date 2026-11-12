"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { HonixTur } from "./HonixTur";
import { HonixTawarTur } from "./HonixTawarTur";
import { useHonix } from "@/lib/use-honix";
import { useIsPro } from "@/lib/use-is-pro";
import { createClient } from "@/lib/supabase/client";
import { statusAkses } from "@/lib/batas-paket";
import "@/styles/rencana-dasar.css";
import "@/styles/alur.css";
import { dengarPemicuTur } from "@/lib/honix-tur";
import { langkahPopupTrial, perluPopupTrial, POPUP_TRIAL_HABIS } from "@/lib/peringatan-trial";
import { PARAM_TUR } from "@/lib/tur-alur";
import { TurAlur } from "@/components/alur/TurAlur";

/**
 * Dipasang sekali di NavRail → ada di tiap halaman yang punya navigasi,
 * gak ada di player latihan / onboarding / login.
 *
 * Tur Honix (HANDOFF-alur-belajar §5) gak otomatis lagi — penutup onboarding
 * udah cukup. Dibuka dari Pengaturan: kalau bukan di Beranda, pindah dulu ke
 * `/?tur=1` (target turnya kartu misi). Akun trial tetap dapat popup sekali
 * pas sisa ≤ 48 jam (lonceng/banner tetap jalan terus).
 */
export function HonixTurHost() {
  const { setelan, siap, ubah } = useHonix();
  const router = useRouter();
  const pathname = usePathname();
  const isPro = useIsPro();
  const [toast, setToast] = useState(false);
  const [dibuat, setDibuat] = useState<string | null>(null);
  const [mode, setMode] = useState<"tur" | "tawar" | "trial" | null>(null);

  /* Datang dari Pengaturan → mulai tur di Beranda, lalu bersihin URL. */
  useEffect(() => {
    if (pathname !== "/") return;
    const q = new URLSearchParams(window.location.search);
    if (!q.has(PARAM_TUR)) return;
    history.replaceState(null, "", "/");
    const t = setTimeout(() => setMode("tur"), 400);
    return () => clearTimeout(t);
  }, [pathname]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  const [diputuskan, setDiputuskan] = useState(false);
  const [trialDicek, setTrialDicek] = useState(false);

  useEffect(() => dengarPemicuTur(p => {
    if (p === "tur" && window.location.pathname !== "/") router.push(`/?${PARAM_TUR}=1`);
    else if (p === "tur" || p === "tawar") setMode(p);
  }), [router]);

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

  /* Tur gak diputer otomatis lagi; yang dicek cuma popup trial. */
  if (siap && !diputuskan) setDiputuskan(true);
  /* Popup "tinggal 2 hari" dicek sekali, setelah tur (kalau ada) beres. */
  if (siap && diputuskan && mode === null && akses && !trialDicek) {
    setTrialDicek(true);
    if (perluPopupTrial(akses, setelan.tur)) setMode("trial");
  }

  const catat = () => ubah({ tur: { ...setelan.tur, terakhir: new Date().toISOString() } });
  const catatPopup = () => ubah({ tur: { ...setelan.tur, halaman: { ...setelan.tur.halaman, [POPUP_TRIAL_HABIS]: new Date().toISOString() } } });
  const lihatPro = { label: "Lihat paket Pro", onClick: () => router.push("/premium") };

  if (mode === "tur") {
    return <TurAlur onSelesai={() => { catat(); setMode(null); setToast(true); }} />;
  }
  if (mode === "trial" && akses) {
    return <HonixTur daftar={{ desktop: [langkahPopupTrial(akses)] }}
      onSelesai={() => { catatPopup(); setMode(null); }} aksiAkhir={lihatPro} />;
  }
  if (mode === "tawar") {
    return <HonixTawarTur onLihat={() => { catat(); setMode("tur"); }} onNanti={() => { catat(); setMode(null); }} />;
  }
  if (toast) {
    return createPortal(<div className="rbk"><div className="al-toast" role="status">Tur selesai. Bisa diulang di Pengaturan.</div></div>, document.body);
  }
  return null;
}
