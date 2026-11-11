import test from 'node:test';
import assert from 'node:assert/strict';
import {
  susunUnit, unitSekarang, tanggalUnit, seninDari, lanjutSrs, statusUnit, evaluasiTingkat, labelTingkat,
  nilaiPenempatan, nilaiUlangan, perkiraanSkor, gabungPerCat, jadwalSimulasi, tempo, mingguKeUjian, materiPerHari,
} from '../src/lib/kurikulum.ts';

const T = { jendela: 20, naik: 0.8, turun: 0.6 };
const INTERVAL = [1, 3, 7, 21, 60];

test('material splits evenly into 26 units, mixing groups', () => {
  const kata = Array.from({ length: 2102 }, (_, i) => ({ word: `w${i}`, group: i < 1000 ? 'あ行' : 'か行' }));
  const pola = Array.from({ length: 100 }, (_, i) => ({ pattern: `p${i}`, functionGroup: `g${i % 9}` }));
  const u = susunUnit(kata, pola);
  assert.equal(u.length, 26);
  assert.equal(u.reduce((n, x) => n + x.kata.length, 0), 2102);
  assert.equal(u.reduce((n, x) => n + x.pola.length, 0), 100);
  assert.ok(u.every(x => x.kata.length >= 80 && x.kata.length <= 81));
  assert.ok(u.every(x => x.pola.length >= 3 && x.pola.length <= 4));
  assert.equal(new Set(u.flatMap(x => x.kata)).size, 2102);
  // unit 1 dapat campuran あ行 & か行, bukan あ行 doang
  assert.ok(u[0].kata.includes('w0') && u[0].kata.includes('w1000'));
  assert.deepEqual(u[0].jenis, ['漢字読み', '表記']);
  assert.deepEqual(materiPerHari(u[0]), { kata: 12, pola: 1 });
});

test('week position counts from the start Monday, skipping placed-out units', () => {
  const k = { level: 'N3', tanggal_mulai: '2027-01-06', unit_mulai: 4, tanggal_ujian: '2027-07-04' };
  assert.equal(seninDari('2027-01-06'), '2027-01-04');
  assert.equal(unitSekarang(k, '2027-01-04'), 4);
  assert.equal(unitSekarang(k, '2027-03-01'), 12);
  assert.equal(unitSekarang(k, '2026-12-30'), 4); // sebelum mulai
  assert.equal(tanggalUnit(k, 3), null);
  assert.deepEqual(tanggalUnit(k, 12), ['2027-03-01', '2027-03-07']);
  assert.equal(mingguKeUjian('2027-03-01', '2027-07-04'), 18);
  assert.equal(mingguKeUjian('2027-03-01', null), null);
});

test('SRS: 1·3·7·21·60 days, wrong answer goes back to tomorrow', () => {
  let s = lanjutSrs(undefined, true, '2026-11-11', INTERVAL);
  assert.deepEqual(s, { status: 'belajar', tahap: 1, jatuh_tempo: '2026-11-12' });
  s = lanjutSrs(s, true, '2026-11-12', INTERVAL); assert.equal(s.jatuh_tempo, '2026-11-15');
  s = lanjutSrs(s, true, '2026-11-15', INTERVAL); assert.equal(s.status, 'hafal'); assert.equal(s.jatuh_tempo, '2026-11-22');
  s = lanjutSrs(s, true, '2026-11-22', INTERVAL); assert.equal(s.jatuh_tempo, '2026-12-13');
  s = lanjutSrs(s, true, '2026-12-13', INTERVAL); assert.equal(s.status, 'dikuasai'); assert.equal(s.jatuh_tempo, '2027-02-11');
  s = lanjutSrs(s, true, '2027-02-11', INTERVAL); assert.equal(s.tahap, 5);
  assert.deepEqual(lanjutSrs(s, false, '2027-02-11', INTERVAL), { status: 'belajar', tahap: 0, jatuh_tempo: '2027-02-12' });
});

test('unit status', () => {
  const full = [10, 0, 0, 0], open = [5, 0, 0, 5];
  assert.equal(statusUnit(2, 4, 12, full, full), 'skip');
  assert.equal(statusUnit(12, 4, 12, open, open), 'cur');
  assert.equal(statusUnit(13, 4, 12, open, open), 'next');
  assert.equal(statusUnit(10, 4, 12, full, [3, 1, 0, 0]), 'done');
  assert.equal(statusUnit(11, 4, 12, open, full), 'part');
});

test('tier moves only after 20 answers: ≥80% up, <60% down, clamped 1–3', () => {
  const r = (benar, n = 20) => Array.from({ length: n }, (_, i) => i < benar);
  assert.deepEqual(evaluasiTingkat(r(19, 19), 2, T), { tingkat: 2, arah: 0, akurasi: 1 });
  assert.equal(evaluasiTingkat(r(16), 2, T).tingkat, 3);
  assert.equal(evaluasiTingkat(r(20), 3, T).arah, 0);
  assert.equal(evaluasiTingkat(r(11), 2, T).tingkat, 1);
  assert.equal(evaluasiTingkat(r(5), 1, T).arah, 0);
  assert.equal(evaluasiTingkat([...r(0, 10), ...r(20)], 1, T).arah, 1); // cuma 20 terakhir
  assert.deepEqual(labelTingkat(evaluasiTingkat(r(16), 2, T), 2, T), ['Naik ke T3 mulai besok', 'up']);
  assert.deepEqual(labelTingkat(evaluasiTingkat(r(11), 2, T), 2, T), ['Balik ke T1 dulu, biar fondasinya kuat', 'dn']);
  assert.deepEqual(labelTingkat(evaluasiTingkat(r(5), 1, T), 1, T), ['Udah di T1 · dapat latihan tambahan', 'dn']);
  assert.deepEqual(labelTingkat(evaluasiTingkat(r(15), 2, T), 2, T), ['Hampir naik · butuh 80%', '']);
  assert.deepEqual(labelTingkat(evaluasiTingkat(r(14), 2, T), 2, T), ['Tetap di T2', '']);
  assert.deepEqual(labelTingkat(evaluasiTingkat([], 1, T), 1, T), ['Belum ada jawaban', '']);
});

