import test from 'node:test';
import assert from 'node:assert/strict';
import { periksaCapBaru } from '../src/lib/cap-baru.ts';

test('first stamp of the day plays, then stays quiet until it grows', () => {
  const a = periksaCapBaru(null, '2026-11-10', 1);
  assert.equal(a.baru, true);
  const b = periksaCapBaru(a.simpan, '2026-11-10', 1);
  assert.equal(b.baru, false);
  const c = periksaCapBaru(b.simpan, '2026-11-10', 2); // naik tingkat: 10 menit
  assert.equal(c.baru, true);
  assert.equal(periksaCapBaru(c.simpan, '2026-11-10', 2).baru, false);
});

test('a new day plays again, a smaller stamp never does', () => {
  const kemarin = JSON.stringify({ t: '2026-11-09', k: 4 });
  assert.equal(periksaCapBaru(kemarin, '2026-11-10', 1).baru, true);
  const hariIni = JSON.stringify({ t: '2026-11-10', k: 3 });
  assert.equal(periksaCapBaru(hariIni, '2026-11-10', 2).baru, false);
  assert.equal(JSON.parse(periksaCapBaru(hariIni, '2026-11-10', 2).simpan).k, 3);
});

test('no stamp today or broken storage', () => {
  assert.equal(periksaCapBaru(null, '2026-11-10', 0).baru, false);
  assert.equal(periksaCapBaru('{rusak', '2026-11-10', 1).baru, true);
  assert.equal(periksaCapBaru(JSON.stringify({ t: 5, k: 'x' }), '2026-11-10', 1).baru, true);
});
