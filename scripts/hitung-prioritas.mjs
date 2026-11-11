/**
 * Hitung seberapa sering tiap kata (deck Kotoba) & pola (deck Bunpou) muncul
 * di soal Bank Soal lokal → src/data/prioritas/{N1..N4}.json. Dipakai kurikulum
 * buat ngurutin unit: yang paling sering keluar masuk unit awal, jadi mode
 * "Kejar" (waktu gak cukup) motong materi yang paling jarang keluar.
 *
 * Cuma baca file lokal (gak nyentuh Supabase). Output cuma kata/pola dari deck
 * kita sendiri + angka hitungannya, gak ada teks soal.
 *
 * Pakai: node scripts/hitung-prioritas.mjs [--dir materi/import]
 * Angkanya = berapa SOAL yang memuat item itu (cocok substring, tanpa pemenggal
 * kata), jadi kira-kira. Item yang potongannya pendek (日, と, ～し, スト) nempel
 * di mana-mana, bobotnya dibagi 4; baris & frasa petunjuk soal dibuang. Cukup
 * buat urutan, bukan statistik.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const i = args.indexOf("--dir");
const ROOT = i !== -1 ? args[i + 1] : "materi/import";
const LEVEL = ["N1", "N2", "N3", "N4"];
const BIDANG = ["question", "options", "passage", "transcript"];
const JP = /[\u3040-\u30ff\u4e00-\u9fff々ー]+/g;
const HIRA_AKHIR = /[\u3040-\u309f]$/;
const KANJI = /[\u4e00-\u9fff]/;
const KANA = /^[\u3040-\u30ffー]+$/;
/** Frasa petunjuk soal yang nyelip di tengah kalimat. */
const PETUNJUK = /(解答|問題)用紙|選択肢|選びなさい|答えなさい/g;

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.name.endsWith(".json")) out.push(full);
  }
  return out;
}

const teksDari = v => (typeof v === "string" ? v : Array.isArray(v) ? v.filter(x => typeof x === "string").join("\n") : "");

/** Satu string per soal (soal + pilihan + bacaan + transkrip). */
function korpus(level) {
  const dir = join(ROOT, level);
  if (!existsSync(dir)) return { soal: [], set: 0 };
  const soal = [];
  let set = 0;
  for (const f of walk(dir)) {
    let d;
    try { d = JSON.parse(readFileSync(f, "utf8")); } catch { continue; }
    const qs = Array.isArray(d?.questions) ? d.questions : [];
    if (!qs.length) continue;
    set++;
    for (const q of qs) soal.push(BIDANG.map(b => teksDari(q?.[b])).join("\n"));
  }
  /* Baris yang sama persis di ≥ 15 soal = petunjuk / kepala soal, bukan isi. */
  const n = new Map();
  for (const t of soal) for (const l of new Set(t.split("\n"))) n.set(l, (n.get(l) ?? 0) + 1);
  return { soal: soal.map(t => t.split("\n").filter(l => (n.get(l) ?? 0) < 15).join("\n").replace(PETUNJUK, "")), set };
}

const hitung = (soal, s) => soal.reduce((n, t) => n + (t.includes(s) ? 1 : 0), 0);

/** "回る、回す" / "～(に) ついて" / "これ/それ" → varian → potongan Jepang (dipisah ～). */
function varian(s) {
  return s.replace(/[（(][^)）]*[)）]/g, "").split(/[、・／/]/)
    .map(v => v.split(/[～〜]/).flatMap(x => x.match(JP) ?? []))
    .filter(v => v.length);
}

/** Varian cocok kalau semua potongannya ada; skor = potongan paling jarang. Item = varian terbaik.
    Kata kerja/sifat berkanji dicocokin pakai batangnya (集める → 集め) biar bentuk berubah ikut
    kehitung; yang kana doang gak (うなる → うな bakal nyangkut di ような). */
function skor(soal, s, kerja = false) {
  let best = 0;
  for (const v of varian(s)) {
    const pot = v.map(x => (kerja && v.length === 1 && x.length >= 3 && HIRA_AKHIR.test(x) && KANJI.test(x) ? x.slice(0, -1) : x));
    const n = Math.min(...pot.map(x => hitung(soal, x)));
    /* Potongan pendek (satu huruf, atau kana ≤ 2) nempel di mana-mana → bobot dibagi 4. */
    const pendek = pot.every(x => x.length === 1 || (x.length <= 2 && KANA.test(x)));
    best = Math.max(best, pendek ? Math.floor(n / 4) : n);
  }
  return best;
}

mkdirSync("src/data/prioritas", { recursive: true });
for (const lv of LEVEL) {
  const { soal, set } = korpus(lv);
  if (!set) { console.log(`${lv}: gak ada set, dilewati`); continue; }
  const kata = JSON.parse(readFileSync(`src/data/kotoba/${lv}.json`, "utf8")).vocabulary;
  const pola = JSON.parse(readFileSync(`src/data/bunpou/${lv}.json`, "utf8")).patterns;
  const out = { level: lv, set, soal: soal.length, kata: {}, pola: {} };
  for (const w of kata) { const n = skor(soal, w.word, /動詞|形容詞/.test(w.pos ?? "")); if (n) out.kata[w.word] = n; }
  for (const p of pola) { const n = skor(soal, p.pattern); if (n) out.pola[p.pattern] = n; }
  writeFileSync(`src/data/prioritas/${lv}.json`, JSON.stringify(out) + "\n");
  console.log(`${lv}: ${set} set, ${soal.length} soal · kata muncul ${Object.keys(out.kata).length}/${kata.length} · pola muncul ${Object.keys(out.pola).length}/${pola.length}`);
}
