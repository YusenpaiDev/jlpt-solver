import { tanggalLokal } from "@/lib/aktivitas";

/**
 * Data contoh Beranda buat mode dev tanpa login — HANYA buat cek visual
 * lokal (screenshot Playwright).
 *
 * Nyala kalau `next dev` DAN NEXT_PUBLIC_DEV_BYPASS_AUTH=1 (konstanta
 * DEV_BYPASS di proxy.ts, use-user-stats.ts, page.tsx). Di `next build`
 * NODE_ENV = "production", jadi cabangnya dibuang bundler dan file ini gak
 * ikut ke bundle — walau env-nya kebawa ke Vercel.
 *
 * ?dev=naik   → aktif hari ini, banner streak naik
 * ?dev=baru   → user baru, semua kosong (kartu Kanji Sering Salah hilang)
 */
export interface BerandaMentah {
  email: string;
  nama: string;
  avatar: string | null;
  sessions: Record<string, unknown>[];
  kotobaTotal: number | null;
  kotobaMingguIni: number | null;
  aktifTerakhir: string | null;
  kotobaProgres: { word: string; benar: number; salah: number }[];
  bunpouProgres: { pattern: string; benar: number; salah: number }[];
}

export function devBeranda(mode: string | null, deck: { kata: string[]; pola: string[] }): BerandaMentah {
  const kini = Date.now();
  const iso = (hariLalu: number, jam = 20) => {
    const d = new Date(kini - hariLalu * 86_400_000); d.setHours(jam, 14, 0, 0); return d.toISOString();
  };
  const tgl = (hariLalu: number) => tanggalLokal(new Date(kini - hariLalu * 86_400_000));

  if (mode === "baru") {
    return { email: "dev@lokal", nama: "Yusuf", avatar: null, sessions: [], kotobaTotal: 0, kotobaMingguIni: 0,
      aktifTerakhir: null, kotobaProgres: [], bunpouProgres: [] };
  }

  const sesi = (id: string, title: string, category: string, total: number, score: number | null, hariLalu: number, perCat: Record<string, { a: number; c: number }>, extra: Record<string, unknown> = {}) => ({
    id, level: "N2", category, title, total, score, created_at: iso(hariLalu),
    stats: { answered: Object.values(perCat).reduce((s, v) => s + v.a, 0), correct: Object.values(perCat).reduce((s, v) => s + v.c, 0), perCat },
    ...extra,
  });
  const sessions = [
    sesi("dev-1", "2024年12月 筆記", "読解", 75, null, 1, { "読解": { a: 30, c: 17 }, "文法": { a: 12, c: 9 } }),
    sesi("dev-2", "2024年12月 筆記 · retry", "読解", 75, 61, 0, { "読解": { a: 40, c: 23 }, "文字": { a: 20, c: 18 }, "語彙": { a: 15, c: 12 } }),
    sesi("dev-3", "文法問題 #14", "文法", 8, 5, 0, { "文法": { a: 8, c: 5 } }),
    sesi("dev-4", "2016年12月 聴解", "読解", 11, 9, 0, { "聴解": { a: 11, c: 9 } }, { section: "choukai" }),
    sesi("dev-5", "Drill Bunpou N2", "文法", 10, 9, 2, { "文法": { a: 10, c: 9 } }),
    sesi("dev-6", "Drill Kotoba N2", "語彙", 20, 16, 3, { "語彙": { a: 20, c: 16 } }),
    sesi("dev-7", "2023年7月 筆記", "文字", 104, 90, 5, { "文字": { a: 104, c: 94 }, "聴解": { a: 56, c: 47 } }),
    sesi("dev-8", "Drill Bunpou N2", "文法", 173, 120, 9, { "文法": { a: 173, c: 120 }, "語彙": { a: 121, c: 98 }, "読解": { a: 19, c: 11 } }),
  ];

  /* Kata sering salah — kanjinya sengaja mirip (挑/桃/跳) kayak di mock. */
  const salah = [
    { word: "挑戦", benar: 1, salah: 3 }, { word: "挑む", benar: 0, salah: 2 },
    { word: "桃色", benar: 1, salah: 2 }, { word: "跳ぶ", benar: 0, salah: 2 },
    { word: "跳躍", benar: 1, salah: 1 },
  ];
  const kotobaProgres = [
    ...deck.kata.slice(0, 466).map((word, i) => ({ word, benar: 2 + (i % 3), salah: i % 7 === 0 ? 1 : 0 })),
    ...salah,
  ];
  const bunpouProgres = deck.pola.slice(0, 78).map((pattern, i) =>
    i % 9 === 0 ? { pattern, benar: 1, salah: 3 } : { pattern, benar: 3, salah: 0 });

  return {
    email: "dev@lokal", nama: "Yusuf", avatar: null, sessions,
    kotobaTotal: 453, kotobaMingguIni: 38,
    aktifTerakhir: mode === "tidur" ? tgl(4) : mode === "naik" ? tgl(0) : tgl(1),
    kotobaProgres, bunpouProgres,
  };
}
