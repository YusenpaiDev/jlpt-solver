"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProAccess } from "@/lib/access";
import { tanggalLokal } from "@/lib/aktivitas";
import { EVENT_XP_TERSIMPAN, XP_PER_LEVEL } from "@/lib/honix-level";

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

/* Mode dev tanpa login (lihat src/lib/dev-beranda.ts). Sengaja ditulis
   langsung di file ini, bukan diimport: Next cuma bisa ganti env jadi
   literal & buang cabangnya kalau ekspresinya ada di modul yang sama. */
const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";

export { XP_PER_LEVEL } from "@/lib/honix-level";

export type TargetLevel = "N1" | "N2" | "N3" | "N4" | "N5";

export interface UserStats {
  streak: number;
  /** Streak terpanjang sepanjang masa (streak_saya().terpanjang). */
  rekor: number;
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
  /** Kapan akses Pro habis. null = gak punya langganan berjangka. */
  premiumUntil: string | null;
  /** Lifetime: gak punya tanggal habis sama sekali. */
  isLifetime: boolean;
  /** Tanggal ujian pilihan user (ISO). null = belum diisi / sengaja "none". */
  examDate: string | null;
  initial: string;
  /** false selama data profil belum kebaca — buat nahan render angka 0 sekejap. */
  loaded: boolean;
}

const AWAL: UserStats = {
  streak: 0,
  rekor: 0,
  level: 1,
  xpTotal: 0,
  xp: 0,
  xpTarget: XP_PER_LEVEL,
  targetLevel: "N3",   // samain sama default kolom profiles.target_level
  isPro: false,
  premiumUntil: null,
  isLifetime: false,
  examDate: null,
  initial: "Y",
  loaded: false,
};

/* Data contoh buat mode dev tanpa login (lihat src/lib/dev-beranda.ts). */
const DEV_STATS: UserStats = {
  ...AWAL, streak: 13, rekor: 23, level: 8, xpTotal: 7820, xp: 820, targetLevel: "N2",
  examDate: "2026-12-06", initial: "Y", loaded: true,
};

export function useUserStats(): UserStats {
  const [stats, setStats] = useState<UserStats>(DEV_BYPASS ? DEV_STATS : AWAL);

  useEffect(() => {
    if (DEV_BYPASS) return;
    let batal = false;

    async function muat() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || batal) return;

      const { data: profil } = await supabase
        .from("profiles")
        .select("username, target_level, xp, streak, is_premium, premium_until, is_lifetime")
        .eq("id", user.id)
        .single();
      if (batal) return;

      const isPro = await fetchProAccess(supabase);
      if (batal) return;

      /* Streak dari aktivitas nyata, bukan kolom profiles.streak. Kolom itu
         dulu dinaikin di <Sidebar> — komponen yang gak dirender halaman mana
         pun — jadi isinya angka beku yang gak nyambung sama apa pun. */
      const { data: st } = await supabase.rpc("streak_saya", { p_hari_ini: tanggalLokal() });
      const streakBaris = Array.isArray(st) ? st[0] : st;
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
        streak: streakBaris?.sekarang ?? 0,
        rekor: streakBaris?.terpanjang ?? 0,
        // XP jalan terus lintas level; yang ditampilin sisa di level sekarang.
        level: Math.floor(xp / XP_PER_LEVEL) + 1,
        xpTotal: xp,
        xp: xp % XP_PER_LEVEL,
        xpTarget: XP_PER_LEVEL,
        targetLevel,
        // Diputusin Postgres lewat is_pro() — flag bayar ATAU whitelist.
        // Jangan hitung ulang dari email di sini: daftarnya udah gak ada di
        // client, dan entitlement yang dihitung di browser gampang dipalsuin.
        isPro,
        premiumUntil: (profil?.premium_until as string | null) ?? null,
        isLifetime: profil?.is_lifetime === true,
        examDate,
        initial: String(nama)[0].toUpperCase(),
        loaded: true,
      });
    }

    muat();
    window.addEventListener(EVENT_XP_TERSIMPAN, muat);
    return () => { batal = true; window.removeEventListener(EVENT_XP_TERSIMPAN, muat); };
  }, []);

  return stats;
}
