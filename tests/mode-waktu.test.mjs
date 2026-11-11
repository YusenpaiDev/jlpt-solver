import test from 'node:test';
import assert from 'node:assert/strict';
import {
  susunUnit, susunJadwal, mingguKe, letakUnit, statusUnit, jadwalSimulasi, labelPosisi, gabungUnit, tanggalMinggu,
} from '../src/lib/kurikulum.ts';

const W = { akhir: 4, maksPerMinggu: 2, cadangan: 1, simulasiKejar: 14 };
const kur = (tanggal_mulai, tanggal_ujian, unit_mulai = 1) => ({ level: 'N3', tanggal_mulai, unit_mulai, tanggal_ujian });
const units = j => j.minggu.flat();

test('priority: most frequent words & patterns go to the first units, ties keep group mixing', () => {
  const kata = Array.from({ length: 52 }, (_, i) => ({ word: `w${i}`, group: i < 26 ? 'あ行' : 'か行' }));
  const pola = Array.from({ length: 26 }, (_, i) => ({ pattern: `p${i}`, functionGroup: 'g' }));
  const u = susunUnit(kata, pola, { kata: { w51: 9, w30: 5 }, pola: { p25: 3 } });
  assert.deepEqual(u[0].kata, ['w51', 'w30']);
  assert.deepEqual(u[0].pola, ['p25']);
  // tanpa skor: tetap bergiliran antar kelompok
  assert.deepEqual(u[1].kata, ['w0', 'w26']);
  assert.equal(new Set(u.flatMap(x => x.kata)).size, 52);
  // tanpa data prioritas = urutan lama
  assert.deepEqual(susunUnit(kata, pola)[0].kata, ['w0', 'w26']);
});

test('normal: 26 weeks for 26 units (exam 4 Jul 2027, start 4 Jan)', () => {
  const j = susunJadwal(kur('2027-01-04', '2027-07-04'), W);
  assert.equal(j.mode, 'normal');
  assert.equal(j.minggu.length, 26);
  assert.deepEqual(j.minggu[0], [1]);
  assert.deepEqual(j.minggu[25], [26]);
  assert.equal(j.sampai, 26);
});

test('normal with spare time: extra weeks at the end are reserve weeks', () => {
  const j = susunJadwal(kur('2026-11-16', '2027-07-04'), W);
  assert.equal(j.mode, 'normal');
  assert.equal(j.minggu.length, 33);
  assert.deepEqual(j.minggu[25], [26]);
  assert.deepEqual(j.minggu.slice(26), Array(7).fill([]));
});

test('placement shortens the plan: start from unit 12 with 18 weeks left is still normal', () => {
  const j = susunJadwal(kur('2027-03-01', '2027-07-04', 12), W);
  assert.equal(j.mode, 'normal');
  assert.deepEqual(j.minggu[0], [12]);
  assert.deepEqual(units(j), Array.from({ length: 15 }, (_, i) => 12 + i));
});

test('padat: 18 weeks for 26 units → max 2 per week, last week kept for review', () => {
  const j = susunJadwal(kur('2027-03-01', '2027-07-04'), W);
  assert.equal(j.mode, 'padat');
  assert.equal(j.minggu.length, 18);
  assert.deepEqual(units(j), Array.from({ length: 26 }, (_, i) => i + 1));
  assert.ok(j.minggu.slice(0, 17).every(m => m.length >= 1 && m.length <= 2));
  assert.deepEqual(j.minggu[17], []);
  assert.equal(j.sampai, 26);
});

test('kejar: 9 weeks → 16 units scheduled, the rest stays open but off-schedule', () => {
  const j = susunJadwal(kur('2027-05-03', '2027-07-04'), W);
  assert.equal(j.mode, 'kejar');
  assert.equal(j.sampai, 16);
  assert.deepEqual(units(j), Array.from({ length: 16 }, (_, i) => i + 1));
  assert.deepEqual(j.minggu[8], []);
});

test('akhir: exam 6 Dec 2026 seen from 16 Nov → no new material', () => {
  const j = susunJadwal(kur('2026-11-16', '2026-12-06'), W);
  assert.equal(j.mode, 'akhir');
  assert.deepEqual(j.minggu, [[], [], []]);
  assert.equal(j.sampai, 0);
});

