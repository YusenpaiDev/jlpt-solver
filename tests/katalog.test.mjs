import test from 'node:test';
import assert from 'node:assert/strict';
import { gabungBankSoal } from '../src/lib/bank-soal.ts';
import { bersihkanAiResult, barisKatalog } from '../scripts/lib/katalog.mjs';

const kat = (id, title, extra = {}) => ({ id, level: 'N3', title, section: null, total: 30, ready: true, ...extra });
const milik = (id, title, extra = {}) => ({ id, level: 'N3', title, total: 30, score: null, created_at: '2026-10-01T00:00:00Z', ...extra });

test('new account sees the whole catalog instead of an empty Bank Soal', () => {
  const sets = gabungBankSoal([], [kat('k1', 'A'), kat('k2', 'B')]);
  assert.deepEqual(sets.map(s => [s.id, s.katalogId]), [[null, 'k1'], [null, 'k2']]);
});

test('an opened set keeps the user score and is not listed twice', () => {
  const sets = gabungBankSoal([milik('s1', 'A', { score: 25 })], [kat('k1', 'A'), kat('k2', 'B')]);
  assert.equal(sets.length, 2);
  assert.deepEqual(sets[0], { ...sets[0], id: 's1', katalogId: 'k1', score: 25 });
  assert.equal(sets[1].id, null);
});

test('catalog decides readiness so an unlocked set opens for old copies too', () => {
  const [s] = gabungBankSoal([milik('s1', 'A', { ready: false })], [kat('k1', 'A')]);
  assert.equal(s.ready, true);
  const [lama] = gabungBankSoal([milik('s2', 'Z', { ready: false })], []);
  assert.equal(lama.ready, false);
});

test('owner progress never leaks into the catalog', () => {
  const ai = bersihkanAiResult({
    title: 'A', section: 'choukai', kind: 'materi',
    user_progress: { answers: { 0: '2' }, revealed: [0] },
    stats: { answered: 1, correct: 1, perCat: {} },
    questions: [{ question: 'q', correct: '2', needs_review: true }],
  });
  assert.equal('user_progress' in ai, false);
  assert.equal('stats' in ai, false);
  assert.deepEqual(ai.questions, [{ question: 'q', correct: '2' }]);
  assert.equal(ai.kind, 'materi');
});

test('duplicate owner titles collapse to the newest copy', () => {
  const { baris, dobel } = barisKatalog([
    { level: 'N3', category: null, title: 'A', created_at: '2026-01-01T00:00:00Z', ai_result: { questions: [{}] } },
    { level: 'N3', category: null, title: 'A', created_at: '2026-06-01T00:00:00Z', ai_result: { questions: [{}, {}], ready: false } },
  ]);
  assert.equal(baris.length, 1);
  assert.equal(baris[0].total, 2);
  assert.equal(baris[0].ready, false);
  assert.deepEqual(dobel, ['A']);
});
