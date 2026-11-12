import test from 'node:test';
import assert from 'node:assert/strict';
import { buatIcs, hariBerikut } from '../src/lib/pengingat-ics.ts';

const dasar = { jam: '19:30', menit: 20, mulai: '2026-11-12', ulangan: false, url: 'https://www.honixjlpt.com', kini: new Date('2026-11-12T03:04:05Z') };

test('next weekday from a date', () => {
  assert.equal(hariBerikut('2026-11-12', 6), '2026-11-14'); // Kamis → Sabtu
  assert.equal(hariBerikut('2026-11-14', 6), '2026-11-14'); // Sabtu → hari itu
  assert.equal(hariBerikut('2026-11-12', 1), '2026-11-16'); // → Senin
});

test('daily study reminder + weekly mini test, CRLF, alarm', () => {
  const s = buatIcs(dasar);
  assert.ok(s.startsWith('BEGIN:VCALENDAR\r\n') && s.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(s), 'semua baris CRLF');
  assert.ok(s.includes('DTSTART:20261112T193000\r\nDURATION:PT20M\r\nRRULE:FREQ=DAILY'));
  assert.ok(s.includes('SUMMARY:Belajar Honix · misi 20 menit'));
  assert.ok(s.includes('DTSTART:20261114T193000\r\nDURATION:PT15M\r\nRRULE:FREQ=WEEKLY;BYDAY=SA'));
  assert.equal(s.match(/BEGIN:VALARM/g).length, 2);
  assert.ok(s.includes('DTSTAMP:20261112T030405Z'));
});

test('weekly review on Monday once it is live', () => {
  const s = buatIcs({ ...dasar, ulangan: true });
  assert.ok(s.includes('DTSTART:20261116T193000\r\nDURATION:PT10M\r\nRRULE:FREQ=WEEKLY;BYDAY=MO'));
  assert.ok(!s.includes('BYDAY=SA'));
});
