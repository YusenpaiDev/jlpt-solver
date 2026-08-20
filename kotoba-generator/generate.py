#!/usr/bin/env python3
"""
JLPT Kotoba Generator — N5..N1 vocabulary DB untuk aplikasi JLPT prep.

Sumber kata: elzup/jlpt-word-list (CSV: expression,reading,meaning,tags).
Per kata, Claude Haiku bikin: meaning_id (Indonesia casual) + example (kalimat
JP natural, level-appropriate) + example_id (terjemahan) + part_of_speech.

Fitur: resumable (checkpoint per batch), progress bar (tqdm), rate limit
(50 req/min), retry 3x + skip-on-fail (errors.log), cost tracking, dry-run.

Pakai:
    python generate.py --dry-run --level N5     # tes 10 kata
    python generate.py --level N3               # satu level
    python generate.py --all                    # semua level (N5->N1)
    python generate.py --resume --level N3       # lanjut dari checkpoint
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import sys
import time
from collections import deque
from pathlib import Path

import requests
from tqdm import tqdm
import anthropic

# ─────────────────────────── Konfigurasi ───────────────────────────
MODEL = "claude-haiku-4-5-20251001"        # Haiku 4.5 (hemat)
PRICE_IN = 1.00 / 1_000_000                 # $/token input  (Haiku 4.5: $1/MTok)
PRICE_OUT = 5.00 / 1_000_000                # $/token output (Haiku 4.5: $5/MTok)

BATCH_SIZE = 25                             # kata per 1 API call (kecil = aman buat N1 yg panjang)
RATE_LIMIT_PER_MIN = 50                     # max request/menit
MAX_RETRIES = 3                             # retry per batch kalau API error
MAX_TOKENS = 8000                           # headroom biar JSON gak kepotong (N1 kompleks)
DRY_RUN_N = 10                              # jumlah kata pas --dry-run

LEVELS = ["N5", "N4", "N3", "N2", "N1"]     # urutan proses (gampang -> susah)
SRC_URL = "https://raw.githubusercontent.com/elzup/jlpt-word-list/master/src/{lvl}.csv"

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "data" / "raw"
PROGRESS_DIR = ROOT / "data" / "progress"
OUTPUT_DIR = ROOT / "output"
ERRORS_LOG = ROOT / "errors.log"

LEVEL_HINT = {
    "N5": "sangat sederhana — kosakata & pola dasar (です/ます), kalimat pendek sehari-hari",
    "N4": "sederhana — percakapan sehari-hari, grammar dasar",
    "N3": "menengah — situasi umum & dunia kerja, kalimat natural",
    "N2": "agak kompleks — topik kerja/berita ringan, ungkapan lebih kaya",
    "N1": "kompleks — nuansa halus, topik abstrak/formal, kalimat panjang",
}

# ─────────────────────────── Setup logging ───────────────────────────
logging.basicConfig(
    filename=str(ERRORS_LOG), level=logging.WARNING,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
log = logging.getLogger("kotoba")


# ─────────────────────────── Util: env ───────────────────────────
def load_env() -> None:
    """Baca .env (kalau ada) → set os.environ. Tanpa dependency tambahan."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


