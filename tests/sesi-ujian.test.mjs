import test from 'node:test';
import assert from 'node:assert/strict';
import { mingguPertama, daftarSesiUjian, rapikanTanggalUjian, hariMenuju, labelSesi } from '../src/lib/sesi-ujian.ts';

test('JLPT falls on the first Sunday of the month', () => {
  assert.equal(mingguPertama(2026, 12), '2026-12-06');
  assert.equal(mingguPertama(2027, 7), '2027-07-04');
  assert.equal(mingguPertama(2027, 12), '2027-12-05');
  assert.equal(mingguPertama(2028, 7), '2028-07-02');
  assert.equal(mingguPertama(2024, 12), '2024-12-01'); // tanggal 1 sudah Minggu
});

test('from 7 Nov 2026 the next four sessions reach July 2028', () => {
  const s = daftarSesiUjian(new Date(2026, 10, 7, 9));
  assert.deepEqual(s.map(x => x.iso), ['2026-12-06', '2027-07-04', '2027-12-05', '2028-07-02']);
  assert.equal(s[0].label, 'Desember 2026');
  assert.equal(s[0].hari, 29);
});

test('the exam day itself is still offered, the day after is not', () => {
  assert.equal(daftarSesiUjian(new Date(2026, 11, 6, 20))[0].iso, '2026-12-06');
  assert.equal(daftarSesiUjian(new Date(2026, 11, 7, 1))[0].iso, '2027-07-04');
});

test('old month-only exam dates are corrected to the real exam day', () => {
  assert.equal(rapikanTanggalUjian('2026-12'), '2026-12-06');
  assert.equal(rapikanTanggalUjian('2027-07'), '2027-07-04');
});

test('full dates are kept, empty or broken values become null', () => {
  assert.equal(rapikanTanggalUjian('2026-12-06'), '2026-12-06');
  for (const x of ['none', '', null, undefined, '2026-13', '2026-02-30', 'Desember', 42]) {
    assert.equal(rapikanTanggalUjian(x), null, String(x));
  }
});

test('days to the exam count calendar days', () => {
  assert.equal(hariMenuju('2026-12-06', new Date(2026, 11, 5, 23, 59)), 1);
  assert.equal(hariMenuju('2026-12-06', new Date(2026, 11, 6, 0, 1)), 0);
  assert.equal(labelSesi('2028-07-02'), 'Juli 2028');
});
