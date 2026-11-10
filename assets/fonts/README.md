Font buat gambar kartu pamer (`/api/kartu-pamer`, next/og butuh TTF, bukan woff2).

- `Geist-*.ttf` — dari paket npm `geist` (SIL Open Font License 1.1).
- `NotoSerifJP-Bold-gaku.ttf` — Noto Serif JP Bold, dipotong cuma glyph 学 (Google Fonts, SIL Open Font License 1.1).

Disimpen di repo biar gak bergantung jaringan pas render (build Vercel pernah gagal gara-gara unduh font).