test('no exam date: plain 26 weeks', () => {
  const j = susunJadwal(kur('2027-01-04', null, 4), W);
  assert.equal(j.mode, 'normal');
  assert.equal(j.minggu.length, 23);
});

test('week index, unit location, dates', () => {
  const k = kur('2027-03-03', '2027-07-04');
  const j = susunJadwal(k, W);
  assert.equal(mingguKe(k, '2027-03-01'), 0);
  assert.equal(mingguKe(k, '2027-03-08'), 1);
  assert.equal(mingguKe(k, '2027-02-20'), 0); // sebelum mulai
  const letak = letakUnit(j);
  assert.equal(letak.get(1), 0);
  assert.equal(letak.get(26), 16);
  assert.deepEqual(tanggalMinggu(k, 1), ['2027-03-08', '2027-03-14']);
});

test('unit status follows the schedule', () => {
  const full = [10, 0, 0, 0], open = [5, 0, 0, 5];
  const letak = new Map([[4, 0], [5, 1], [6, 1], [7, 2]]);
  assert.equal(statusUnit(2, 4, letak, 1, full, full), 'skip');
  assert.equal(statusUnit(5, 4, letak, 1, open, open), 'cur');
  assert.equal(statusUnit(6, 4, letak, 1, open, open), 'cur');
  assert.equal(statusUnit(7, 4, letak, 1, open, open), 'next');
  assert.equal(statusUnit(4, 4, letak, 1, full, [3, 1, 0, 0]), 'done');
  assert.equal(statusUnit(4, 4, letak, 1, open, full), 'part');
  assert.equal(statusUnit(20, 4, letak, 1, open, open), 'luar');
});

test('two units in a week merge into one study set', () => {
  const u = [
    { u: 5, kata: ['a', 'b'], pola: ['x'], jenis: ['漢字読み', '表記'] },
    { u: 6, kata: ['c'], pola: ['y'], jenis: ['文脈規定', '用法'] },
  ];
  assert.deepEqual(gabungUnit(u), { u: 6, kata: ['a', 'b', 'c'], pola: ['x', 'y'], jenis: ['漢字読み', '表記'] });
  assert.equal(gabungUnit([]), null);
});

test('simulation schedule per mode', () => {
  // normal & padat tetap bulanan
  assert.deepEqual(jadwalSimulasi('2027-01-04', '2027-07-04', 'normal', 14),
    ['2027-01-30', '2027-02-27', '2027-03-27', '2027-04-24', '2027-05-29', '2027-06-20']);
  // kejar: tiap 2 minggu (Sabtu) + 2 minggu sebelum ujian
  assert.deepEqual(jadwalSimulasi('2027-05-03', '2027-07-04', 'kejar', 14),
    ['2027-05-15', '2027-05-29', '2027-06-12', '2027-06-20']);
  // simulasi rutin yang jaraknya < 7 hari dari simulasi terakhir dibuang (gak dobel)
  assert.deepEqual(jadwalSimulasi('2026-10-26', '2027-01-03', 'kejar', 14),
    ['2026-11-07', '2026-11-21', '2026-12-05', '2026-12-20']);
  assert.deepEqual(jadwalSimulasi('2027-03-01', '2027-07-04', 'normal', 14).slice(-2), ['2027-05-29', '2027-06-20']);
  // akhir: 2 minggu & 1 minggu sebelum ujian, yang masih kekejar
  assert.deepEqual(jadwalSimulasi('2026-11-16', '2026-12-06', 'akhir', 14), ['2026-11-22', '2026-11-29']);
  assert.deepEqual(jadwalSimulasi('2026-11-25', '2026-12-06', 'akhir', 14), ['2026-11-29']);
});

test('position label', () => {
  assert.equal(labelPosisi('normal', [12]), 'Minggu 12 dari 26');
  assert.equal(labelPosisi('padat', [5, 6]), 'Unit 5–6 dari 26');
  assert.equal(labelPosisi('kejar', [3]), 'Unit 3 dari 26');
  assert.equal(labelPosisi('normal', []), 'masa cadangan');
  assert.equal(labelPosisi('akhir', []), 'mode akhir');
});
