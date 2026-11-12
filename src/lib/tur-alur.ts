import type { HonixPose } from "./honix-pose";

/* Tur Honix 7 langkah, ikut alur belajar (HANDOFF-alur-belajar §5).
   `target` = nilai `data-tur` (desktop & HP pakai nama yang sama: rail di
   desktop, bar bawah di HP). Langkah yang targetnya gak kelihatan dilewati
   (mis. strip 26 minggu selama kurikulum belum live). Gak otomatis muncul —
   dibuka dari Pengaturan. */
export interface LangkahAlur { target: string; pose: HonixPose; judul: string; isi: string; tahap?: string }

export const LANGKAH_ALUR: LangkahAlur[] = [
  { target: "misi", pose: "tunjuk", judul: "Mulai dari sini, tiap hari", isi: "Misi hari ini. Ini satu-satunya yang wajib. Buka Honix, kerjain misi, selesai." },
  { target: "misi-langkah", pose: "baca", judul: "Isinya udah dicampur", isi: "Ulang yang mulai lupa, materi baru, lalu latihan soal. Tiap langkah ada alasannya, biar kamu tahu kenapa item itu muncul.", tahap: "Tahap 1 · 2 · 3" },
  { target: "strip", pose: "terbang", judul: "Kurikulum yang ngatur urutan", isi: "Strip ini 26 minggu sampai ujian. Tiap minggu satu unit. Isi misimu ikut minggu ke berapa kamu sekarang." },
  { target: "progres", pose: "tunjuk", judul: "Senin: cek yang nempel", isi: "Tiap Senin ada ulangan ±10 menit di kartu misi. Hasilnya dan perkiraan skormu bisa dilihat di Progres.", tahap: "Tahap 4" },
  { target: "latihan", pose: "lulus", judul: "Sebulan sekali: kayak ujian", isi: "Simulasi pakai set latihan format JLPT di menu Latihan. Di situ juga ada Lembar Tugas buat latihan bebas.", tahap: "Tahap 5" },
  { target: "materi", pose: "baca", judul: "Perpustakaan buat jalan sendiri", isi: "Materi, Latihan, dan Kamus selalu kebuka. Gak wajib. Misi tetap jalan walau kamu main di sini." },
  { target: "bantuan", pose: "senang", judul: "Lupa? Tanya di sini", isi: "Tombol ? ini buka penjelasan cara belajar kapan aja. Udah, yuk mulai misi!" },
];

/** Query buat buka tur dari halaman lain (Pengaturan → Beranda). */
export const PARAM_TUR = "tur";
