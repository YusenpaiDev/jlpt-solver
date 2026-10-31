import test from 'node:test';
import assert from 'node:assert/strict';
import * as paket from '../src/lib/batas-paket.ts';
const daftar = '2026-10-01T12:00:00.000Z';
const akhir = Date.parse('2026-10-08T12:00:00.000Z');
test('trial starts at signup and expires exactly after seven days', () => {
  assert.equal(typeof paket.statusAkses, 'function');
  assert.equal(paket.statusAkses(daftar, false, akhir - 1).status, 'trial');
  assert.equal(paket.statusAkses(daftar, false, akhir).status, 'expired');
  assert.equal(paket.statusAkses(daftar, false, akhir + 1).boleh, false);
});
test('old accounts do not receive a new trial', () => {
  assert.equal(paket.statusAkses(daftar, false, akhir + 86400000).boleh, false);
});
test('active Pro remains unlimited after the trial expires', () => {
  const akses = paket.statusAkses(daftar, true, akhir + 86400000);
  assert.equal(akses.status, 'pro');
  assert.equal(akses.boleh, true);
  for (const fitur of Object.values(paket.BATAS)) assert.equal(fitur.pro, null);
});
test('invalid or future signup dates cannot grant trial access', () => {
  for (const tanggal of [null, '', 'invalid', '2030-01-01T00:00:00Z']) {
    assert.equal(paket.statusAkses(tanggal, false, akhir).boleh, false);
  }
});
