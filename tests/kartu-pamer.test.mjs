import test from 'node:test';
import assert from 'node:assert/strict';
import { susunKartu } from '../src/lib/kartu-pamer.ts';

const dasar = {
  hariIni: '2026-11-09', waktu: [], aktivitas: [], streak: 0, level: 'N2', sesiLabel: 'Desember 2026', tesTotal: [], nama: null,
};

test('total hours and this month calendar from minutes and activity days', () => {
  const k = susunKartu({
    ...dasar,
    waktu: [{ tanggal: '2026-10-30', detik: 3600 * 5 }, { tanggal: '2026-11-02', detik: 1500 }, { tanggal: '2026-11-09', detik: 900 }],
    aktivitas: [{ tanggal: '2026-11-04' }, { tanggal: '2026-11-02' }, { tanggal: '2026-10-01' }],
  });
  assert.equal(k.jam, 5);          // 300 + 25 + 15 = 340 menit
  assert.equal(k.menit, 340);
  assert.equal(k.bulanLabel, 'November 2026');
  assert.equal(k.kosongDepan, 6);  // 1 Nov 2026 = Minggu
  assert.equal(k.jumlahHari, 30);
  assert.deepEqual(k.aktif.map((a, i) => (a ? i + 1 : 0)).filter(Boolean), [2, 4, 9]);
  assert.equal(k.hariBulan, 3);
  assert.equal(k.tanggalLabel, '9 Nov 2026');
});

test('target line, best mini test, and the optional name', () => {
  const k = susunKartu({ ...dasar, streak: 13, tesTotal: [104, 117, null, 99], nama: 'Yusuf' });
  assert.equal(k.target, 'N2 · Desember 2026');
  assert.equal(k.tesTerbaik, 117);
  assert.equal(k.streak, 13);
  assert.equal(k.nama, 'Yusuf');
  assert.equal(susunKartu({ ...dasar, sesiLabel: null }).target, 'N2');
});

test('no mini test yet → no best score; name is trimmed and capped, never an email', () => {
  assert.equal(susunKartu(dasar).tesTerbaik, null);
  assert.equal(susunKartu({ ...dasar, nama: '  ' }).nama, null);
  assert.equal(susunKartu({ ...dasar, nama: 'yusuf@gmail.com' }).nama, null);
  assert.equal(susunKartu({ ...dasar, nama: 'x'.repeat(60) }).nama.length, 24);
});
