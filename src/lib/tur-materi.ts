import type { LangkahTur } from "./honix-tur";

/* Tur pop-up per halaman Materi / Kotoba / Bunpou: muncul otomatis sekali
   (HonixTurHalaman), nunjuk "ini loh" satu-satu. Target = `data-tur`; yang
   gak kelihatan (mis. level tanpa data "sering keluar") dilewati. */

export const LANGKAH_MATERI: LangkahTur[] = [
  { target: null, pose: "senang", judul: "Ini tempat hafalan", isi: "Kata (Kotoba) & pola kalimat (Bunpou) level-mu ada di sini. Aku tunjukin mulai dari mana, ±30 detik." },
  { target: "mt-sering", pose: "tunjuk", judul: "Mulai dari yang paling sering keluar", isi: "50 kata & 50 pola yang paling sering muncul di soal, dipecah paket 10. Satu paket ±4 menit." },
  { target: "mt-lanjut", pose: "baca", judul: "Lanjut dari terakhir", isi: "Kelompok yang terakhir kamu buka. Satu tombol, langsung latihan." },
  { target: "mt-pintu", pose: "tunjuk", judul: "Pintu cepat", isi: "Ulang yang sering salah, Latihan Kilat, sama bandingin pola yang rawan ketuker." },
  { target: "mt-panel", pose: "baca", judul: "Semua kata & pola", isi: "Daftar lengkap per kelompok. Klik kelompok buat lihat isinya, statusnya keisi sendiri dari latihanmu." },
];

export const LANGKAH_KOTOBA: LangkahTur[] = [
  { target: "kv-sering", pose: "tunjuk", judul: "🔥 Sering keluar", isi: "Saring ke 50 kata yang paling sering muncul di soal. Bingung mulai dari mana? Dari sini." },
  { target: "kv-sk", pose: "baca", judul: "Label \"di … soal\"", isi: "Kata ini muncul di sekian soal Bank Soal level-mu. Makin gede, makin penting dihafal duluan." },
  { target: "kv-flash", pose: "tunjuk", judul: "Flash satu kelompok", isi: "Kartu bolak-balik. Abis dibalik, pilih Tau atau Belum, statusnya langsung kecatat." },
  { target: "kv-kilat", pose: "terbang", judul: "Latihan Kilat", isi: "Soal pilih arti, 10 kata ±4 menit. Yang salah balik lagi besok." },
  { target: "kv-star", pose: "baca", judul: "Simpan ke Kamus", isi: "Tekan ☆ buat kata yang mau diulang. Semuanya kumpul di Kamus → FLASH." },
];

export const LANGKAH_BUNPOU: LangkahTur[] = [
  { target: "bv-sering", pose: "tunjuk", judul: "🔥 Sering keluar", isi: "Saring ke pola yang paling sering muncul di soal. Mulai dari sini biar hafalanmu kepakai." },
  { target: "bv-sk", pose: "baca", judul: "Label \"di … soal\"", isi: "Pola ini muncul di sekian soal Bank Soal level-mu. Makin gede, makin penting." },
  { target: "bv-drill", pose: "tunjuk", judul: "Drill satu kelompok", isi: "Latihan pola sekelompok fungsi (mis. sebab & alasan) sekaligus." },
  { target: "bv-warn", pose: "baca", judul: "⚠️ Rawan ketuker", isi: "Pola yang mirip satu sama lain. Klik polanya buat lihat pembeda & tips cepat." },
  { target: "bv-kilat", pose: "terbang", judul: "Latihan Kilat", isi: "Soal isian pola, 10 soal ±4 menit. Yang salah balik lagi besok." },
];
