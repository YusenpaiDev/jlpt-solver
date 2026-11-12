import test from 'node:test';
import assert from 'node:assert/strict';
import { halamanBelajar, detikDihitung, BATAS_DIAM_MS } from '../src/lib/waktu-belajar.ts';

test('study pages are counted, including nested routes', () => {
  for (const p of ['/materi', '/materi/bunpou', '/latihan/kilat', '/analisis-foto', '/choukai/abc', '/latihan/tugas', '/kamus', '/kamus/catatan']) {
    assert.equal(halamanBelajar(p), true, p);
  }
});

test('non-study pages are not counted', () => {
  for (const p of ['/', '/pengaturan', '/langganan', '/login', '/statistik', '/progres', '/admin', '/materiku', '/latihan/set']) {
    assert.equal(halamanBelajar(p), false, p);
  }
});

const t0 = 1_000_000;

test('a visible tab with recent input counts', () => {
  assert.equal(detikDihitung({ sekarang: t0 + 5_000, terakhirGerak: t0, terlihat: true, mediaJalan: false }), true);
  assert.equal(detikDihitung({ sekarang: t0 + BATAS_DIAM_MS, terakhirGerak: t0, terlihat: true, mediaJalan: false }), true);
});

test('two idle minutes stop the count', () => {
  assert.equal(detikDihitung({ sekarang: t0 + BATAS_DIAM_MS + 1, terakhirGerak: t0, terlihat: true, mediaJalan: false }), false);
});

test('playing audio keeps counting while the user just listens', () => {
  assert.equal(detikDihitung({ sekarang: t0 + 10 * 60_000, terakhirGerak: t0, terlihat: true, mediaJalan: true }), true);
});

test('a hidden tab never counts', () => {
  assert.equal(detikDihitung({ sekarang: t0 + 1_000, terakhirGerak: t0, terlihat: false, mediaJalan: true }), false);
});
