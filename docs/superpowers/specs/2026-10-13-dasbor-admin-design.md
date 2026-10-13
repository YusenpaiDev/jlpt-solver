# Dasbor admin `/admin`

Status: disetujui di chat 2026-10-13. Tampilan polos (token yang ada), dipoles Codex belakangan.

## Akses
- Server component; `wajibAdmin()` cek email login ada di env `ADMIN_EMAILS` (dipisah koma, gak peka huruf besar). Bukan admin / env kosong → `notFound()` (fail closed, rute gak kelihatan ada).
- Data diambil di server pakai `SUPABASE_SECRET_KEY` lewat modul `server-only` (`src/lib/admin/data.ts`). Browser cuma dapat angka & daftar ringkas.
- Gak ada link di menu. `robots: noindex`. Proxy tetap wajib login.

## Isi (tanpa migration)
- **User:** total, baru 7/30 hari, aktif hari ini / 7 hari (`aktivitas_harian`), belum onboarding, sebaran level target, grafik daftar 30 hari.
- **Uang & Pro:** pendapatan bulan ini & total (LUNAS), transaksi per status & per paket, Pro aktif / Lifetime / habis ≤7 hari, whitelist, 10 transaksi terakhir (order_id penuh + email), PENDING > 1 jam (webhook macet).
- **Pemakaian:** set dikerjain per hari (30 hari), soal dijawab 30 hari, 8 set paling populer, pemakaian AI per fitur hari ini & 7 hari + jumlah penggunanya.
- **Konten:** bank soal per level × kategori, sesi yang punya soal ditandai REVIEW.
- Gak ada "error terakhir" — app belum nyatet error.

Tanggal "hari ini" pakai WIB. Semua query paralel; tabel besar dipaginasi (PostgREST cap 1000).

## Tes
`tests/admin-hitung.test.mjs` — `apakahAdmin`, `ringkasUser`, `ringkasUang`, `ringkasPemakaian` (fungsi murni di `src/lib/admin/hitung.ts`). Screenshot pakai data contoh.
