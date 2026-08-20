# JLPT Kotoba Generator 🇯🇵→🇮🇩

Generate database kosakata JLPT **N5–N1** (~8.000–10.000 kata) untuk aplikasi JLPT prep.
Tiap kata dilengkapi arti Bahasa Indonesia **casual**, kalimat contoh Jepang natural
(level-appropriate) + terjemahannya, dan part of speech.

- **Sumber kata**: [`elzup/jlpt-word-list`](https://github.com/elzup/jlpt-word-list) (word + reading + arti English)
- **Generator**: Claude **Haiku 4.5** (`claude-haiku-4-5-20251001`) — hemat, batch 40 kata/call
- **Target user**: pekerja Indonesia di Jepang (tokutei ginou / kenshusei)

---

## 1. Setup

```bash
cd kotoba-generator

# (opsional tapi disarankan) virtualenv
python3 -m venv .venv && source .venv/bin/activate

# install dependency
pip install -r requirements.txt

# API key
cp .env.example .env
# lalu edit .env, isi ANTHROPIC_API_KEY kamu
```

> API key: https://console.anthropic.com/settings/keys

---

## 2. Dry-run dulu (WAJIB, hampir gratis)

Tes 10 kata N5 buat mastiin format & kualitas bener sebelum boros API:

```bash
python generate.py --dry-run --level N5
```

Hasilnya diprint ke layar + disimpan ke `output/kotoba-N5.dryrun.json` (nggak nyentuh checkpoint).
Cek arti Indonesia-nya natural, kalimat contohnya oke → lanjut full.

---

## 3. Generate full

```bash
python generate.py --level N5      # satu level
python generate.py --all           # semua level N5 → N1
```

- **Resumable**: kalau ke-stop/crash, tinggal jalanin lagi — otomatis lanjut dari
  checkpoint terakhir (`data/progress/N5.progress.json`). Atau eksplisit:
  ```bash
  python generate.py --resume --level N3
  ```
- **Progress bar** + **cost tracking** (estimasi $ tiap 100 kata) muncul di terminal.

---

## 4. Output

File per level di `output/`:

```
output/kotoba-N5.json
output/kotoba-N4.json
output/kotoba-N3.json
output/kotoba-N2.json
output/kotoba-N1.json
```

Format:

```json
{
  "level": "N3",
  "title": "JLPT N3 Kotoba (1780 kata)",
  "words": [
    {
      "word": "経験",
      "reading": "けいけん",
      "meaning_id": "pengalaman",
      "example": "海外で働いた経験があります。",
      "example_id": "Aku punya pengalaman kerja di luar negeri.",
      "part_of_speech": "noun",
      "jlpt_level": "N3"
    }
  ]
}
```

> Buat dipakai di app utama, tinggal copy ke `../materi/import/`.

---

## 5. CLI options

| Command | Fungsi |
|---|---|
| `python generate.py --dry-run --level N5` | Tes 10 kata (hemat API) |
| `python generate.py --level N3` | Generate 1 level |
| `python generate.py --all` | Generate semua N5→N1 |
| `python generate.py --resume --level N3` | Lanjut dari checkpoint |

---

## 6. Fitur teknis

- **Resumable** — checkpoint disimpan tiap batch ke `data/progress/`. Aman di-stop kapan aja.
- **Rate limiting** — max 50 request/menit (sliding window) biar gak kena limit Anthropic.
- **Retry** — tiap batch di-retry 3× (backoff) kalau API error; kalau tetap gagal, batch
  di-skip + dicatat ke `errors.log` (proses lanjut, gak berhenti).
- **Cost tracking** — estimasi $ (input×\$1/MTok + output×\$5/MTok) tiap 100 kata & total.
- **Cache** — CSV sumber di-cache di `data/raw/`, gak download ulang.

---

## 7. Estimasi biaya

Batch 40 kata/call, Haiku 4.5 ($1/MTok in, $5/MTok out). Untuk ~10.000 kata perkiraan
**~$3–5** (tergantung panjang contoh). Cek angka riil di dry-run × skala. Budget aman
buat $14 credit.

> 💡 Mau lebih hemat 50%? Bisa dipindah ke **Batch API** (async, 24 jam) — tapi versi ini
> sengaja sinkron biar resumable + progress real-time. Tanya kalau mau versi batch.

---

## Struktur folder

```
kotoba-generator/
├── generate.py          # main script
├── requirements.txt
├── .env.example
├── README.md
├── data/
│   ├── raw/             # cache CSV sumber (n5.csv ..)
│   └── progress/        # checkpoint resume (N5.progress.json ..)
└── output/              # hasil JSON (kotoba-N5.json ..)
```