test('placement: highest week still ≥70%, start = earliest section + 1', () => {
  const j = [
    ...[1, 2, 3, 4, 5, 6].map(u => ({ grup: '文字・語彙', unit: u, benar: u <= 5 })),
    ...[1, 2, 3, 4].map(u => ({ grup: '文法', unit: u, benar: u !== 2 && u !== 4 })),
    { grup: '読解', unit: null, benar: true }, { grup: '読解', unit: null, benar: false },
  ];
  const { posisi, unitMulai } = nilaiPenempatan(j, { ambang: 0.7 });
  assert.deepEqual(posisi.map(p => [p.k, p.minggu, p.benar, p.total]), [['文字・語彙', 6, 5, 6], ['文法', 1, 2, 4], ['読解', 0, 1, 2]]);
  assert.equal(unitMulai, 2); // 文法 baru aman sampai minggu 1
  assert.equal(nilaiPenempatan([], { ambang: 0.7 }).unitMulai, 1);
});

test('weekly review scoring per part', () => {
  const r = nilaiUlangan([{ bagian: 'Kata', benar: true }, { bagian: 'Kata', benar: false }, { bagian: 'Pola', benar: true }]);
  assert.deepEqual(r, { benar: 2, total: 3, perBagian: { Kata: { benar: 1, total: 2 }, Pola: { benar: 1, total: 1 } } });
});

test('score estimate: official sections, minimum rule, data thresholds', () => {
  const S3 = [{ k: '言語知識', s: '', max: 60, min: 19 }, { k: '読解', s: '', max: 60, min: 19 }, { k: '聴解', s: '', max: 60, min: 19 }];
  const A = { minTotal: 150, minBagian: 20, akurat: 100, hari: 30 };
  const ok = perkiraanSkor({ 文字: { a: 100, c: 70 }, 語彙: { a: 50, c: 30 }, 文法: { a: 88, c: 50 }, 読解: { a: 124, c: 56 }, 聴解: { a: 50, c: 28 } }, S3, 95, A);
  assert.equal(ok.siap, true);
  assert.deepEqual(ok.bagian.map(b => b.nilai), [38, 27, 34]);
  assert.equal(ok.total, 99);
  assert.equal(ok.diatasLulus, true);
  assert.deepEqual(ok.bagian.map(b => b.akurat), [true, true, false]);
  const low = perkiraanSkor({ 文法: { a: 238, c: 170 }, 読解: { a: 124, c: 35 }, 聴解: { a: 50, c: 40 } }, S3, 95, A);
  assert.equal(low.total >= 95, true);
  assert.equal(low.diatasLulus, false); // 読解 di bawah minimum
  const few = perkiraanSkor({ 文法: { a: 38, c: 20 }, 読解: { a: 14, c: 7 } }, S3, 95, A);
  assert.equal(few.siap, false);
  assert.equal(few.kurang, 98);
  const S2 = [{ k: '言語知識・読解', s: '', max: 120, min: 38 }, { k: '聴解', s: '', max: 60, min: 19 }];
  assert.equal(perkiraanSkor({ 文字: { a: 10, c: 10 }, 読解: { a: 10, c: 0 } }, S2, 90, A).bagian[0].nilai, 60);
});

test('merging per-category stats only counts the last 30 days', () => {
  const s = [
    { created_at: '2026-11-01T00:00:00Z', stats: { perCat: { 文法: { a: 10, c: 5 } } } },
    { created_at: '2026-08-01T00:00:00Z', stats: { perCat: { 文法: { a: 99, c: 99 } }, last_practiced_at: '2026-11-10T00:00:00Z' } },
    { created_at: '2026-08-01T00:00:00Z', stats: { perCat: { 文法: { a: 50, c: 50 } } } },
    { created_at: '2026-11-02T00:00:00Z', stats: null },
  ];
  assert.deepEqual(gabungPerCat(s, '2026-11-11', 30), { 文法: { a: 109, c: 104 } });
});

test('monthly simulation: last Saturday of each month + 2 weeks before the exam', () => {
  assert.deepEqual(jadwalSimulasi('2027-01-04', '2027-07-04'),
    ['2027-01-30', '2027-02-27', '2027-03-27', '2027-04-24', '2027-05-29', '2027-06-20']);
  assert.deepEqual(jadwalSimulasi('2027-01-04', null), []);
});

test('tempo text', () => {
  assert.deepEqual(tempo(22, 30), { teks: 'Lebih cepat 8 menit', cls: 'ok' });
  assert.deepEqual(tempo(76, 70), { teks: 'Lewat 6 menit', cls: 'warn' });
  assert.deepEqual(tempo(40, 40, true), { teks: 'Ikut audio', cls: '' });
  assert.deepEqual(tempo(null, 30), { teks: 'Belum kecatat', cls: '' });
});

test('merging stops at the given day (weekly trend)', async () => {
  const { gabungPerCat: g } = await import('../src/lib/kurikulum.ts');
  const s = [{ created_at: '2026-11-10T00:00:00Z', stats: { perCat: { 読解: { a: 4, c: 2 } } } }];
  assert.deepEqual(g(s, '2026-11-03', 30), {});
  assert.deepEqual(g(s, '2026-11-10', 30), { 読解: { a: 4, c: 2 } });
});
