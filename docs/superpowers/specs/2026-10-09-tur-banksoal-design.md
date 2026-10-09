# Tur Bank Soal + pop-up blok teks

Status: disetujui di chat 2026-10-09 (lanjutan `2026-10-09-honix-tur-design.md`).

## Pop-up blok teks (`SeleksiAksi`)
Blok teks di kolom soal (`.af-main`) → bar: **Tanya Sensei** (isi kotak chat, gak langsung kirim), **Simpan ke Kamus** (isi kata + auto cara baca/arti di tab Kamus), **Catat** (form Catatan Baru keisi), **Salin**. Mati saat mode Coret, di input, atau >200 karakter. Bacaan furigana (<rt>) dibuang dari teks.

## Panel di HP/tablet (<1024px)
Panel Sensei/Kamus/Catatan yang sama (udah ke-render) jadi **lembar bawah** lewat CSS: tombol 💬 Sensei di dock sebelah Coret, tinggi 78dvh, tutup via ×, tap area gelap, Esc, atau tarik pegangan >70px. Cuma `transform` yang dianimasiin, blur kaca dimatiin, scroll halaman dikunci selama kebuka. Pop-up blok teks buka lembar ini di tab yang sesuai.

## Tur halaman
`HonixTur` jadi umum (`daftar`, `aksiAkhir`), sorotan bisa gabungan beberapa elemen, target di luar layar di-scroll ke tengah. `HonixTurHalaman id="banksoal"`: otomatis sekali **setelah** tur menu beres, putar ulang via tombol **?** di header. 12 langkah (`LANGKAH_BANKSOAL`): filter, SOAL/OPSI, REVIEW/EDIT, blok teks, jawaban & pembahasan (Simpan ke Kamus / Catatan), tab Sensei/Kamus/Catatan, Coret, timer & Keluar. Target gak kelihatan dilewati (desktop 12 langkah; HP/tablet 10 — tab panel diganti langkah tombol 💬 Sensei).

Langkah "Salin pilihan jawaban" nyorot ikon ⧉ opsi pertama (dipaksa kelihatan via `body.hx-tur-on`; di layar sentuh ikonnya sekarang selalu kelihatan).

## Pengaturan → Tutorial
Item sidebar baru: **Menu utama** [▶ Putar], **Bank Soal** [▶ Putar] → set soal terakhir `?session=…&tur=banksoal` (belum ada sesi → "Buka Materi"), toggle **Ingatkan tiap bulan** (dipindah dari bagian Honix).

Data: `honix_settings.tur.halaman.banksoal` (ISO). Tanpa migration. Beranda gak disentuh.

