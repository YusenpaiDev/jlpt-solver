# PRD — Sensei JLPT
Product Requirements Document · Last updated: 18 Apr 2026

---

## Overview

Sensei JLPT adalah aplikasi web untuk belajar JLPT dengan bantuan AI. User bisa upload/foto soal, dapat pembahasan lengkap, dan lacak progress belajar mereka.

---

## Flow Utama: Analisis Foto

### Langkah-langkah

```
1. User buka halaman Analisis Foto
2. User upload foto / drag & drop / kamera
3. [SETUP STEP] Sistem tanya:
   a. "Soal level berapa?" → user pilih N1/N2/N3/N4/N5
   b. "Kategori soal?" →
        - User tau  → pilih manual: 文法 / 語彙 / 文字 / 読解
        - User gatau → pilih "Biar AI yang deteksi"
4. User klik "Mulai Analisis"
5. AI proses foto → hasilkan soal + pembahasan lengkap
6. Hasil tersimpan otomatis ke Riwayat Soal
```

### Aturan

- **Level**: selalu ditanyain ke user — user yang tau target levelnya
- **Kategori**: opsional — kalau user gatau, AI detect dari isi foto
- **Judul riwayat**: auto-generated dari level + kategori + tanggal
  - Contoh: "N2 · 文法 · 14 Apr" atau "N2 · AI Detected · 14 Apr"
- **Konsistensi level**: kartu riwayat di beranda akan konsisten sesuai level yang dipilih user, bukan campur-campur

---

## Riwayat Soal

- Setiap sesi analisis otomatis tersimpan
- Sumber data kartu riwayat = hasil analisis foto, bukan input manual
- Label kartu: Level + Kategori + Tanggal
- User bisa buka lagi sesi lama untuk review pembahasan

---

## Halaman & Status

| Halaman         | Status      |
|----------------|-------------|
| Beranda         | ✅ Done     |
| Analisis Foto   | 🔧 In Progress (setup step sedang dibangun) |
| Riwayat Soal    | ✅ Done     |
| Kamus           | ✅ Done (+ fitur Favorit) |
| Statistik       | ✅ Done     |
| Premium         | ✅ Done     |
| Lembar Tugas    | ✅ Done     |
| Login           | ✅ Done     |

---

## Keputusan Desain

- **Level** selalu dari user input — AI tidak sok tau level soal
- **Kategori** bisa dari user atau AI detect — user yang tentukan
- **Riwayat** tersimpan otomatis, tidak perlu naming manual
- **Sidebar favorit di Kamus** = sub-mode, bukan halaman baru di navbar
- **Riwayat di Lembar Tugas** = drawer/modal, bukan sidebar permanen
