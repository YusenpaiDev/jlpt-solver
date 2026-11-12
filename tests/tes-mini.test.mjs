import test from 'node:test';
import assert from 'node:assert/strict';
import { STRATEGI } from '../src/lib/strategi-ujian.ts';
import { seninDari, skorTes, KOMPOSISI } from '../src/lib/tes-mini.ts';

test('week starts on Monday (local date strings)', () => {
  assert.equal(seninDari('2026-11-09'), '2026-11-09'); // Senin
  assert.equal(seninDari('2026-11-15'), '2026-11-09'); // Minggu
  assert.equal(seninDari('2026-11-11'), '2026-11-09');
  assert.equal(seninDari('2026-03-01'), '2026-02-23'); // lewat batas bulan
});

test('test mix = 15 written questions', () => {
  assert.deepEqual(KOMPOSISI.map(k => k.n), [6, 5, 4]);
});

test('N1–N3: language knowledge, reading, listening estimated from accuracy × 60', () => {
  const r = skorTes(STRATEGI.N2, { '文字': { a: 4, c: 3 }, '語彙': { a: 2, c: 2 }, '文法': { a: 5, c: 3 }, '読解': { a: 4, c: 3 } }, { a: 20, c: 14 });
  assert.deepEqual(r.bagian.map(b => b.skor), [44, 45, 42]); // 8/11×60=43.6, 3/4×60, 14/20×60
  assert.equal(r.bagian[2].dariLatihan, true);
  assert.equal(r.total, 131);
  assert.equal(r.lulus, true);
  assert.equal(r.bawahMinimum, -1);
});

test('total passes but one section under the minimum = not passed', () => {
  const r = skorTes(STRATEGI.N2, { '文字': { a: 6, c: 6 }, '文法': { a: 5, c: 5 }, '読解': { a: 4, c: 1 } }, { a: 10, c: 10 });
  assert.deepEqual(r.bagian.map(b => b.skor), [60, 15, 60]);
  assert.equal(r.total, 135);
  assert.equal(r.lulus, false);
  assert.equal(r.bawahMinimum, 1);
});

test('N4–N5: one combined written section out of 120 + listening out of 60', () => {
  const r = skorTes(STRATEGI.N5, { '文字': { a: 6, c: 3 }, '文法': { a: 5, c: 3 }, '読解': { a: 4, c: 3 } }, { a: 5, c: 5 });
  assert.deepEqual(r.bagian.map(b => [b.k, b.skor]), [['言語知識・読解', 72], ['聴解', 60]]); // 9/15×120
  assert.equal(r.total, 132);
  assert.equal(r.lulus, true); // 132 ≥ 80 dan dua-duanya di atas minimum (38, 19)
});

test('no listening practice yet: listening and total stay unknown', () => {
  const r = skorTes(STRATEGI.N3, { '文字': { a: 6, c: 6 }, '文法': { a: 5, c: 5 }, '読解': { a: 4, c: 4 } }, null);
  assert.equal(r.bagian[2].skor, null);
  assert.equal(r.total, null);
  assert.equal(r.lulus, null);
});

test('a section already under its minimum is flagged even when listening is unknown', () => {
  const r = skorTes(STRATEGI.N3, { '文字': { a: 6, c: 1 }, '文法': { a: 5, c: 1 }, '読解': { a: 4, c: 4 } }, null);
  assert.equal(r.bawahMinimum, 0);
  assert.equal(r.lulus, false);
});

test('ignores unknown categories and broken counts', () => {
  const r = skorTes(STRATEGI.N2, { '文字': { a: 6, c: 9 }, 'palsu': { a: 9, c: 9 }, '文法': { a: -1, c: 0 }, '読解': { a: 4, c: 2 } }, { a: 0, c: 0 });
  assert.equal(r.bagian[0].skor, 60);  // c dibatasi ≤ a
  assert.equal(r.bagian[2].skor, null); // 0 soal 聴解 = belum ada data
});

import { perluIngatTesMini } from '../src/lib/tes-mini.ts';
test('reminder: Fri–Sun only, skipped once this week\'s test exists', () => {
  const lalu = [{ kind: 'tes_mini', tanggal: '2026-11-05' }]; // minggu lalu
  assert.equal(perluIngatTesMini(lalu, '2026-11-12'), false); // Kamis: belum waktunya
  assert.equal(perluIngatTesMini(lalu, '2026-11-13'), true);  // Jumat
  assert.equal(perluIngatTesMini(lalu, '2026-11-15'), true);  // Minggu
  assert.equal(perluIngatTesMini([...lalu, { kind: 'tes_mini', tanggal: '2026-11-10' }], '2026-11-14'), false);
  assert.equal(perluIngatTesMini([{ kind: 'materi', tanggal: '2026-11-10' }], '2026-11-14'), true);
});
