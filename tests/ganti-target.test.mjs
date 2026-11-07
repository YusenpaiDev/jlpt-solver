import test from 'node:test';
import assert from 'node:assert/strict';
import { cekAlasan, levelValid, isiEmailGantiTarget, ALASAN_MAKS } from '../src/lib/ganti-target.ts';

test('only real JLPT levels are accepted', () => {
  for (const l of ['N1', 'N2', 'N3', 'N4', 'N5']) assert.equal(levelValid(l), true);
  for (const l of ['N6', 'n3', '', null, 3]) assert.equal(levelValid(l), false);
});

test('a reason is required and trimmed', () => {
  assert.equal(cekAlasan('').ok, false);
  assert.equal(cekAlasan('   ok  ').ok, false);
  assert.equal(cekAlasan(undefined).ok, false);
  assert.deepEqual(cekAlasan('  Ujian  N3 sudah   lulus \n'), { ok: true, alasan: 'Ujian N3 sudah lulus' });
});

test('a very long reason is rejected', () => {
  assert.equal(cekAlasan('a'.repeat(ALASAN_MAKS)).ok, true);
  assert.equal(cekAlasan('a'.repeat(ALASAN_MAKS + 1)).ok, false);
});

test('the admin email names the account, both levels and the reason', () => {
  const e = isiEmailGantiTarget({ email: 'a@b.c', nama: 'Aichan', dari: 'N3', ke: 'N2', alasan: 'Sudah lulus N3' });
  assert.equal(e.subjek, 'Ganti target: N3 → N2 · a@b.c');
  assert.match(e.teks, /Aichan \(a@b\.c\) ganti level target N3 → N2/);
  assert.match(e.teks, /Sudah lulus N3/);
});

test('an account without a previous level still gets a readable email', () => {
  const e = isiEmailGantiTarget({ email: null, nama: null, dari: null, ke: 'N4', alasan: 'Mulai dari bawah' });
  assert.match(e.subjek, /\? → N4/);
  assert.match(e.teks, /\(belum ada\) → N4/);
});
