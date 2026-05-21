# PRD — Sensei JLPT
Product Requirements Document · Last updated: 20 May 2026

---

## Overview

Sensei JLPT adalah aplikasi web untuk belajar JLPT (Japanese-Language Proficiency Test) dengan bantuan AI. User bisa upload/foto soal Jepang, dapat pembahasan lengkap, kelola kotoba pribadi (kamus), latihan via lembar tugas, dan lacak progress belajar.

Stack: Next.js (App Router) + Supabase + Claude AI + Vercel.

---

## Navigasi Global

### Top Nav (header) — konsisten di semua page

Item: **Materi · Latihan · Pro**

- "Beranda" di-drop dari top nav (logo Sensei udah clickable ke `/`)
- Source of truth: `src/components/AppHeader.tsx`
- Home (`/`) & `/analisis-foto` masih punya inline header tapi label-nya udah disama'in
- `/lembar-tugas` punya header spesialis (level badge + breadcrumb + action buttons) — sengaja beda

### Sidebar (desktop `lg+`) + BottomNav (mobile)

Source: `src/components/Sidebar.tsx`

1. Beranda → `/`
2. **Materi → `/materi`**
3. Riwayat Soal → `/riwayat-soal`
4. Analisis Foto → `/analisis-foto`
5. Lembar Tugas → `/lembar-tugas`
6. Kamus → `/kamus`
7. Catatan → `/catatan`
8. Statistik → `/statistik`

Bottom nav mobile pakai data yang sama (8 item, label di-truncate ke kata pertama).

---

## /materi — Hub Materi Belajar

Hub utama untuk materi belajar JLPT terstruktur (berbeda dari `/kamus` yang personal).

### Cards (saat ini)
- **Kotoba (語)** — status **COMING SOON**. Akan diisi dari file kotoba lokal user (txt/csv/pdf yang di-drop ke folder `materi/`).
- **Bunpou (文)** — status **COMING SOON**. Tata bahasa JLPT per level (pola, contoh, latihan).

### Right Sidebar (xl+)
- **Materi mendatang** — Kanji (字), Choukai (聴), Dokkai (読) — placeholder dengan icon Lock.
- **Punya file materi?** — CTA hijau yang ngajak user drop file ke folder `materi/`.
- **Tips belajar** — kartu tip konsisten 15 menit/hari.

### Folder `materi/`
- Di project root, **gitignored** (lihat `.gitignore`).
- User drop PDF/CSV/TXT materi belajar ke sini.
- Workflow: bilang ke Claude di chat → Claude parse → export ke format `kanji | reading | arti | level` → user upload via `/kamus` IMPORT atau di-load otomatis ke halaman materi (pending).

---

## /kamus — Kamus Pribadi User

Kamus kosakata personal. Sumber data:
1. Auto-save dari `/analisis-foto` (max 10 kata/foto)
2. Manual tambah (tombol TAMBAH)
3. Bulk import (tombol IMPORT)

### Toolbar — Grid 3 Kolom (sama lebar)
1. **FLASH** — gradient ungu (`#6366f1 → #a855f7`), primary CTA
2. **IMPORT** — oranye outline (`#e07b4a`)
3. **TAMBAH** — hijau outline (`#5ea87a`)

Plus top row: `"X KATA"` count + FURIGANA chip (cuma muncul kalau ada kata tanpa reading).

### Detail Kata
- Big kanji card dengan radial accent gradient
- Reading + meaning + level badge + tanggal tambah
- Contoh kalimat (kalau ada)
- "Kata lain level X" (sampai 4)
- Quiz Cepat (multiple choice 4 opsi, butuh ≥2 kata total)
- Edit modal (reading/meaning/level + AI re-generate)
- Delete dengan loading state

### FLASH (Flashcard Mode)

- Picker album dulu kalau `filtered.length > 50`. Kalau ≤ 50, langsung masuk semua.
- **Card 3D flip**: front = kanji only (size dinamis sesuai panjang kanji), back = kanji + reading + meaning.
- **Swipe gesture** (mobile): swipe kiri = next, swipe kanan = prev. Threshold 60px.
- **Buttons**: prev/next (size 14, disabled di ujung), shuffle (acak dalam album), lihat jawaban.
- **Progress dots**: centered window of 9 dots around current index.
- **Chip "ALBUM X/Y"** di top bar untuk balik ke picker.
- Floating FLASH MODE button (mobile, pojok kanan bawah, ungu glow).

### Album System

- **Ukuran**: 50 kotoba per album. Album terakhir partial.
- **Urutan stabil**: berdasarkan `created_at ASC` — Album 1 = 50 kata pertama yang ditambahkan. Album existing **tidak berubah** saat user nambah kotoba baru.
- **Auto-grow**: kotoba baru masuk ke album terakhir. Kalau udah 50, **album baru otomatis dibuat**.
- **Picker**: preview 4 kanji per album + count + badge **"MASIH NAMBAH"** di album terakhir kalau belum penuh.
- Opsi "Semua Kata" (tanpa album) tetap tersedia.

### Import (Bulk)

- Paste textarea (1 baris = 1 kata)
- Format: `kanji | reading | arti | level`
- Pemisah: `|` atau tab. Reading & level opsional.
- Baris kosong & yang diawali `#` di-skip
- **Upload file `.txt` atau `.csv`** — CSV pakai parser quote-aware (`"arti, dengan koma"` aman)
- Live counter "X kata terdeteksi" + preview 5 pertama
- Auto-dedup by kanji (yang udah ada di-skip)
- Batch insert 50/request ke Supabase
- Progress bar saat impor
- Result summary: **DITAMBAH / DUPLIKAT / GAGAL**

### Mobile UX

