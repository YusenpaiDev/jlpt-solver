# Tur Honix — cara pakai Sensei JLPT

Status: disetujui di chat 2026-10-09. Desain & copy dari Claude (belum ada mock).

## Tujuan
User baru langsung paham isi app lewat tur singkat bareng Honix. User lama diingatkan sebulan sekali tanpa dipaksa. Tur bisa diputar ulang kapan aja dari Pengaturan.

Sukses = tur muncul tepat sekali buat user yang belum pernah lihat, tawaran bulanan muncul ≥30 hari setelah interaksi terakhir, dan tidak ada halaman (terutama Beranda) yang kodenya diubah.

## Bentuk: tur sorot menu navigasi
Overlay gelap + lubang terang di ikon nav yang dibahas, balon Honix di sebelahnya. Jalan di halaman tempat dia muncul, gak pindah halaman.

| # | Target (`data-tur`) | Pose | Judul · isi |
|---|---|---|---|
| 0 | — tengah | senang | Hai, aku Honix! · Aku ajak keliling sebentar, cuma ±1 menit. |
| 1 | `beranda` | tunjuk | Beranda · Pusat harimu: target, streak, dan lanjut latihan. |
| 2 | `materi` | baca | Materi · Kotoba, Bunpou, Bank Soal 過去問, dan Choukai per level. |
| 3 | `lembar-tugas` | tunjuk | Lembar Tugas · Bikin set soal latihan dari materi pilihanmu. |
| 4 | `kamus` | tunjuk | Kamus · Simpan kata, terus hafalin pakai FLASH. |
| 5 | `catatan` | baca | Catatan · Tulis poin penting biar gampang diulang. |
| 6 | `progres` | terbang | Progres · Akurasi, kategori terlemah, dan riwayat latihanmu. |
| 7 | `pengaturan` | tunjuk | Pengaturan · Tur ini bisa kamu putar lagi di sini kapan aja. |
| 8 | — tengah | lulus | Siap! · Mulai dari Latihan Kilat? → [Mulai latihan] `/latihan/kilat` · [Nanti] |

HP (bottom nav): langkah 5–7 digabung jadi satu langkah yang nyorot `lainnya` — "Lainnya · Catatan, Progres, dan Pengaturan (tempat tur ini bisa diputar lagi)." Target yang gak ketemu di DOM dilewati otomatis.

Kontrol: titik progres, Kembali / Lanjut, **Lewati** di tiap langkah, Esc = lewati, ←/→ = mundur/maju. Fokus keyboard dikunci di balon, balik ke elemen semula setelah tutup. Klik overlay gak nutup tur (biar gak kepencet). `kurangiGerak` → tanpa transisi lubang & tanpa idle Honix. Lubang ikut posisi target saat resize/scroll.

## Kapan muncul
Semua keputusan di satu fungsi murni `keputusanTur(tur, kini)` → `"tur" | "tawar" | null`.

- `tur.terakhir == null` → **"tur"** (otomatis, sekali). Berlaku juga buat user lama.
- `ingatkan && kini − terakhir ≥ 30 hari` → **"tawar"**: Honix kecil (pose tunjuk) di pojok kanan bawah, di atas bottom nav di HP — "Udah sebulan! Mau lihat lagi cara pakainya?" [Lihat tur] [Nanti aja].
- Selain itu → null.

`terakhir` di-set ke sekarang saat tur selesai, dilewati, atau tawaran dijawab (dua-duanya). Jadi "Nanti aja" = ditanya lagi 30 hari kemudian.

Hanya dipasang lewat `NavRail`/`BottomNav` → otomatis gak muncul di player latihan, onboarding, login. Gak muncul sebelum setelan akun kebaca (hindari tur dobel di perangkat kedua). Satu tab cuma memutuskan sekali per load.

## Pengaturan → Honix
Dua baris baru di `HonixSection`:
- **Cara pakai Sensei JLPT** — [▶ Putar tur] (jalan langsung di halaman Pengaturan).
- **Ingatkan tiap bulan** — toggle, default nyala.

## Data
`profiles.honix_settings` (jsonb, udah ada + udah di-grant) ditambah:
```
tur: { terakhir: string | null /* ISO */, ingatkan: boolean }
```
Default `{ terakhir: null, ingatkan: true }`. Lewat store `honix-setelan` yang ada (`rapikan` divalidasi, cache localStorage). **Tanpa migration.**

Store perlu tanda `akunTerbaca` supaya keputusan tur nunggu isi akun (atau gagal/ga login → pakai lokal).

## Komponen
- `src/lib/honix-tur.ts` — daftar langkah (data), `keputusanTur`, konstanta 30 hari. Murni, dites.
- `src/components/honix/HonixTur.tsx` — overlay + balon; `mulaiTur()` lewat event store kecil biar Pengaturan & dev preview bisa memicu.
- `src/components/honix/HonixTawarTur.tsx` — tawaran pojok.
- `src/components/honix/HonixTurHost.tsx` — baca setelan, jalankan keputusan, render salah satu. Dipasang sekali di `NavRail` (desktop) & `BottomNav` (HP) dengan penjaga supaya cuma satu instance aktif.
- `data-tur="…"` di item `NavRail`/`BottomNav`.
- CSS di `src/styles/honix.css`, token Honix yang ada.
- `/dev/honix`: tombol "Mulai tur" & "Tawaran tur".

**Tidak menyentuh** `src/app/page.tsx` (Beranda) maupun halaman lain.

## Tes
- `tests/honix-tur.test.mjs` (node --test): `keputusanTur` — belum pernah, <30 hari, =30 hari, ingatkan mati, tanggal rusak; `rapikan` menerima/menolak bentuk `tur`.
- tsc + eslint.
- Screenshot Playwright (dev bypass) 1280 & 390: langkah 0, satu langkah sorot, langkah HP "Lainnya", langkah terakhir, tawaran, baris Pengaturan.
