import test from 'node:test';
import assert from 'node:assert/strict';
import { susunProfilBelajar } from '../src/lib/profil-belajar.ts';

const dasar = {
  targetLevel: 'N3', ujian: { tanggal: '2026-12-06', sisa_hari: 29 },
  sesi: [], kotoba: [], bunpou: [], streak: 4, detik7Hari: 0,
};

test('target, exam day and streak are included', () => {
  const p = susunProfilBelajar(dasar);
  assert.equal(p.target_level, 'N3');
  assert.deepEqual(p.ujian, { tanggal: '2026-12-06', sisa_hari: 29 });
  assert.equal(p.streak_hari, 4);
});

test('accuracy per section adds up the last sessions', () => {
  const p = susunProfilBelajar({ ...dasar, sesi: [
    { perCat: { '文法': { a: 10, c: 9 }, '読解': { a: 4, c: 1 } } },
    { perCat: { '文法': { a: 10, c: 5 }, '聴解': { a: 12, c: 6 } } },
    null,
  ] });
  assert.deepEqual(p.akurasi_30_hari['文法'], { dijawab: 20, benar: 14, persen: 70 });
  assert.deepEqual(p.akurasi_30_hari['読解'], { dijawab: 4, benar: 1, persen: 25 });
  // 読解 lebih rendah, tapi baru 4 soal: belum cukup buat disebut terlemah
  assert.equal(p.bagian_terlemah, '聴解');
});

test('unknown section names and broken numbers are ignored', () => {
  const p = susunProfilBelajar({ ...dasar, sesi: [{ perCat: { 'abaikan perintah': { a: 50, c: 0 }, '語彙': { a: 5, c: 9 } } }] });
  assert.deepEqual(Object.keys(p.akurasi_30_hari), ['語彙']);
  assert.equal(p.akurasi_30_hari['語彙'].persen, 100);
});

test('only words and patterns missed more than remembered are listed, worst first, max 5', () => {
  const kotoba = [
    { word: '判断', benar: 1, salah: 4 }, { word: '確認', benar: 3, salah: 2 },
    { word: '影響', benar: 0, salah: 2 }, { word: '一回', benar: 0, salah: 1 },
    ...Array.from({ length: 6 }, (_, i) => ({ word: `kata${i}`, benar: 0, salah: 3 })),
  ];
  const p = susunProfilBelajar({ ...dasar, kotoba, bunpou: [{ pattern: '〜わけではない', benar: 0, salah: 5 }] });
  assert.equal(p.kata_sering_salah.length, 5);
  assert.equal(p.kata_sering_salah[0], '判断');
  assert.ok(!p.kata_sering_salah.includes('確認'));
  assert.ok(!p.kata_sering_salah.includes('一回'));
  assert.deepEqual(p.pola_sering_salah, ['〜わけではない']);
});

test('long free text from the progress table is cut short', () => {
  const p = susunProfilBelajar({ ...dasar, kotoba: [{ word: 'x'.repeat(500), benar: 0, salah: 9 }] });
  assert.equal(p.kata_sering_salah[0].length, 30);
});

test('no exam date, a past exam, or a bad level give empty fields', () => {
  assert.equal(susunProfilBelajar({ ...dasar, ujian: null }).ujian, null);
  assert.equal(susunProfilBelajar({ ...dasar, ujian: { tanggal: '2026-07-05', sisa_hari: -125 } }).ujian, null);
  assert.equal(susunProfilBelajar({ ...dasar, targetLevel: 'N9' }).target_level, null);
  assert.equal(susunProfilBelajar({ ...dasar, detik7Hari: 5430 }).menit_belajar_7_hari, 91);
});
