import test from 'node:test';
import assert from 'node:assert/strict';
import { rapikanPref, instruksiPref, PREF_AWAL } from '../src/lib/preferensi-ai.ts';

test('garbage metadata falls back to defaults', () => {
  assert.deepEqual(rapikanPref(undefined), PREF_AWAL);
  assert.deepEqual(rapikanPref({ gaya: 'lengkap', contoh: false, furigana: 'semua' }), { gaya: 'lengkap', contoh: false, furigana: 'semua' });
  assert.deepEqual(rapikanPref({ gaya: 'x', contoh: 'ya', furigana: 9 }), PREF_AWAL);
});

test('instructions follow each preference', () => {
  const singkat = instruksiPref(PREF_AWAL, 'N3');
  assert.equal(singkat.maksToken, 280);
  assert.match(singkat.teks, /SINGKAT/);
  assert.match(singkat.teks, /contoh kalimat pendek/);
  assert.match(singkat.teks, /di atas level N3/);
  const lengkap = instruksiPref({ gaya: 'lengkap', contoh: false, furigana: 'mati' }, 'N2');
  assert.equal(lengkap.maksToken, 520);
  assert.match(lengkap.teks, /LENGKAP/);
  assert.match(lengkap.teks, /Gak usah kasih contoh/);
  assert.match(lengkap.teks, /Jangan tulis cara baca/);
});