- Tampilan default: list full kotoba (bukan auto-select detail kata pertama)
- Auto-select cuma di desktop (`window.innerWidth >= 768`)
- Modal tambah/import full-height responsive
- Tombol kembali untuk balik dari detail ke list

### AI Furigana

- Per kata: tombol AUTO di modal tambah
- Batch semua: tombol FURIGANA di toolbar (cuma muncul kalau ada kata tanpa reading) + progress counter
- Endpoint: `/api/furigana`

---

## /analisis-foto — Flow Utama

### Langkah-langkah

```
1. User buka /analisis-foto
2. User upload foto / drag-drop / kamera
3. [SETUP STEP] Sistem tanya:
   a. "Soal level berapa?" → N1/N2/N3/N4/N5
   b. "Kategori soal?" →
        - User tau  → pilih: 文法 / 語彙 / 文字 / 読解
        - User gatau → "Biar AI yang deteksi"
4. User klik "Mulai Analisis"
5. AI proses foto → soal + pembahasan lengkap
6. Hasil auto-save ke Riwayat Soal
7. Kosakata di foto auto-extracted ke Kamus (max 10/foto)
```

### Aturan
- **Level** selalu dari user input — AI tidak sok tau level soal
- **Kategori** bisa dari user atau AI detect
- **Judul riwayat**: auto-generated dari level + kategori + tanggal (`N2 · 文法 · 14 Apr`)
- Tab Kamus di panel kanan (desktop) untuk akses cepat ke kosakata user

---

## /riwayat-soal — Riwayat Sesi

- Tiap sesi analisis auto-tersimpan
- Sumber data = hasil analisis foto, bukan input manual
- Label kartu: Level + Kategori + Tanggal
- Klik kartu → buka kembali sesi lama untuk review

---

## /lembar-tugas — Latihan Soal

Generate soal latihan via AI. Punya header spesialis (bukan AppHeader).

### Stages
- `setup` — pilih level & kategori
- `quiz` — kerjain soal generated
- Riwayat lewat drawer/modal (bukan sidebar permanen)

---

## /catatan — Catatan Pribadi

Catatan belajar user (markdown-style).

---

## /statistik — Statistik Belajar

Overview akurasi per kategori, level progress, dll.

---

## /premium & /premium/sukses — Subscription

Payment flow + sukses page. Webhook handler di `/api/payment/webhook`. Create checkout di `/api/payment/create`.

---

## /login & /pengaturan

- **Login** — Supabase auth (email).
- **Pengaturan** — profile, target level, avatar, langganan.

---

## Status Halaman

| Halaman                     | Status |
|-----------------------------|--------|
| Beranda                     | ✅ Done |
| **Materi (hub)**            | ✅ Done (cards COMING SOON) |
| Analisis Foto               | ✅ Done |
| Riwayat Soal                | ✅ Done |
| Kamus                       | ✅ Done (+ bulk import, album system, flashcard, AI furigana) |
| Catatan                     | ✅ Done |
| Lembar Tugas                | ✅ Done |
| Statistik                   | ✅ Done |
| Premium / Sukses            | ✅ Done |
| Login                       | ✅ Done |
| Pengaturan                  | ✅ Done |
| Materi → Kotoba (struktural)| ⏳ Pending (upload file lokal) |
| Materi → Bunpou             | ⏳ Pending |
| Materi → Kanji              | ⏳ Pending |
| Materi → Choukai            | ⏳ Pending |
| Materi → Dokkai             | ⏳ Pending |

---

## Backend / Data

### Supabase Tables
- `profiles` — user, target_level, xp, streak, avatar_url, is_premium
- `saved_words` — kotoba pribadi (user_id, kanji, reading, meaning, level, example, image_url, created_at)
- `sessions` — sesi analisis foto
- `tugas_sessions` — sesi latihan
- `storage.kamus-images` — bucket foto kata kamus

### API Routes
- `/api/analisis` — POST: analisis foto → soal + pembahasan + kosakata
- `/api/furigana` — POST: generate reading (& optional meaning) dari kanji
- `/api/chat` — chat dengan Sensei AI
- `/api/tugas/generate` — generate soal latihan
- `/api/payment/create` & `/api/payment/webhook` — Stripe/Midtrans flow

---

## Keputusan Desain

- **Level** selalu dari user input — AI tidak sok tau level soal
- **Kategori** bisa dari user atau AI detect — user yang tentukan
- **Riwayat** tersimpan otomatis, tidak perlu naming manual
- **Top nav** singkat (3 item): Materi / Latihan / Pro — biar konsisten & nggak crowded
- **Sidebar** lengkap (8 item) — untuk akses cepat semua tool
- **`/kamus` vs `/materi/kotoba`**: `/kamus` = personal user data (dynamic, grow over time); `/materi/kotoba` (pending) = materi curriculum terstruktur dari file lokal
- **Album kamus stabil**: pakai `created_at ASC` sebagai anchor — progress hafalan user nggak kebakar saat nambah kotoba baru
- **Folder `materi/`**: gitignored, untuk drop file lokal yang di-parse jadi materi struktural
- **Sidebar favorit di Kamus** = sub-mode, bukan halaman baru di navbar (legacy decision, masih relevan)
- **Riwayat di Lembar Tugas** = drawer/modal, bukan sidebar permanen

---

## UI/UX Backlog

(Diisi sesuai kebutuhan iterasi.)

- [ ] _(tambah item di sini)_

---

## Catatan

- `AGENTS.md` mengingatkan: ini Next.js versi baru, cek dokumentasi di `node_modules/next/dist/docs/` sebelum tulis kode router/API/server-component.
- Vercel auto-deploy dari branch `main`.
