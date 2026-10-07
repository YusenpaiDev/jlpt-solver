/**
 * Variasi pesan Honix (HANDOFF-honix §5). Dipilih acak tiap kali muncul,
 * tapi gak boleh sama dua kali berturut-turut di momen yang sama.
 *
 * Angka di pesan ({total}, {chat}, …) diisi pemanggil dari data asli lewat
 * `isi` — jangan di-hardcode.
 */

export const PESAN = {
  perfect: ["Sempurna! Honix sampai pakai ikat kepala.", "{total} dari {total}. Kamu siap ujian!", "Gak ada yang lolos. Hebat banget!"],
  hi: ["Mantap! Apinya makin nyala.", "Keren, hampir sempurna!", "Kamu lagi on fire hari ini.", "Pola-pola ini mulai nempel nih.", "Satu set lagi, makin mantap!"],
  mid: ["Lumayan! Cek dulu yang meleset, yuk.", "Udah lebih dari setengah. Lanjut!", "Yang salah itu bahan belajar terbaik.", "Tinggal sedikit lagi. Lihat pembahasannya, ya."],
  lo: ["Phoenix selalu bangkit lagi. Coba lagi?", "Gak apa-apa, salah itu bagian dari belajar.", "Soalnya emang licin. Pelan-pelan aja.", "Bangkit lagi, kali ini pasti lebih baik."],
  pro: ["Pro kamu udah nyala!", "Sekarang Honix bisa nemenin lebih lama.", "Siap! {chat} chat Sensei per hari."],
  proses: ["Tenang, pembayaranmu udah sampai.", "Honix lagi nungguin konfirmasi bank.", "Gak perlu bayar lagi, nanti nyala sendiri."],
  jatah: ["Honix tidur dulu, besok bangun lagi.", "Istirahat dulu. Materi lain masih bisa.", "Jatahnya habis, semangatnya jangan."],
  kosongRiwayat: ["Belum ada latihan di sini.", "Honix lagi baca-baca dulu.", "Riwayatmu masih kosong."],
  kosongCatatan: ["Belum ada catatan.", "Catatanmu masih bersih.", "Honix nunggu catatan pertamamu."],
  kosongFavorit: ["Belum ada kata favorit.", "Bintangnya masih kosong.", "Honix belum lihat favoritmu."],
  onboard: ["Hai, aku Honix! Aku temen belajarmu.", "Hai! Aku Honix. Yuk bareng sampai lulus JLPT.", "Halo! Aku Honix, siap nemenin kamu belajar."],
} as const;

/** Reaksi cepat: [judul, baris kedua]. Judul pertama "N benar beruntun" diisi pemanggil. */
export const PESAN_REAKSI = {
  ok: [["Lagi panas nih!", "Lanjutkan ritmenya."], ["Gak ada yang meleset.", "Keren banget."], ["Wah, lancar jaya!", "Terus begitu."], ["{n} benar beruntun!", "Apinya makin nyala."]],
  no: [["Tarik napas dulu.", "Pelan-pelan aja, gak dikejar waktu."], ["Gak apa-apa.", "Phoenix bangkit lagi, kamu juga."], ["Soal ini emang licin.", "Baca pembahasannya dulu, yuk."], ["Coba lebih santai.", "Fokus ke kata kuncinya."]],
} as const;

const terakhir = new Map<string, number>();

/** Indeks acak yang beda dari indeks terakhir di `momen` ini. */
function indeksAcak(momen: string, n: number): number {
  if (n <= 1) return 0;
  const lalu = terakhir.get(momen);
  let i = Math.floor(Math.random() * n);
  if (i === lalu) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
  terakhir.set(momen, i);
  return i;
}

export function pilihPesan(momen: keyof typeof PESAN, isi: Record<string, string | number> = {}): string {
  const daftar = PESAN[momen];
  const teks: string = daftar[indeksAcak(momen, daftar.length)];
  return teks.replace(/\{(\w+)\}/g, (m, k: string) => (k in isi ? String(isi[k]) : m));
}

export function pilihPesanReaksi(jenis: "ok" | "no", n: number): readonly [string, string] {
  const daftar = PESAN_REAKSI[jenis];
  const [a, b] = daftar[indeksAcak(`reaksi-${jenis}`, daftar.length)];
  return [a.replace("{n}", String(n)), b];
}
