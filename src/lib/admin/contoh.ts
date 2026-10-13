import { ringkasPemakaian, ringkasUang, ringkasUser, tanggalWIB } from "./hitung";
import type { DasborAdmin } from "./data";

/** Data karangan buat pratinjau dev (NEXT_PUBLIC_DEV_BYPASS_AUTH) — gak nyentuh DB. */
export function dasborContoh(kini = new Date()): DasborAdmin {
  const lalu = (h: number) => new Date(kini.getTime() - h * 86_400_000).toISOString();
  const users = Array.from({ length: 46 }, (_, i) => ({ id: `u${i}`, created_at: lalu((i * 7) % 60), onboarding: i % 6 !== 0 }));
  const profil = users.map((u, i) => ({
    id: u.id, target_level: ["N2", "N3", "N2", "N4", "N1", "N3", "N5"][i % 7],
    is_lifetime: i === 3, premium_until: i % 9 === 1 ? lalu(-(i % 12)) : null, is_premium: false,
  }));
  const aktivitas = users.flatMap((u, i) => Array.from({ length: i % 8 }, (_, h) => ({ user_id: u.id, tanggal: tanggalWIB(new Date(lalu(h))) })));
  const tx = Array.from({ length: 14 }, (_, i) => ({
    order_id: `ORD-202610${String(13 - (i % 12)).padStart(2, "0")}-${(4096 + i * 37).toString(16).toUpperCase()}`,
    user_id: `u${i * 3}`, paket_id: ["pro-bulanan", "pro-ujian", "lifetime"][i % 3],
    jumlah: [129000, 594000, 1490000][i % 3], status: ["lunas", "lunas", "pending", "gagal", "lunas", "kadaluarsa"][i % 6],
    dibuat: lalu(i * 2.5),
  }));
  const judul = ["JLPT N2 — 2025年7月 過去問", "JLPT N3 — 2024年12月 過去問", "JLPT N2 — 2024年7月 過去問", "Lembar Tugas N3 文法", "JLPT N1 — 2023年12月 過去問"];
  const sesi = Array.from({ length: 120 }, (_, i) => ({
    user_id: `u${i % 30}`, title: judul[(i * i) % 5], total: 30 + (i % 5) * 10, score: i % 4 ? 20 + (i % 9) : null, created_at: lalu((i * 0.23) % 30),
  }));
  const usage = Array.from({ length: 40 }, (_, i) => ({
    user_id: `u${i % 15}`, tanggal: tanggalWIB(new Date(lalu(i % 7))), fitur: ["chat", "furigana", "tugas-generate"][i % 3], jumlah: 1 + (i % 6),
  }));
  const bankSoal: Record<string, Record<string, number>> = Object.fromEntries(["N1", "N2", "N3", "N4", "N5"].map((l, i) =>
    [l, { 文字: 40 - i * 5, 語彙: 60 - i * 8, 文法: 55 - i * 6, 読解: i === 4 ? 0 : 30 - i * 4 }]));
  return {
    dibuat: kini.toISOString(),
    user: ringkasUser(users, profil, aktivitas, kini),
    uang: {
      ...ringkasUang(tx, profil, 3, kini),
      terakhir: tx.slice(0, 10).map((t, i) => ({ ...t, email: `user${i}@contoh.id` })),
    },
    pemakaian: ringkasPemakaian(sesi, usage, kini),
    konten: { bankSoal, totalBankSoal: Object.values(bankSoal).reduce((s, k) => s + Object.values(k).reduce((a, b) => a + b, 0), 0), sesiReview: 4 },
  };
}
