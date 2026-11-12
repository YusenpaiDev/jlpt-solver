import test from 'node:test';
import assert from 'node:assert/strict';
import { bolehKenalan, BATAS_PAKAI, TAHAN_MS, kunciKenalan } from '../src/lib/kenalan.ts';

const dasar = { live: true, dilihat: undefined, pakai: 0, turJalan: false, obSelesai: null, kini: 1_000_000 };

test('intro card shows once for a live feature', () => {
  assert.equal(bolehKenalan(dasar), true);
  assert.equal(bolehKenalan({ ...dasar, dilihat: '2026-11-12T00:00:00Z' }), false);
});

test('never for a feature that is not live yet', () => {
  assert.equal(bolehKenalan({ ...dasar, live: false }), false);
});

test('stops after the feature is used 3x without closing the card', () => {
  assert.equal(bolehKenalan({ ...dasar, pakai: BATAS_PAKAI - 1 }), true);
  assert.equal(bolehKenalan({ ...dasar, pakai: BATAS_PAKAI }), false);
});

test('waits during the tour and right after onboarding', () => {
  assert.equal(bolehKenalan({ ...dasar, turJalan: true }), false);
  assert.equal(bolehKenalan({ ...dasar, obSelesai: dasar.kini - TAHAN_MS + 1 }), false);
  assert.equal(bolehKenalan({ ...dasar, obSelesai: dasar.kini - TAHAN_MS }), true);
});

test('storage key', () => {
  assert.equal(kunciKenalan('bebas_bank'), 'kenalan:bebas_bank');
});
