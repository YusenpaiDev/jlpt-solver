import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ringkasPemakaian, ringkasUang, ringkasUser } from "./hitung";

/**
 * Data dasbor admin. Pakai SUPABASE_SECRET_KEY (lewatin RLS) — makanya
 * `server-only`: modul ini gak boleh pernah ke-bundle ke browser. Yang
 * dikirim ke halaman cuma angka jadi + daftar ringkas (DasborAdmin).
 */

const LEVEL = ["N1", "N2", "N3", "N4", "N5"] as const;
const KATEGORI = ["文字", "語彙", "文法", "読解"] as const;
const HARI = 86_400_000;

function klien() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SECRET_KEY!.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Hasil<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** PostgREST motong 1000 baris per query. Urutan WAJIB unik (lihat fix kamus
    dobel) — kalau nggak, baris bisa kebawa dua kali / kelewat antar halaman. */
async function semua<T>(buat: (dari: number, sampai: number) => Hasil<T>): Promise<T[]> {
  const out: T[] = [];
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await buat(dari, dari + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function ambilDasbor(kini = new Date()) {
  const sb = klien();
  const sejak30 = new Date(kini.getTime() - 30 * HARI).toISOString();
  const sejak30Tgl = sejak30.slice(0, 10);
  const sejak7Tgl = new Date(kini.getTime() - 8 * HARI).toISOString().slice(0, 10);

  const ambilUser = async () => {
    const out: { id: string; email: string | null; created_at: string; onboarding: boolean }[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      out.push(...data.users.map(u => ({
        id: u.id, email: u.email ?? null, created_at: u.created_at,
        onboarding: !!u.user_metadata?.onboarding_completed,
      })));
      if (data.users.length < 1000) return out;
    }
  };
  const hitungBankSoal = (level: string, kategori: string) =>
    sb.from("bank_soal").select("id", { count: "exact", head: true }).eq("level", level).eq("category", kategori)
      .then(({ count, error }) => { if (error) throw new Error(error.message); return count ?? 0; });

  const [users, profil, aktivitas, tx, whitelist, sesi, usage, bankSoal, sesiReview] = await Promise.all([
    ambilUser(),
    semua<{ id: string; target_level: string | null; is_lifetime: boolean | null; premium_until: string | null; is_premium: boolean | null }>(
      (a, b) => sb.from("profiles").select("id, target_level, is_lifetime, premium_until, is_premium").order("id").range(a, b)),
    semua<{ user_id: string; tanggal: string }>(
      (a, b) => sb.from("aktivitas_harian").select("user_id, tanggal").gte("tanggal", sejak30Tgl)
        .order("tanggal").order("user_id").range(a, b)),
    semua<{ order_id: string; user_id: string; paket_id: string; jumlah: number; status: string; dibuat: string }>(
      (a, b) => sb.from("transaksi").select("order_id, user_id, paket_id, jumlah, status, dibuat")
        .order("dibuat", { ascending: false }).order("order_id").range(a, b)),
    sb.from("pro_whitelist").select("email", { count: "exact", head: true })
      .then(({ count, error }) => { if (error) throw new Error(error.message); return count ?? 0; }),
    semua<{ user_id: string; title: string | null; total: number | null; score: number | null; created_at: string }>(
      (a, b) => sb.from("sessions").select("user_id, title, total, score, created_at").gte("created_at", sejak30)
        .order("created_at").order("id").range(a, b)),
    semua<{ user_id: string; tanggal: string; fitur: string; jumlah: number }>(
      (a, b) => sb.from("ai_usage").select("user_id, tanggal, fitur, jumlah").gte("tanggal", sejak7Tgl)
        .order("tanggal").order("user_id").order("fitur").range(a, b)),
    Promise.all(LEVEL.map(async l => [l, Object.fromEntries(await Promise.all(
      KATEGORI.map(async k => [k, await hitungBankSoal(l, k)] as const)))] as const)),
    /* Soal yang ditandai REVIEW ada di dalam jsonb sesi — dihitung sesinya. */
    sb.from("sessions").select("id", { count: "exact", head: true })
      .contains("ai_result->questions", [{ needs_review: true }])
      .then(({ count, error }) => (error ? null : count ?? 0)),
  ]);

  /* Pencatat error (migration 20261101-error-log.sql). Tabel belum ada → null. */
  const sejak24 = new Date(kini.getTime() - HARI).toISOString();
  const [errHitung, errTerbaru] = await Promise.all([
    sb.from("error_log").select("id", { count: "exact", head: true }).gte("waktu", sejak24),
    sb.from("error_log").select("waktu, sumber, pesan, path, rute").order("waktu", { ascending: false }).limit(10),
  ]);
  const error = errHitung.error || errTerbaru.error ? null : {
    hari: errHitung.count ?? 0,
    terbaru: (errTerbaru.data ?? []) as { waktu: string; sumber: string; pesan: string; path: string | null; rute: string | null }[],
  };

  const emailDari = new Map(users.map(u => [u.id, u.email]));
  const bankSoalPerLevel = Object.fromEntries(bankSoal) as Record<string, Record<string, number>>;
  return {
    dibuat: kini.toISOString(),
    user: ringkasUser(users, profil, aktivitas, kini),
    uang: {
      ...ringkasUang(tx, profil, whitelist, kini),
      terakhir: tx.slice(0, 10).map(t => ({ ...t, email: emailDari.get(t.user_id) ?? null })),
    },
    pemakaian: ringkasPemakaian(sesi, usage, kini),
    konten: {
      bankSoal: bankSoalPerLevel,
      totalBankSoal: Object.values(bankSoalPerLevel).reduce((s, k) => s + Object.values(k).reduce((a, b) => a + b, 0), 0),
      sesiReview,
    },
    error,
  };
}

export type DasborAdmin = Awaited<ReturnType<typeof ambilDasbor>>;
