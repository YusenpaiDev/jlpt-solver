# Trial tujuh hari dan Pro tanpa kuota

Aturan yang disetujui: tidak ada paket Free permanen. Trial berlangsung 168 jam sejak `auth.users.created_at`, termasuk akun lama. Pro aktif dan trial aktif tidak dibatasi kuota harian. Setelah trial atau Pro berakhir, akses belajar berhenti; akun, pembayaran, dan data tersimpan tetap ada.

Implementasi memeriksa akses pada proxy dan sebelum panggilan AI, gagal tertutup ketika status tidak dapat diverifikasi, serta mengganti pembatasan database dengan pemeriksaan entitlement. Hitungan penggunaan tetap dicatat. Status Pro berjangka mengikuti `premium_until`; lifetime dan akses manual/whitelist tetap didukung.

## Penerapan

1. Terapkan `supabase/migrations/20261011-trial-pro-unlimited.sql` setelah migrasi kuota-free, pembayaran, dan langganan. Migrasi dapat dijalankan ulang. Tidak mengubah tanggal daftar atau menghapus data.
2. Deploy perubahan aplikasi sesudah migrasi. Kedua langkah diperlukan; perubahan kode lokal saja tidak mengubah Vercel.
3. Periksa akun trial aktif, akun lama tanpa Pro, Pro aktif, dan Pro berakhir pada lingkungan deployment. Pastikan halaman langganan dan pembayaran tetap dapat dibuka.

Migrasi belum diterapkan ke Supabase produksi dan aplikasi belum dideploy dalam pekerjaan ini.

## Verifikasi lokal

- `node --test tests/akses-paket.test.mjs`: batas waktu trial, akun lama, Pro, tanggal tidak valid.
- `npx tsc --noEmit` dan ESLint pada file TypeScript yang berubah.
- PostgreSQL sementara: muat `tests/trial-pro-fixture.sql`, lalu migrasi dua kali, lalu `tests/trial-pro-access.sql` menggunakan `psql -v ON_ERROR_STOP=1`. Fixture hanya untuk database kosong sementara, jangan jalankan pada Supabase produksi. Pengujian membuktikan kuota 101 panggilan tidak dibatasi, 100 kosakata dapat disimpan, akses antar-akun ditolak, trial habis tepat 168 jam, Pro kedaluwarsa ditolak, lifetime tetap aktif, dan data tidak terhapus.

Bug seleksi teks Safari sebelumnya belum dinyatakan selesai; perubahan CSS terkait di working tree perlu verifikasi terpisah.
