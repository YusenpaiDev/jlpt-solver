/**
 * Hitungan dasbor admin — fungsi murni, tanpa akses DB (dites di
 * tests/admin-hitung.test.mjs). Yang ngambil data: data.ts (server-only).
 * "Hari ini" = tanggal WIB, karena user-nya di Indonesia.
 */

const HARI = 86_400_000;

/** `daftar` = isi env ADMIN_EMAILS (dipisah koma). Kosong = gak ada admin. */
export function apakahAdmin(email: string | null | undefined, daftar: string | null | undefined): boolean {
  if (!email || !daftar) return false;
  const izin = daftar.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  return izin.includes(email.trim().toLowerCase());
}

export function tanggalWIB(d: Date): string {
  return new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/** n tanggal WIB terakhir, urut lama → baru, diakhiri hari ini. */
function barisHari(kini: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => tanggalWIB(new Date(kini.getTime() - (n - 1 - i) * HARI)));
}

function hitungPerHari(tanggal: string[], kini: Date, n = 30) {
  const hitung = new Map<string, number>();
  for (const t of tanggal) hitung.set(t, (hitung.get(t) ?? 0) + 1);
  return barisHari(kini, n).map(t => ({ tanggal: t, n: hitung.get(t) ?? 0 }));
}

export type PerHari = { tanggal: string; n: number }[];

export function ringkasUser(
  users: { id: string; created_at: string; onboarding: boolean }[],
  profil: { id: string; target_level: string | null }[],
  aktivitas: { user_id: string; tanggal: string }[],
  kini: Date,
) {
  const umur = (iso: string) => kini.getTime() - Date.parse(iso);
  const hariIni = tanggalWIB(kini);
  const awal7 = tanggalWIB(new Date(kini.getTime() - 6 * HARI));
  const perLevel: Record<string, number> = {};
  for (const p of profil) if (p.target_level) perLevel[p.target_level] = (perLevel[p.target_level] ?? 0) + 1;
  return {
    total: users.length,
    baru7: users.filter(u => umur(u.created_at) < 7 * HARI).length,
    baru30: users.filter(u => umur(u.created_at) < 30 * HARI).length,
    aktifHariIni: new Set(aktivitas.filter(a => a.tanggal === hariIni).map(a => a.user_id)).size,
    aktif7: new Set(aktivitas.filter(a => a.tanggal >= awal7 && a.tanggal <= hariIni).map(a => a.user_id)).size,
    belumOnboarding: users.filter(u => !u.onboarding).length,
    perLevel,
    daftarPerHari: hitungPerHari(users.map(u => tanggalWIB(new Date(u.created_at))), kini),
  };
}

export function ringkasUang(
  tx: { order_id: string; paket_id: string; jumlah: number; status: string; dibuat: string }[],
  profil: { is_lifetime: boolean | null; premium_until: string | null; is_premium: boolean | null }[],
  whitelist: number,
  kini: Date,
) {
  const bulanIni = tanggalWIB(kini).slice(0, 7);
  const lunas = tx.filter(t => t.status === "lunas");
  const perStatus: Record<string, number> = {};
  for (const t of tx) perStatus[t.status] = (perStatus[t.status] ?? 0) + 1;
  const perPaket: Record<string, { n: number; rp: number }> = {};
  for (const t of lunas) {
    const p = (perPaket[t.paket_id] ??= { n: 0, rp: 0 });
    p.n += 1; p.rp += t.jumlah;
  }
  const sampai = (p: (typeof profil)[number]) => (p.premium_until ? Date.parse(p.premium_until) : NaN);
  const berbayar = profil.filter(p => !p.is_lifetime && (sampai(p) > kini.getTime() || !!p.is_premium));
  return {
    pendapatanTotal: lunas.reduce((s, t) => s + t.jumlah, 0),
    pendapatanBulanIni: lunas.filter(t => tanggalWIB(new Date(t.dibuat)).startsWith(bulanIni)).reduce((s, t) => s + t.jumlah, 0),
    perStatus,
    perPaket,
    lifetime: profil.filter(p => p.is_lifetime).length,
    proAktif: berbayar.length,
    segeraHabis: berbayar.filter(p => sampai(p) - kini.getTime() <= 7 * HARI).length,
    whitelist,
    /* Webhook Midtrans biasanya beberapa detik; PENDING > 1 jam = layak dicek. */
    pendingNyangkut: tx.filter(t => t.status === "pending" && kini.getTime() - Date.parse(t.dibuat) > 3_600_000).length,
  };
}

const FITUR_AI = ["chat", "furigana", "tugas-generate"] as const;

export function ringkasPemakaian(
  sesi: { user_id: string; title: string | null; total: number | null; score: number | null; created_at: string }[],
  usage: { user_id: string; tanggal: string; fitur: string; jumlah: number }[],
  kini: Date,
) {
  const hariIni = tanggalWIB(kini);
  const awal7 = tanggalWIB(new Date(kini.getTime() - 6 * HARI));
  const judul = new Map<string, number>();
  for (const s of sesi) if (s.title) judul.set(s.title, (judul.get(s.title) ?? 0) + 1);
  const ai: Record<string, { hariIni: number; minggu: number }> = {};
  for (const f of FITUR_AI) ai[f] = { hariIni: 0, minggu: 0 };
  for (const u of usage) {
    const a = (ai[u.fitur] ??= { hariIni: 0, minggu: 0 });
    if (u.tanggal === hariIni) a.hariIni += u.jumlah;
    if (u.tanggal >= awal7 && u.tanggal <= hariIni) a.minggu += u.jumlah;
  }
  return {
    setPerHari: hitungPerHari(sesi.map(s => tanggalWIB(new Date(s.created_at))), kini),
    /* Cuma set yang udah dinilai (score keisi) — set yang baru dibuka belum dijawab. */
    soalDijawab: sesi.filter(s => s.score != null).reduce((n, s) => n + (s.total ?? 0), 0),
    populer: [...judul].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([title, n]) => ({ title, n })),
    ai,
    penggunaAiHariIni: new Set(usage.filter(u => u.tanggal === hariIni && u.jumlah > 0).map(u => u.user_id)).size,
  };
}
