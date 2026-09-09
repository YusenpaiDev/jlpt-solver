/**
 * Definisi paket berbayar — SATU sumber buat halaman harga dan API pembayaran.
 *
 * Sebelum file ini ada, keduanya punya daftar sendiri dan udah melenceng jauh:
 * halaman harga jual Pro Rp129rb / Lifetime Rp1,49jt, sementara
 * /api/payment/create masih kenal "pro-monthly" Rp49rb dan "sensei-yearly"
 * Rp799rb dari draft harga lama. Nol yang cocok — artinya tombol bayar mana pun
 * bakal kena "Plan tidak valid", dan kalaupun lolos, orang bisa ditagih harga
 * yang beda dari yang dia lihat.
 *
 * Harga cuma boleh diubah di sini.
 */

export interface Paket {
  id: PaketId;
  nama: string;
  /** Rupiah, bilangan bulat. Midtrans gak nerima pecahan. */
  harga: number;
  /** Berapa bulan akses Pro nambah. null = selamanya (Lifetime). */
  bulan: number | null;
  ringkas: string;
}

export const PAKET = {
  "pro-bulanan": {
    id: "pro-bulanan",
    nama: "Sensei JLPT Pro — Bulanan",
    harga: 129_000,
    bulan: 1,
    ringkas: "Akses Pro 1 bulan",
  },
  "pro-ujian": {
    id: "pro-ujian",
    nama: "Sensei JLPT Pro — Paket Ujian (6 bulan)",
    harga: 594_000,
    bulan: 6,
    ringkas: "Akses Pro 6 bulan · setara Rp 99.000/bulan",
  },
  lifetime: {
    id: "lifetime",
    nama: "Sensei JLPT Lifetime",
    harga: 1_490_000,
    bulan: null,
    ringkas: "Akses Pro selamanya",
  },
} as const satisfies Record<string, Paket>;

export type PaketId = "pro-bulanan" | "pro-ujian" | "lifetime";

export const adalahPaket = (id: unknown): id is PaketId =>
  typeof id === "string" && id in PAKET;

/** "Rp 129.000" */
export const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

/**
 * Order ID yang dikirim ke Midtrans.
 *
 * Sengaja TIDAK nyimpen potongan user id di sini. Versi lama bikin
 * `SJLPT-{8 karakter pertama uuid}-{plan}-{ts}`, lalu webhook-nya nyari user
 * pakai `LIKE '<8 karakter>%'` + `limit(1)` — dua user yang kebetulan prefix
 * UUID-nya sama bikin premium nyasar ke akun orang lain. Sekarang order id
 * cuma penanda, dan pemiliknya dicari lewat tabel `transaksi`.
 *
 * Midtrans batasi 50 karakter, alfanumerik + `-_.~`.
 */
export function buatOrderId(paketId: PaketId): string {
  const acak = Math.random().toString(36).slice(2, 10);
  return `SJLPT-${paketId}-${Date.now()}-${acak}`;
}
