import { createClient } from "@/lib/supabase/client";
import { catatAktivitas } from "@/lib/aktivitas";
import { tambahXp, XP } from "@/lib/xp";
import { catatItem } from "@/lib/kurikulum-db";

/**
 * Rekam satu jawaban drill Bunpou: bunpou_progress (benar/salah per pola) +
 * aktivitas harian "bunpou" (streak & kalender cap). Dulu drill Bunpou gak
 * pernah manggil catatAktivitas, jadi latihan Bunpou aja gak nyambung streak.
 *
 * `xp`: Latihan Kilat ngasih XP (8 benar / 2 salah), drill lain enggak.
 */
export async function catatJawabanBunpou(pattern: string, benar: boolean, { xp = false, level }: { xp?: boolean; level?: string } = {}): Promise<void> {
  try {
    void catatAktivitas("bunpou");
    /* Jadwal ulang kurikulum (no-op selama flag kurikulum mati). */
    if (level) void catatItem("pola", pattern, level, benar);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("bunpou_progress").select("benar, salah").eq("user_id", user.id).eq("pattern", pattern).maybeSingle();
    await supabase.from("bunpou_progress").upsert({
      user_id: user.id, pattern,
      benar: (data?.benar ?? 0) + (benar ? 1 : 0),
      salah: (data?.salah ?? 0) + (benar ? 0 : 1),
    }, { onConflict: "user_id,pattern" });
    if (!xp) return;
    await tambahXp(benar ? XP.jawabBenar : XP.jawabSalah);
  } catch { /* nyusul pas reload */ }
}
