# Riwayat dan progres latihan parsial

Masalah: beranda membuang bank soal `kind=materi` dengan `score=null`, walaupun `stats.answered` sudah terisi. Progres menampilkan sesi itu dalam log tetapi hanya menghitung sesi selesai untuk total dan akurasi kategori. Tanggal impor juga diperlakukan sebagai tanggal latihan.

Perubahan:
- Helper bersama menentukan sesi yang pernah dibahas, jumlah jawaban, skor, dan urutan aktivitas.
- Riwayat beranda, log, dan statistik memasukkan sesi parsial. Statusnya tetap sedang dikerjakan.
- Total soal pada progres/statistik menghitung jawaban yang sudah dibahas, bukan semua soal dalam bank impor. Statistik awal memakai periode Semua.
- Grafik aktivitas beranda/log membaca aktivitas_harian, sumber yang sama dengan streak.
- Simpan progres bank soal dan hasil choukai mencatat last_practiced_at. Waktu historis yang tidak pernah disimpan tidak dikarang: log menandainya belum tercatat.

Verifikasi: unit regression mencakup 63/74 parsial, impor belum disentuh, sesi lama selesai, dan urutan waktu latihan. Pembacaan langsung sesi N3 2010 dari screenshot mengonfirmasi data tersimpan dan helper memasukkannya dalam riwayat. Safari localhost menampilkan sesi parsial pada Riwayat Terakhir dan total log yang sesuai, serta hari aktif pada grafik.

Tidak ada jawaban pengguna atau tanggal historis yang ditimpa. Perubahan ini tidak mengubah paket langganan atau whitelist akun.

Tambahan verifikasi: pembacaan sesi dipaginasi agar sesi lama tidak tersembunyi oleh impor baru; akurasi dibobotkan per jawaban; aktivitas harian menggunakan aturan yang sama di beranda dan progres. Build produksi lolos dan 11 tes regresi lulus.
