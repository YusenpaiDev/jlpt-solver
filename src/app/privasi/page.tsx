import type { Metadata } from "next";
import { HalamanLegal, EMAIL_DUKUNGAN, type Bagian } from "@/components/legal/HalamanLegal";

export const metadata: Metadata = {
  title: "Kebijakan Privasi · Sensei JLPT",
  description: "Data apa yang disimpan Sensei JLPT, dipakai buat apa, dibagikan ke siapa, dan cara menghapusnya.",
};

/* Isinya HARUS sesuai yang beneran dilakukan app. Nambah layanan pihak ketiga,
   analytics, atau data baru → update halaman ini juga. */
const BAGIAN: Bagian[] = [
  {
    id: "pengelola", judul: "Siapa kami",
    isi: <p>Sensei JLPT adalah aplikasi web latihan JLPT. Pembayaran diproses atas nama merchant <b>WILDbyZ</b>. Kebijakan ini menjelaskan data apa yang kami simpan saat kamu memakai Sensei JLPT dan apa yang kami lakukan dengannya.</p>,
  },
  {
    id: "data", judul: "Data yang kami simpan",
    isi: <>
      <ul>
        <li><b>Akun:</b> email, nama, dan foto profil dari akun Google (kalau masuk pakai Google) atau email yang kamu daftarkan.</li>
        <li><b>Profil belajar:</b> level target, tanggal ujian, dan target belajar harian yang kamu isi saat onboarding atau di Pengaturan.</li>
        <li><b>Aktivitas belajar:</b> jawaban, skor, dan riwayat latihan; progres Kotoba &amp; Bunpou; hari aktif (streak) dan XP.</li>
        <li><b>Isi yang kamu buat:</b> kosakata di Kamus, catatan, soal yang kamu edit atau tandai review, dan foto profil yang kamu unggah.</li>
        <li><b>Pemakaian fitur AI:</b> jumlah pemakaian chat Sensei, furigana, dan lembar tugas per hari.</li>
        <li><b>Transaksi:</b> nomor pesanan, paket, nominal, status, waktu, dan notifikasi pembayaran dari Midtrans (buat audit). <b>Kami tidak menyimpan data kartu, rekening, atau PIN</b> — itu ditangani Midtrans.</li>
        <li><b>Pengaturan di perangkat:</b> beberapa preferensi (mis. pengaturan Honix, tutorial yang sudah dilihat) disimpan juga di browser kamu (localStorage) supaya aplikasi cepat terbuka.</li>
      </ul>
      <p>Kami <b>tidak</b> memakai iklan, pelacak analytics pihak ketiga, atau cookie iklan. Cookie yang ada hanya cookie login supaya kamu tetap masuk.</p>
    </>,
  },
  {
    id: "pemakaian", judul: "Dipakai buat apa",
    isi: <ul>
      <li>Menjalankan aplikasi: menyimpan progres, menampilkan riwayat &amp; statistik, menjaga streak.</li>
      <li>Fitur AI: menjawab pertanyaan di chat Sensei, membuat furigana, dan membuat lembar tugas.</li>
      <li>Mengatur akses: masa trial, status Pro, dan pembayaran.</li>
      <li>Menghubungi kamu soal akun atau pembayaran kalau diperlukan.</li>
      <li>Memperbaiki masalah teknis dan menjaga keamanan layanan.</li>
    </ul>,
  },
  {
    id: "pihak-ketiga", judul: "Layanan pihak ketiga",
    isi: <>
      <p>Kami tidak menjual data kamu. Data hanya diproses oleh penyedia layanan yang dibutuhkan untuk menjalankan aplikasi:</p>
      <ul>
        <li><b>Supabase</b> — database, login, dan penyimpanan file.</li>
        <li><b>Vercel</b> — server tempat aplikasi berjalan.</li>
        <li><b>Anthropic (Claude)</b> — model AI untuk chat Sensei, furigana, dan lembar tugas. Saat kamu memakai fitur ini, pertanyaanmu dan teks soal yang relevan dikirim ke Anthropic untuk diproses. Jangan masukkan data pribadi sensitif ke chat.</li>
        <li><b>Midtrans</b> — pemrosesan pembayaran.</li>
        <li><b>Google</b> — login dengan akun Google (kalau kamu memilihnya).</li>
      </ul>
      <p>Server penyedia layanan ini bisa berada di luar Indonesia.</p>
    </>,
  },
  {
    id: "simpan", judul: "Berapa lama disimpan",
    isi: <p>Data disimpan selama akunmu ada. Kalau trial atau langgananmu berakhir, data <b>tidak dihapus</b> — akses belajar saja yang berhenti, dan semuanya kembali saat kamu berlangganan. Catatan transaksi bisa kami simpan lebih lama untuk keperluan pembukuan dan penyelesaian sengketa pembayaran.</p>,
  },
  {
    id: "hak", judul: "Hak kamu",
    isi: <>
      <ul>
        <li><b>Melihat &amp; memperbaiki:</b> sebagian besar data bisa kamu lihat dan ubah langsung di aplikasi (Pengaturan, Kamus, Catatan).</li>
        <li><b>Meminta salinan data</b> atau <b>menghapus akun</b>: kirim email ke <a href={`mailto:${EMAIL_DUKUNGAN}`}>{EMAIL_DUKUNGAN}</a> dari email akunmu. Kami proses paling lambat 30 hari. Penghapusan akun menghapus profil, progres, kosakata, dan catatan; catatan transaksi bisa tetap disimpan sesuai bagian sebelumnya.</li>
      </ul>
    </>,
  },
  {
    id: "keamanan", judul: "Keamanan",
    isi: <p>Koneksi ke aplikasi memakai HTTPS. Setiap akun hanya bisa membaca datanya sendiri (dikunci di tingkat database). Kunci rahasia layanan hanya ada di server. Tidak ada sistem yang 100% aman — kalau kamu menemukan celah, mohon kabari kami lewat email.</p>,
  },
  {
    id: "anak", judul: "Pengguna di bawah umur",
    isi: <p>Kalau kamu belum berusia 18 tahun, gunakan Sensei JLPT dan lakukan pembayaran dengan sepengetahuan orang tua atau wali.</p>,
  },
  {
    id: "perubahan", judul: "Perubahan kebijakan",
    isi: <p>Kebijakan ini bisa kami perbarui. Tanggal berlaku di atas akan ikut berubah, dan perubahan penting akan kami umumkan di aplikasi.</p>,
  },
];

export default function KebijakanPrivasi() {
  return (
    <HalamanLegal
      judul="Kebijakan Privasi" jp="個人情報"
      ringkas={<p>Singkatnya: kami simpan data akun, progres belajar, dan transaksi supaya aplikasinya jalan. Tanpa iklan dan tanpa pelacak. Pertanyaan ke chat Sensei diproses AI Anthropic. Mau hapus akun? Email kami.</p>}
      bagian={BAGIAN}
      lain={{ href: "/syarat", label: "Syarat & Ketentuan" }}
    />
  );
}
