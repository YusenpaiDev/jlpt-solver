import test from 'node:test';
import assert from 'node:assert/strict';
import { penilaianJanji, paceBerikut, KEBUTUHAN_JAM, PACE } from '../src/lib/janji-belajar.ts';

test('hours needed per level follow the handoff placeholder', () => {
  assert.deepEqual(KEBUTUHAN_JAM, { N5: 40, N4: 60, N3: 90, N2: 130, N1: 180 });
});

test('hours available = days × pace minutes / 60 × 0.85, rounded', () => {
  // 28 hari × 20 menit = 560 menit = 9.33 jam × 0.85 = 7.9 → 8
  assert.deepEqual(penilaianJanji('N2', 28, 20), { v: 'gak', butuh: 130, punya: 8 });
});

test('verdict thresholds: ≥1.0 kekejar, 0.7–1.0 mepet, <0.7 belum', () => {
  // N5 butuh 40 jam. 40 menit/hari: punya = hari × 40/60 × 0.85
  assert.equal(penilaianJanji('N5', 71, 40).v, 'ok');    // 40.2 jam
  assert.equal(penilaianJanji('N5', 70, 40).v, 'mepet'); // 39.7 jam
  assert.equal(penilaianJanji('N5', 50, 40).v, 'mepet'); // 28.3 jam → 0.708
  assert.equal(penilaianJanji('N5', 49, 40).v, 'gak');   // 27.8 jam → 0.694
});

test('no exam date or a past exam cannot be judged', () => {
  assert.equal(penilaianJanji('N3', null, 20), null);
  assert.equal(penilaianJanji('N3', -3, 20), null);
});

test('an unknown level falls back to N3', () => {
  assert.equal(penilaianJanji('N9', 300, 20).butuh, 90);
});

test('next pace up from the three onboarding choices', () => {
  assert.deepEqual(PACE.map(p => p.m), [10, 20, 40]);
  assert.equal(paceBerikut(10).m, 20);
  assert.equal(paceBerikut(20).m, 40);
  assert.equal(paceBerikut(30).m, 40);
  assert.equal(paceBerikut(40), null);
  assert.equal(paceBerikut(60), null);
});
