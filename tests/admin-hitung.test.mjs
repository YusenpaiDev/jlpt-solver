import assert from "node:assert/strict";
import test from "node:test";
import { apakahAdmin, ringkasUser, ringkasUang, ringkasPemakaian, tanggalWIB } from "../src/lib/admin/hitung.ts";

const kini = new Date("2026-10-13T05:00:00Z"); // 12.00 WIB
const lalu = h => new Date(kini.getTime() - h * 86_400_000).toISOString();

test("admin: cocok email di daftar, gak peka huruf besar; daftar kosong = gak ada admin", () => {
  assert.equal(apakahAdmin("Yusuf@Mail.com", "a@b.com, yusuf@mail.com"), true);
  assert.equal(apakahAdmin("orang@mail.com", "yusuf@mail.com"), false);
  assert.equal(apakahAdmin("yusuf@mail.com", ""), false);
  assert.equal(apakahAdmin("yusuf@mail.com", undefined), false);
  assert.equal(apakahAdmin(null, "yusuf@mail.com"), false);
  assert.equal(apakahAdmin("", " , "), false);
});

test("tanggal WIB: lewat tengah malam WIB udah ganti hari", () => {
  assert.equal(tanggalWIB(new Date("2026-10-12T17:30:00Z")), "2026-10-13");
  assert.equal(tanggalWIB(new Date("2026-10-12T16:30:00Z")), "2026-10-12");
});

test("ringkasUser: total, baru, aktif, onboarding, level, grafik 30 hari", () => {
  const users = [
    { id: "a", created_at: lalu(1), onboarding: true },
    { id: "b", created_at: lalu(10), onboarding: false },
    { id: "c", created_at: lalu(40), onboarding: true },
  ];
  const profil = [{ id: "a", target_level: "N2" }, { id: "b", target_level: "N2" }, { id: "c", target_level: "N3" }];
  const aktivitas = [
    { user_id: "a", tanggal: "2026-10-13" }, { user_id: "a", tanggal: "2026-10-12" },
    { user_id: "c", tanggal: "2026-10-09" }, { user_id: "b", tanggal: "2026-09-01" },
  ];
  const r = ringkasUser(users, profil, aktivitas, kini);
  assert.equal(r.total, 3);
  assert.equal(r.baru7, 1);
  assert.equal(r.baru30, 2);
  assert.equal(r.aktifHariIni, 1);
  assert.equal(r.aktif7, 2);
  assert.equal(r.belumOnboarding, 1);
  assert.deepEqual(r.perLevel, { N2: 2, N3: 1 });
  assert.equal(r.daftarPerHari.length, 30);
  assert.equal(r.daftarPerHari.at(-1).tanggal, "2026-10-13");
  assert.equal(r.daftarPerHari.reduce((s, d) => s + d.n, 0), 2);
});

test("ringkasUang: pendapatan cuma LUNAS, bulan ini, Pro, pending nyangkut", () => {
  const tx = [
    { order_id: "1", paket_id: "pro-bulanan", jumlah: 129000, status: "lunas", dibuat: "2026-10-02T00:00:00Z" },
    { order_id: "2", paket_id: "lifetime", jumlah: 1490000, status: "lunas", dibuat: "2026-09-20T00:00:00Z" },
    { order_id: "3", paket_id: "pro-bulanan", jumlah: 129000, status: "pending", dibuat: "2026-10-13T03:00:00Z" },
    { order_id: "4", paket_id: "pro-bulanan", jumlah: 129000, status: "pending", dibuat: "2026-10-13T04:30:00Z" },
    { order_id: "5", paket_id: "pro-ujian", jumlah: 594000, status: "gagal", dibuat: "2026-10-05T00:00:00Z" },
  ];
  const profil = [
    { is_lifetime: true, premium_until: null, is_premium: false },
    { is_lifetime: false, premium_until: lalu(-3), is_premium: false },
    { is_lifetime: false, premium_until: lalu(-20), is_premium: false },
    { is_lifetime: false, premium_until: lalu(2), is_premium: false },
  ];
  const r = ringkasUang(tx, profil, 2, kini);
  assert.equal(r.pendapatanTotal, 1619000);
  assert.equal(r.pendapatanBulanIni, 129000);
  assert.deepEqual(r.perStatus, { lunas: 2, pending: 2, gagal: 1 });
  assert.deepEqual(r.perPaket["pro-bulanan"], { n: 1, rp: 129000 });
  assert.equal(r.lifetime, 1);
  assert.equal(r.proAktif, 2);
  assert.equal(r.segeraHabis, 1);
  assert.equal(r.whitelist, 2);
  assert.equal(r.pendingNyangkut, 1);
});

test("ringkasPemakaian: set per hari, soal dijawab, populer, AI per fitur", () => {
  const sesi = [
    { user_id: "a", title: "N2 2025年7月", total: 71, score: 50, created_at: lalu(0) },
    { user_id: "b", title: "N2 2025年7月", total: 71, score: null, created_at: lalu(1) },
    { user_id: "a", title: "N3 2024年12月", total: 60, score: 40, created_at: lalu(3) },
  ];
  const usage = [
    { user_id: "a", tanggal: "2026-10-13", fitur: "chat", jumlah: 4 },
    { user_id: "b", tanggal: "2026-10-13", fitur: "chat", jumlah: 2 },
    { user_id: "a", tanggal: "2026-10-10", fitur: "furigana", jumlah: 7 },
  ];
  const r = ringkasPemakaian(sesi, usage, kini);
  assert.equal(r.setPerHari.length, 30);
  assert.equal(r.setPerHari.at(-1).n, 1);
  assert.equal(r.soalDijawab, 131);
  assert.deepEqual(r.populer[0], { title: "N2 2025年7月", n: 2 });
  assert.deepEqual(r.ai.chat, { hariIni: 6, minggu: 6 });
  assert.deepEqual(r.ai.furigana, { hariIni: 0, minggu: 7 });
  assert.equal(r.penggunaAiHariIni, 2);
});
