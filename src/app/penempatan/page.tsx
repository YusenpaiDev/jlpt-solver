"use client";

import { KunciHalaman } from "@/components/premium/Gembok";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserStats } from "@/lib/use-user-stats";
import { fiturLive } from "@/lib/kurikulum-config";
import { Disiapkan, Kerangka } from "@/components/kurikulum/Bagian";
import { Penempatan } from "@/components/kurikulum/Penempatan";

/** Tes penempatan di luar onboarding: dari Materi / Kurikulum / Pengaturan ("Ulangi tes penempatan"). */
function PenempatanPageIsi() {
  const stats = useUserStats();
  const router = useRouter();
  const [pace, setPace] = useState(20);

  useEffect(() => {
    void createClient().auth.getUser().then(({ data: { user } }) => {
      const p = Number(user?.user_metadata?.daily_goal_minutes);
      if (Number.isFinite(p) && p > 0) setPace(p);
    });
  }, []);

  const crumb = [{ label: "Materi", href: "/materi" }, { label: "Kurikulum", href: "/kurikulum" }, { label: "Tes penempatan" }];
  if (!fiturLive("penempatan")) {
    return <Kerangka stats={stats} crumb={crumb}><Disiapkan judul="Tes penempatan" isi="±15 menit, 40 soal campuran. Hasilnya nentuin kurikulummu mulai dari minggu ke berapa, biar gak ngulang yang udah kamu bisa." /></Kerangka>;
  }
  return (
    <Kerangka stats={stats} crumb={crumb}>
      {stats.loaded
        ? <Penempatan level={stats.targetLevel} ujian={stats.examDate?.slice(0, 10) ?? null} pace={pace} onSelesai={() => router.push("/kurikulum")} />
        : <p className="ku-muat" role="status">Memuat…</p>}
    </Kerangka>
  );
}

/* Masa percobaan habis & belum Premium → layar gembok, bukan soal. */
export default function PenempatanPage() {
  return <KunciHalaman><PenempatanPageIsi /></KunciHalaman>;
}
