import test from 'node:test';
import assert from 'node:assert/strict';
import { alasanTempo, detailTempo, alasanSalah, alasanMateri, alasanLatihan, hariKe } from '../src/lib/alasan-misi.ts';

const INTERVAL = [1, 3, 7, 21, 60];

test('review reason', () => {
  assert.equal(alasanTempo(14, false), 'Mulai lupa · jatuh tempo hari ini');
  assert.equal(alasanTempo(0, true), 'Mulai besok, kata yang mulai lupa muncul di sini.');
  assert.equal(alasanTempo(0, false), 'Belum ada yang mulai lupa hari ini');
});

test('"why these 14": most overdue first, SRS wording, rest summarised', () => {
  const d = detailTempo([
    { kunci: '〜わけだ', status: 'hafal', tahap: 4, jatuh_tempo: '2027-03-01' },
    { kunci: '影響', status: 'belajar', tahap: 3, jatuh_tempo: '2027-02-28' },
    { kunci: '我慢', status: 'belajar', tahap: 0, jatuh_tempo: '2027-03-01' },
    { kunci: 'x', status: 'belajar', tahap: 1, jatuh_tempo: '2027-03-01' },
  ], '2027-03-01', INTERVAL);
  assert.deepEqual(d.baris, [
    ['影響', 'Terakhir benar 8 hari lalu · jadwal ulang hari ke-7'],
    ['〜わけだ', 'Hafal · cek lagi di hari ke-21'],
    ['我慢', 'Salah kemarin · balik ke 1 hari'],
  ]);
  assert.equal(d.sisa, 1);
});

test('plain mission: often-wrong reason', () => {
  assert.equal(alasanSalah(9, 3), 'Sering salah · 9 kata & 3 pola salah ≥ 2×');
  assert.equal(alasanSalah(0, 2), 'Sering salah · 2 pola salah ≥ 2×');
  assert.equal(alasanSalah(0, 0), 'Semua lagi aman · gak ada yang sering salah');
});

test('new material reason: day n of 7, first day mentions placement', () => {
  assert.equal(hariKe('2027-03-02'), 2); // Selasa
  assert.equal(alasanMateri({ label: 'Unit minggu 12 dari 26', hariIni: '2027-03-02', mulaiPenempatan: true, hariPertama: false }), 'Unit minggu 12 dari 26 · hari ke-2 dari 7');
  assert.equal(alasanMateri({ label: 'Unit minggu 4 dari 26', hariIni: '2027-01-04', mulaiPenempatan: true, hariPertama: true }), 'Unit minggu 4 dari 26 · titik mulai dari tes penempatanmu');
});

test('practice reason: tier-up first, then estimate, then accuracy, then first day', () => {
  const bagian = [{ k: '言語知識', nilai: 30, min: 19 }, { k: '読解', nilai: 27, min: 19 }, { k: '聴解', nilai: 40, min: 19 }];
  assert.equal(alasanLatihan({ naik: { jenis: '文法形式の判断', t: 2 }, kategori: '文法', bertingkat: true }), '文法形式の判断 baru naik ke T2');
  // 読解 lebih dekat minimum, tapi yang dilatih 言語知識 → gak ngaku "paling dekat"
  assert.equal(alasanLatihan({ perkiraan: { bagian, dilatih: '言語知識' }, kategori: '文法', bertingkat: true }), '言語知識 dilatih biar makin aman · perkiraan 30, min 19');
  assert.equal(alasanLatihan({ perkiraan: { bagian: [{ k: '言語知識', nilai: 22, min: 19 }, ...bagian.slice(1)], dilatih: '言語知識' }, kategori: '文法', bertingkat: true }), '言語知識 paling dekat nilai minimum · perkiraan 22, min 19');
  assert.equal(alasanLatihan({ perCat: { 文法: { a: 40, c: 22 }, 語彙: { a: 30, c: 24 } }, kategori: '文法', bertingkat: false }), '文法 akurasinya paling rendah · 55% dari 40 jawaban');
  assert.equal(alasanLatihan({ perCat: { 文法: { a: 40, c: 36 }, 語彙: { a: 30, c: 24 } }, kategori: '文法', bertingkat: false }), '文法 akurasinya 90% dari 40 jawaban');
  assert.equal(alasanLatihan({ perCat: { 文法: { a: 4, c: 1 } }, kategori: '文法', bertingkat: true }), 'Mulai dari T1. Naik sendiri kalau benar ≥ 80%.');
  // misi pertama kurikulum: T1 dulu, walau ada data lama
  assert.equal(alasanLatihan({ perkiraan: { bagian, dilatih: '言語知識' }, kategori: '文法', bertingkat: true, pertama: true }), 'Mulai dari T1. Naik sendiri kalau benar ≥ 80%.');
});
