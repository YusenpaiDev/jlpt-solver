import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tingkatMenit, jamMenit, gabungHari, ringkasWaktu, selBulan, tambahHari, rekapPerHari, rentangBulan,
} from '../src/lib/waktu-kalender.ts';

test('stamp size follows the minute bands from the handoff', () => {
  assert.deepEqual([0, 1, 9, 10, 19, 20, 39, 40, 300].map(tingkatMenit), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('short and long durations read like the mockup', () => {
  assert.equal(jamMenit(45), '45 mnt');
  assert.equal(jamMenit(60), '1 j 0 m');
  assert.equal(jamMenit(135), '2 j 15 m');
});

test('day math crosses month and year ends', () => {
  assert.equal(tambahHari('2026-11-01', -1), '2026-10-31');
  assert.equal(tambahHari('2026-12-31', 1), '2027-01-01');
  assert.equal(tambahHari('2028-02-28', 1), '2028-02-29');
});

test('minutes and activity days are merged per date', () => {
  const hari = gabungHari(
    [{ tanggal: '2026-11-07', detik: 1250 }, { tanggal: '2026-11-08', detik: 30 }],
    [{ tanggal: '2026-11-01', sumber: ['kotoba'] }, { tanggal: '2026-11-07', sumber: ['soal', 'bunpou'] }],
  );
  assert.deepEqual(hari.get('2026-11-07'), { tanggal: '2026-11-07', menit: 21, aktif: true, sumber: ['soal', 'bunpou'] });
  assert.deepEqual(hari.get('2026-11-08'), { tanggal: '2026-11-08', menit: 1, aktif: false, sumber: [] });
  assert.deepEqual(hari.get('2026-11-01'), { tanggal: '2026-11-01', menit: 0, aktif: true, sumber: ['kotoba'] });
});

test('summary counts total, today, last 7 days and the record day', () => {
  const hari = gabungHari([
    { tanggal: '2026-10-20', detik: 50 * 60 },   // di luar 7 hari, tapi rekor
    { tanggal: '2026-11-03', detik: 10 * 60 },
    { tanggal: '2026-11-08', detik: 25 * 60 },
    { tanggal: '2026-11-09', detik: 50 * 60 },   // masa depan (jam lokal beda) gak dihitung ke 7 hari
  ], [{ tanggal: '2026-09-01', sumber: ['soal'] }]);
  const r = ringkasWaktu(hari, '2026-11-08');
  assert.equal(r.totalMenit, 135);
  assert.equal(r.hariIni, 25);
  assert.equal(r.tujuhHari, 35);
  assert.equal(r.rataTujuhHari, 5);
  assert.deepEqual(r.rekor, { tanggal: '2026-10-20', menit: 50 });
  // "Sejak" = hari pertama menit kecatat, bukan hari aktivitas lama tanpa menit
  assert.equal(r.sejak, '2026-10-20');
  assert.equal(r.hariBelajar, 4);
});

test('an account without any data gets an empty summary', () => {
  const r = ringkasWaktu(new Map(), '2026-11-08');
  assert.deepEqual(r, { totalMenit: 0, hariIni: 0, tujuhHari: 0, rataTujuhHari: 0, rekor: null, sejak: null, hariBelajar: 0 });
});

test('month grid starts on Monday', () => {
  assert.deepEqual(selBulan(2026, 10), { kosongDepan: 6, jumlahHari: 30 }); // 1 Nov 2026 = Minggu
  assert.deepEqual(selBulan(2026, 1), { kosongDepan: 6, jumlahHari: 28 });  // 1 Feb 2026 = Minggu
  assert.deepEqual(selBulan(2026, 5), { kosongDepan: 0, jumlahHari: 30 });  // 1 Jun 2026 = Senin
});

test('month navigation spans from the first data month to this month', () => {
  const hari = gabungHari([{ tanggal: '2026-11-07', detik: 60 }], [{ tanggal: '2026-08-15', sumber: ['soal'] }]);
  assert.deepEqual(rentangBulan(hari, '2026-11-08'), { awal: [2026, 7], akhir: [2026, 10] });
  assert.deepEqual(rentangBulan(new Map(), '2026-11-08'), { awal: [2026, 10], akhir: [2026, 10] });
});

test('practice sessions are grouped per local day with their sections', () => {
  const r = rekapPerHari([
    { tanggal: '2026-11-07', soal: 20, bagian: ['文法', '読解'] },
    { tanggal: '2026-11-07', soal: 5, bagian: ['文法'] },
    { tanggal: '2026-11-06', soal: 0, bagian: ['聴解'] },
  ]);
  assert.deepEqual(r.get('2026-11-07'), { soal: 25, bagian: ['文法', '読解'] });
  assert.equal(r.has('2026-11-06'), false);
});
