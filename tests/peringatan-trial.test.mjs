import test from 'node:test';
import assert from 'node:assert/strict';
import { peringatanTrial, langkahPembukaTrial, perluPopupTrial, langkahPopupTrial, POPUP_TRIAL_HABIS } from '../src/lib/peringatan-trial.ts';
import { statusAkses } from '../src/lib/batas-paket.ts';

const daftar = '2026-11-01T00:00:00Z';
const jam = h => new Date(Date.parse(daftar) + h * 3_600_000);

test('a new trial account is told on day one that access lasts a week', () => {
  const p = peringatanTrial(statusAkses(daftar, false, +jam(1)), jam(1));
  assert.equal(p.judul, 'Masa percobaan tinggal 7 hari');
  assert.equal(p.tingkat, 'ingat');
  assert.match(p.pesan, /Bank Soal.*Bunpou.*Kotoba/);
  assert.match(p.pesan, /berlangganan Pro/);
  assert.equal(p.aksi.href, '/premium');
});

test('the last two days become urgent and the final day counts hours', () => {
  const duaHari = peringatanTrial(statusAkses(daftar, false, +jam(130)), jam(130));
  assert.equal(duaHari.tingkat, 'genting');
  assert.equal(duaHari.judul, 'Masa percobaan tinggal 2 hari');
  const akhir = peringatanTrial(statusAkses(daftar, false, +jam(160)), jam(160));
  assert.equal(akhir.judul, 'Masa percobaan habis 8 jam lagi');
});

test('Pro, expired, and unknown access stay quiet', () => {
  assert.equal(peringatanTrial(statusAkses(daftar, true, +jam(1)), jam(1)), null);
  assert.equal(peringatanTrial(statusAkses(daftar, false, +jam(200)), jam(200)), null);
  assert.equal(peringatanTrial(null, jam(1)), null);
});

const tur = (halaman = {}) => ({ terakhir: null, ingatkan: true, halaman });

test('the first tour slide tells trial users they get a week, Pro users get the normal hello', () => {
  const awal = langkahPembukaTrial(statusAkses(daftar, false, +jam(1)), 7);
  assert.equal(awal.judul, 'Kamu dapat 7 hari akses penuh!');
  assert.equal(awal.target, null);
  assert.match(awal.isi, /Pro/);
  assert.equal(langkahPembukaTrial(statusAkses(daftar, true, +jam(1)), 7), null);
});

test('the "2 days left" popup shows once per account and only near the end', () => {
  const akses = statusAkses(daftar, false, +jam(130));
  assert.equal(perluPopupTrial(statusAkses(daftar, false, +jam(100)), tur(), jam(100)), false);
  assert.equal(perluPopupTrial(akses, tur(), jam(130)), true);
  assert.equal(perluPopupTrial(akses, tur({ [POPUP_TRIAL_HABIS]: jam(129).toISOString() }), jam(130)), false);
  assert.equal(perluPopupTrial(statusAkses(daftar, true, +jam(130)), tur(), jam(130)), false);
  assert.equal(langkahPopupTrial(akses, jam(130)).judul, 'Masa percobaan tinggal 2 hari');
});