# ─────────────────────────── Download + parse sumber ───────────────────────────
def download_level(level: str) -> Path:
    """Download CSV level dari GitHub, cache ke data/raw/. Return path lokal."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = RAW_DIR / f"{level.lower()}.csv"
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    url = SRC_URL.format(lvl=level.lower())
    print(f"  ↓ download {level}: {url}")
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    dest.write_bytes(r.content)
    return dest


def parse_level(level: str) -> list[dict]:
    """Parse CSV → list {word, reading, en}. Ambil bentuk pertama kalau ada varian."""
    path = download_level(level)
    words: list[dict] = []
    seen: set[str] = set()
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            expr = (row.get("expression") or "").split(";")[0].strip()
            reading = (row.get("reading") or "").split(";")[0].strip()
            en = (row.get("meaning") or "").strip()
            if not expr or expr in seen:
                continue
            seen.add(expr)
            words.append({"word": expr, "reading": reading or expr, "en": en})
    return words


# ─────────────────────────── Rate limiter (sliding window) ───────────────────────────
_calls: deque[float] = deque()


def rate_limit_wait() -> None:
    """Blokir sampai aman kirim request berikutnya (<= RATE_LIMIT_PER_MIN/menit)."""
    now = time.monotonic()
    while _calls and now - _calls[0] >= 60:
        _calls.popleft()
    if len(_calls) >= RATE_LIMIT_PER_MIN:
        sleep_for = 60 - (now - _calls[0]) + 0.05
        if sleep_for > 0:
            time.sleep(sleep_for)
    _calls.append(time.monotonic())


# ─────────────────────────── Prompt + API call ───────────────────────────
SYSTEM_PROMPT = (
    "Kamu leksikografer Jepang–Indonesia untuk aplikasi belajar JLPT. "
    "Target pengguna: pekerja Indonesia di Jepang (tokutei ginou / kenshusei). "
    "Terjemahan HARUS Bahasa Indonesia CASUAL & natural (bukan formal/literary); "
    "kalau ada idiom/slang, cari padanan Indonesia yang natural (jangan literal). "
    "Kalimat contoh harus natural & sesuai level, dan pakai kata target-nya. "
    "Balas HANYA JSON array valid, tanpa teks/penjelasan lain."
)


def build_user_prompt(level: str, batch: list[dict]) -> str:
    items = [{"i": i, "word": w["word"], "reading": w["reading"], "en": w["en"]}
             for i, w in enumerate(batch)]
    return (
        f"Level: {level} (tingkat kesulitan contoh: {LEVEL_HINT[level]}).\n"
        f"Untuk TIAP item di bawah, hasilkan objek dengan field:\n"
        f'  "i": index (sama seperti input),\n'
        f'  "meaning_id": arti singkat Bahasa Indonesia casual,\n'
        f'  "example": 1 kalimat Jepang natural yang MEMAKAI kata target, sesuai level {level},\n'
        f'  "example_id": terjemahan kalimat itu ke Indonesia casual,\n'
        f'  "part_of_speech": salah satu dari '
        f"[noun, verb, i-adjective, na-adjective, adverb, particle, conjunction, "
        f"expression, counter, prefix, suffix, interjection].\n\n"
        f"INPUT:\n{json.dumps(items, ensure_ascii=False)}\n\n"
        f"OUTPUT (JSON array saja, urutan i sama):"
    )


def extract_json_array(text: str) -> list:
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        raise ValueError("no JSON array in response")
    return json.loads(m.group(0))


def call_haiku(client: anthropic.Anthropic, level: str, batch: list[dict]):
    """1 batch → list hasil (index-matched). Retry MAX_RETRIES, lalu raise."""
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            rate_limit_wait()
            resp = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": build_user_prompt(level, batch)}],
            )
            text = "".join(b.text for b in resp.content if b.type == "text")
            arr = extract_json_array(text)
            usage = (resp.usage.input_tokens, resp.usage.output_tokens)
            return arr, usage
        except anthropic.RateLimitError as e:
            last_err = e
            wait = min(2 ** attempt * 5, 60)
            print(f"    ⏳ rate limited, tunggu {wait}s (attempt {attempt})")
            time.sleep(wait)
        except (anthropic.APITimeoutError, anthropic.APIStatusError, anthropic.APIError) as e:
            last_err = e
            wait = 2 ** attempt
            print(f"    ⚠️  API error ({type(e).__name__}), retry {wait}s (attempt {attempt})")
            time.sleep(wait)
        except (ValueError, json.JSONDecodeError) as e:
            last_err = e
            print(f"    ⚠️  parse gagal, retry (attempt {attempt})")
            time.sleep(1)
    raise RuntimeError(f"batch gagal setelah {MAX_RETRIES}x: {last_err}")


# ─────────────────────────── Progress / checkpoint ───────────────────────────
def progress_path(level: str) -> Path:
    return PROGRESS_DIR / f"{level}.progress.json"


def load_progress(level: str) -> dict:
    p = progress_path(level)
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {"results": [], "tokens_in": 0, "tokens_out": 0}


def save_progress(level: str, state: dict) -> None:
    PROGRESS_DIR.mkdir(parents=True, exist_ok=True)
    tmp = progress_path(level).with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    tmp.replace(progress_path(level))


# ─────────────────────────── Merge 1 batch ───────────────────────────
def merge_batch(level: str, batch: list[dict], arr: list) -> list[dict]:
    by_i = {}
    for obj in arr:
        if isinstance(obj, dict) and "i" in obj:
            by_i[int(obj["i"])] = obj
    out = []
    for i, w in enumerate(batch):
        o = by_i.get(i)
        if not o or not o.get("meaning_id"):
            log.warning("[%s] skip '%s' — hasil kosong/tidak lengkap", level, w["word"])
            continue
        out.append({
            "word": w["word"],
            "reading": w["reading"],
            "meaning_id": str(o.get("meaning_id", "")).strip(),
            "example": str(o.get("example", "")).strip(),
            "example_id": str(o.get("example_id", "")).strip(),
            "part_of_speech": str(o.get("part_of_speech", "")).strip() or "unknown",
            "jlpt_level": level,
        })
    return out


# ─────────────────────────── Proses 1 level ───────────────────────────
def cost_str(tin: int, tout: int) -> str:
    return f"${tin * PRICE_IN + tout * PRICE_OUT:.4f} (in {tin:,} / out {tout:,} tok)"


def process_level(client: anthropic.Anthropic, level: str, dry_run: bool) -> None:
    words = parse_level(level)
    if dry_run:
        words = words[:DRY_RUN_N]
        print(f"\n🧪 DRY-RUN {level}: {len(words)} kata (tanpa checkpoint, output *.dryrun.json)")

    state = {"results": [], "tokens_in": 0, "tokens_out": 0} if dry_run else load_progress(level)
    start = len(state["results"])
    if start and not dry_run:
        print(f"\n▶️  {level}: lanjut dari checkpoint (sudah {start} kata)")
    else:
        print(f"\n▶️  {level}: {len(words)} kata total")

    bar = tqdm(total=len(words), initial=start, unit="kata", desc=level)
    since_report = start
    i = start
    while i < len(words):
        batch = words[i:i + BATCH_SIZE]
        try:
            arr, (tin, tout) = call_haiku(client, level, batch)
        except RuntimeError as e:
            log.error("[%s] batch %d-%d DILEWATI: %s | kata: %s",
                      level, i, i + len(batch), e, [w["word"] for w in batch])
            print(f"    ❌ batch {i}-{i+len(batch)} dilewati (lihat errors.log)")
            i += BATCH_SIZE
            bar.update(len(batch))
            continue

        state["results"].extend(merge_batch(level, batch, arr))
        state["tokens_in"] += tin
        state["tokens_out"] += tout
        if not dry_run:
            save_progress(level, state)   # checkpoint tiap batch
        i += BATCH_SIZE
        bar.update(len(batch))

        # cost tracking tiap ~100 kata
        if len(state["results"]) - since_report >= 100:
            since_report = len(state["results"])
            tqdm.write(f"    💰 {level} sejauh ini: {cost_str(state['tokens_in'], state['tokens_out'])}")
    bar.close()

    # tulis output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    suffix = ".dryrun.json" if dry_run else ".json"
    out_path = OUTPUT_DIR / f"kotoba-{level}{suffix}"
    payload = {
        "level": level,
        "title": f"JLPT {level} Kotoba ({len(state['results'])} kata)",
        "words": state["results"],
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ {level} selesai: {len(state['results'])} kata → {out_path.relative_to(ROOT)}")
    print(f"   💰 cost {level}: {cost_str(state['tokens_in'], state['tokens_out'])}")

    if dry_run:
        print("\n── contoh hasil dry-run ──")
        for w in state["results"][:DRY_RUN_N]:
            print(f"  {w['word']} ({w['reading']}) [{w['part_of_speech']}] = {w['meaning_id']}")
            print(f"     例: {w['example']}")
            print(f"        {w['example_id']}")


# ─────────────────────────── CLI ───────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description="JLPT Kotoba Generator (Haiku)")
    ap.add_argument("--level", choices=LEVELS, help="proses 1 level (mis. N3)")
    ap.add_argument("--all", action="store_true", help="proses semua level N5..N1")
    ap.add_argument("--dry-run", action="store_true", help="tes 10 kata (hemat API)")
    ap.add_argument("--resume", action="store_true", help="lanjut dari checkpoint (default: auto-resume)")
    args = ap.parse_args()

    if not args.all and not args.level:
        ap.error("pilih --level <Nx> atau --all")

    load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("❌ ANTHROPIC_API_KEY belum di-set. Copy .env.example → .env dan isi key-nya.")

    client = anthropic.Anthropic()
    targets = LEVELS if args.all else [args.level]

    grand_in = grand_out = 0
    t0 = time.monotonic()
    for lvl in targets:
        process_level(client, lvl, dry_run=args.dry_run)
        if not args.dry_run:
            st = load_progress(lvl)
            grand_in += st["tokens_in"]
            grand_out += st["tokens_out"]

    if not args.dry_run and len(targets) > 1:
        print(f"\n🏁 TOTAL semua level: {cost_str(grand_in, grand_out)} "
              f"· {time.monotonic() - t0:.0f}s")


if __name__ == "__main__":
    main()
