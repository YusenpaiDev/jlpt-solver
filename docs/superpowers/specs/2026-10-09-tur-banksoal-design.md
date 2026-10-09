# Tur Bank Soal + pop-up blok teks

Status: disetujui di chat 2026-10-09 (lanjutan `2026-10-09-honix-tur-design.md`).

## Pop-up blok teks (`SeleksiAksi`)
Blok teks di kolom soal (`.af-main`) → bar: **Tanya Sensei** (isi kotak chat, gak langsung kirim), **Simpan ke Kamus** (isi kata + auto cara baca/arti; desktop = tab Kamus, <1024px = lembar bawah), **Catat** (form Catatan Baru keisi), **Salin**. Tanya & Catat cuma ≥1024px (panel kanan `hidden lg:flex`). Mati saat mode Coret, di input, atau >200 karakter. Bacaan furigana (<rt>) dibuang dari teks.

## Tur halaman
`HonixTur` jadi umum (`daftar`, `aksiAkhir`), sorotan bisa gabungan beberapa elemen, target di luar layar di-scroll ke tengah. `HonixTurHalaman id="banksoal"`: otomatis sekali **setelah** tur menu beres, putar ulang via tombol **?** di header. 12 langkah (`LANGKAH_BANKSOAL`): filter, SOAL/OPSI, REVIEW/EDIT, blok teks, jawaban & pembahasan (Simpan ke Kamus / Catatan), tab Sensei/Kamus/Catatan, Coret, timer & Keluar. Target gak kelihatan dilewati (HP: 9 langkah).

Data: `honix_settings.tur.halaman.banksoal` (ISO). Tanpa migration. Beranda gak disentuh.

Di luar cakupan: chat Sensei versi HP.
