import type { Metadata } from "next";
import { HalamanLegal, EMAIL_DUKUNGAN, type Bagian } from "@/components/legal/HalamanLegal";
import { PAKET } from "@/lib/paket";
import { TRIAL_HARI } from "@/lib/batas-paket";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan · Sensei JLPT",
  description: "Aturan pakai Sensei JLPT: akun, masa percobaan, paket Pro, pembayaran, pengembalian dana, dan konten.",
};

const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

/* Angka harga & trial diambil dari sumbernya (paket.ts, batas-paket.ts) —
   jangan ditulis manual di sini. */
const BAGIAN: Bagian[] = [
  {
    id: "setuju", judul: "Persetujuan",
    isi: <p>Dengan membuat akun atau memakai Sensei JLPT, kamu setuju dengan Syarat &amp; Ketentuan ini dan <a href="/privasi">Kebijakan Privasi</a>. Kalau tidak setuju, mohon jangan memakai layanan ini.</p>,
  },
  {
    id: "akun", judul: "Akun",
    isi: <ul>
      <li>Satu akun untuk satu orang. Jangan berbagi akun atau menjual akses ke orang lain.</li>
      <li>Kamu bertanggung jawab menjaga akses ke email atau akun Google yang dipakai untuk masuk.</li>
      <li>Isi data dengan benar, terutama email — itu yang kami pakai untuk urusan akun dan pembayaran.</li>
    </ul>,
  },
  {
    id: "trial", judul: "Masa percobaan",
    isi: <p>Setiap akun mendapat masa percobaan <b>{TRIAL_HARI} hari</b> sejak akun dibuat, dengan akses penuh. Setelah masa percobaan habis, akses belajar berhenti sampai kamu berlangganan. Akun dan datamu tetap tersimpan.</p>,
  },
  {
    id: "paket", judul: "Paket & harga",
    isi: <>
      <ul>
        <li><b>{PAKET["pro-bulanan"].nama.replace("Sensei JLPT ", "")}</b> — {rp(PAKET["pro-bulanan"].harga)} untuk 1 bulan.</li>
        <li><b>{PAKET["pro-ujian"].nama.replace("Sensei JLPT ", "")}</b> — {rp(PAKET["pro-ujian"].harga)} untuk 6 bulan.</li>
        <li><b>Lifetime</b> — {rp(PAKET.lifetime.harga)}, sekali bayar, berlaku selama layanan Sensei JLPT beroperasi.</li>
      </ul>
      <p>Pro dan masa percobaan tidak dibatasi kuota harian, tapi tetap tunduk pada penggunaan wajar (bagian 7). Harga bisa berubah; perubahan tidak memengaruhi paket yang sudah kamu bayar.</p>
    </>,
  },
  {
    id: "bayar", judul: "Pembayaran",
    isi: <ul>
      <li>Pembayaran diproses oleh <b>Midtrans</b>. Di mutasi rekening, transaksi tercatat atas nama merchant <b>WILDbyZ</b>.</li>
      <li><b>Tidak ada perpanjangan atau tagihan otomatis.</b> Masa aktif habis sendiri kalau tidak diperpanjang.</li>
      <li>Pro aktif setelah pembayaran dikonfirmasi oleh Midtrans/bank. Biasanya beberapa detik, tapi transfer bank atau virtual account bisa butuh beberapa jam. <b>Jangan bayar ulang</b> selama menunggu.</li>
      <li>Memperpanjang sebelum masa aktif habis akan <b>menambah dari sisa</b> masa aktifmu, bukan menggantinya.</li>
    </ul>,
  },
  {
    id: "refund", judul: "Pengembalian dana",
    isi: <>
      <p>Karena ada masa percobaan gratis untuk mencoba semua fitur sebelum membayar, pembayaran yang sudah berhasil pada umumnya <b>tidak dapat dikembalikan</b>, kecuali:</p>
      <ul>
        <li>kamu terkena <b>pembayaran ganda</b> untuk pesanan yang sama, atau</li>
        <li>pembayaranmu berhasil tetapi Pro <b>tidak aktif karena kesalahan di sistem kami</b> dan tidak bisa kami perbaiki.</li>
      </ul>
      <p>Ajukan lewat email ke <a href={`mailto:${EMAIL_DUKUNGAN}`}>{EMAIL_DUKUNGAN}</a> dengan menyertakan <b>nomor pesanan</b>, paling lambat 14 hari setelah pembayaran. Dana dikembalikan lewat metode yang memungkinkan, sesuai ketentuan Midtrans dan bank.</p>
    </>,
  },
  {
    id: "wajar", judul: "Penggunaan wajar",
    isi: <>
      <p>Kamu setuju untuk tidak:</p>
      <ul>
        <li>menyalin, menyebarkan ulang, atau menjual soal, pembahasan, audio, atau materi dari Sensei JLPT;</li>
        <li>mengakses layanan dengan bot, skrip, atau cara otomatis lain, termasuk ke fitur AI;</li>
        <li>mencoba membobol keamanan, mengakses data orang lain, atau mengakali pembayaran dan masa percobaan;</li>
        <li>memakai fitur AI untuk konten yang melanggar hukum atau merugikan orang lain.</li>
      </ul>
      <p>Pelanggaran bisa membuat akses dibatasi atau akun dihentikan.</p>
    </>,
  },
  {
    id: "konten", judul: "Konten & hak cipta",
    isi: <ul>
      <li>Materi disediakan untuk <b>latihan pribadi</b>. Hak atas soal ujian, audio, dan bahan dari pihak lain tetap milik pemiliknya masing-masing.</li>
      <li>Sensei JLPT <b>tidak berafiliasi</b> dengan Japan Foundation, JEES, atau penyelenggara resmi JLPT.</li>
      <li>Isi yang kamu buat (kosakata, catatan) tetap milikmu; kamu mengizinkan kami menyimpan dan memprosesnya untuk menjalankan aplikasi.</li>
      <li>Kalau kamu pemilik hak atas suatu materi dan keberatan, hubungi kami — kami akan meninjau dan menurunkannya bila perlu.</li>
    </ul>,
  },
  {
    id: "ai", judul: "Fitur AI",
    isi: <p>Jawaban chat Sensei, furigana, dan lembar tugas dibuat oleh AI dan <b>bisa keliru</b>. Gunakan sebagai bantuan belajar, bukan sumber kebenaran mutlak. Kunci jawaban soal ujian mengikuti sumber resminya.</p>,
  },
  {
    id: "jaminan", judul: "Batasan tanggung jawab",
    isi: <p>Sensei JLPT membantu kamu berlatih, tetapi <b>tidak menjamin kelulusan</b> JLPT atau skor tertentu. Layanan disediakan apa adanya; kami berusaha menjaganya tetap berjalan, tetapi gangguan sesekali bisa terjadi. Sejauh diizinkan hukum, tanggung jawab kami terbatas pada jumlah yang kamu bayarkan untuk paket yang sedang aktif.</p>,
  },
  {
    id: "akhir", judul: "Perubahan & penghentian",
    isi: <p>Syarat ini bisa kami perbarui; tanggal berlaku di atas akan ikut berubah dan perubahan penting kami umumkan di aplikasi. Kamu bisa berhenti memakai layanan kapan saja dan meminta penghapusan akun lewat email. Syarat ini tunduk pada hukum Republik Indonesia.</p>,
  },
];

export default function SyaratKetentuan() {
  return (
    <HalamanLegal
      judul="Syarat & Ketentuan" jp="利用規約"
      ringkas={<p>Singkatnya: coba gratis {TRIAL_HARI} hari, lalu berlangganan kalau mau lanjut. Tanpa tagihan otomatis. Pembayaran lewat Midtrans atas nama WILDbyZ. Materi buat latihan pribadi, jangan disebar ulang. AI bisa keliru.</p>}
      bagian={BAGIAN}
      lain={{ href: "/privasi", label: "Kebijakan Privasi" }}
    />
  );
}
