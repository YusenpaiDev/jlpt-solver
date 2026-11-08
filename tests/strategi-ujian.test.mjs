import test from 'node:test';
import assert from 'node:assert/strict';
import { STRATEGI, strategiUntuk, TEKNIK, rapikanDisembunyikan, aturDisembunyikan } from '../src/lib/strategi-ujian.ts';

test('official pass marks and exam minutes per level', () => {
  const lulus = Object.fromEntries(Object.entries(STRATEGI).map(([k, v]) => [k, v.lulus]));
  assert.deepEqual(lulus, { N1: 100, N2: 90, N3: 95, N4: 90, N5: 80 });
  const menit = Object.fromEntries(Object.entries(STRATEGI).map(([k, v]) => [k, v.waktu.reduce((n, b) => n + b.m, 0)]));
  assert.deepEqual(menit, { N1: 165, N2: 155, N3: 140, N4: 115, N5: 90 });
});

test('section scores add up to 180 and minimums match the official table', () => {
  for (const [lv, s] of Object.entries(STRATEGI)) {
    assert.equal(s.skor.reduce((n, b) => n + b.max, 0), 180, lv);
    assert.equal(s.aman, s.lulus + 15, lv);
  }
  assert.deepEqual(STRATEGI.N4.skor.map(b => b.min), [38, 19]);
  assert.deepEqual(STRATEGI.N2.skor.map(b => b.min), [19, 19, 19]);
});

test('the split advice inside a combined section fills its time exactly', () => {
  for (const [lv, s] of Object.entries(STRATEGI)) {
    for (const b of s.waktu) if (b.saran) assert.equal(b.saran.reduce((n, [, m]) => n + m, 0), b.m, `${lv} ${b.k}`);
  }
});

test('an unknown level falls back to N3', () => {
  assert.equal(strategiUntuk('N9'), STRATEGI.N3);
  assert.equal(strategiUntuk('N1'), STRATEGI.N1);
});

test('every technique card has three tips', () => {
  assert.equal(TEKNIK.length, 6);
  for (const t of TEKNIK) assert.equal(t.tips.length, 3, t.id);
});

test('hidden card list from account data is cleaned', () => {
  assert.deepEqual(rapikanDisembunyikan(['bunpou', 'bunpou', 'palsu', 3, 'joho']), ['bunpou', 'joho']);
  assert.deepEqual(rapikanDisembunyikan('bunpou'), []);
  assert.deepEqual(rapikanDisembunyikan(undefined), []);
});

test('hiding and showing a card again', () => {
  assert.deepEqual(aturDisembunyikan(['joho'], 'bunpou', true), ['joho', 'bunpou']);
  assert.deepEqual(aturDisembunyikan(['joho', 'bunpou'], 'bunpou', true), ['joho', 'bunpou']);
  assert.deepEqual(aturDisembunyikan(['joho', 'bunpou'], 'bunpou', false), ['joho']);
});
