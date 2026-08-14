"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasProAccess } from "@/lib/access";

/**
 * Satu sumber data buat header tiap halaman: streak, XP, level target, status PRO.
 *
 * Sebelum ini tiap halaman nulis sendiri `xp={820}` dan `isPro` — angka contoh
 * yang kebawa sampai produksi. Akibatnya user baru yang XP-nya 0 tetap kelihatan
 * 820, dan yang milih N3 di onboarding tetap dianggap N2.
 *
 * Semua nilai di sini datang dari database. Kalau kosong ya 0 — biar kelihatan
 * apa adanya, bukan ditutupin angka karangan.
 */

export const XP_PER_LEVEL = 1000;

export type TargetLevel = "N1" | "N2" | "N3" | "N4" | "N5";

export interface UserStats {
  streak: number;
  /** Nomor level, dihitung dari total XP. User baru = 1, bukan 8. */
  level: number;
  /** XP total sepanjang masa. */
  xpTotal: number;
  /** Sisa XP di level sekarang — ini yang dipajang di bar "x / 1000 XP". */
  xp: number;
  xpTarget: number;
  /** Level yang dipilih user waktu onboarding / di Pengaturan. */
  targetLevel: TargetLevel;
  isPro: boolean;
  /** Tanggal ujian pilihan user (ISO). null = belum diisi / sengaja "none". */
  examDate: string | null;
  initial: string;
  /** false selama data profil belum kebaca — buat nahan render angka 0 sekejap. */
  loaded: boolean;
}

const AWAL: UserStats = {
  streak: 0,
  level: 1,
  xpTotal: 0,
  xp: 0,
  xpTarget: XP_PER_LEVEL,
  targetLevel: "N3",   // samain sama default kolom profiles.target_level
  isPro: false,
  examDate: null,
  initial: "Y",
  loaded: false,
};

export function useUserStats(): UserStats {
  const [stats, setStats] = useState<UserStats>(AWAL);

  useEffect(() => {
    let batal = false;

    async function muat() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || batal) return;

      const { data: profil } = await supabase
        .from("profiles")
        .select("username, target_level, xp, streak, is_premium")
        .eq("id", user.id)
        .single();
      if (batal) return;

      const xp = profil?.xp ?? 0;
      const nama = profil?.username || user.user_metadata?.full_name || user.email || "Y";

      /* Level target: user_metadata DULUAN, baru tabel profiles.
         Bukan selera — begini kenyataannya:
           · trigger handle_new_user() cuma nyalin `username`, jadi
             profiles.target_level selalu keisi default kolom ('N3')
           · onboarding nyimpen pilihan user lewat auth.updateUser({data})
         Akibatnya 31 dari 46 user punya profiles='N3' padahal milih N1/N2/N4/N5.
         Metadata itu yang beneran dipilih user, jadi itu yang dipercaya. */
      // Onboarding nyimpen "none" kalau user milih belum nentuin tanggal.
      const mdExam = user.user_metadata?.exam_date;
      const examDate = typeof mdExam === "string" && mdExam && mdExam !== "none" ? mdExam : null;

      const mdLevel = user.user_metadata?.target_level as TargetLevel | undefined;
      const targetLevel = mdLevel ?? (profil?.target_level as TargetLevel) ?? "N3";

      setStats({
        streak: profil?.streak ?? 0,
        // XP jalan terus lintas level; yang ditampilin sisa di level sekarang.
        level: Math.floor(xp / XP_PER_LEVEL) + 1,
        xpTotal: xp,
        xp: xp % XP_PER_LEVEL,
        xpTarget: XP_PER_LEVEL,
        targetLevel,
        // Whitelist email ATAU flag hasil bayar — logikanya udah ada di access.ts,
        // jangan ditulis ulang di sini biar gak beda-beda antar halaman.
        isPro: hasProAccess(user.email, profil?.is_premium),
        examDate,
        initial: String(nama)[0].toUpperCase(),
        loaded: true,
      });
    }

    muat();
    return () => { batal = true; };
  }, []);

  return stats;
}
