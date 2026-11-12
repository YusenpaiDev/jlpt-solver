import test from 'node:test';
import assert from 'node:assert/strict';
import { teratas, paket, jumlahPaket, paketBerikut, labelKeluar } from '../src/lib/sering-keluar.ts';

const kata = ['a', 'b', 'c', 'd', 'e'].map(w => ({ word: w }));

test('top list: most frequent first, ties keep deck order, never-seen dropped', () => {
  const t = teratas(kata, x => x.word, { b: 9, d: 9, a: 2, e: 0 }, 3);
  assert.deepEqual(t.map(x => x.word), ['b', 'd', 'a']);
  assert.deepEqual(teratas(kata, x => x.word, undefined), []);
});

test('packs of 10 and the next unfinished pack', () => {
  const xs = Array.from({ length: 23 }, (_, i) => i);
  assert.equal(jumlahPaket(xs.length), 3);
  assert.deepEqual(paket(xs, 3), [20, 21, 22]);
  assert.equal(paketBerikut(xs, x => x < 10), 2);
  assert.equal(paketBerikut(xs, () => true), null);
  assert.equal(paketBerikut(xs, () => false), 1);
});

test('label only when frequent enough', () => {
  assert.equal(labelKeluar(38), 'di 38 soal');
  assert.equal(labelKeluar(2), null);
  assert.equal(labelKeluar(undefined), null);
});
