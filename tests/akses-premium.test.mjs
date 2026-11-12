import test from 'node:test';
import assert from 'node:assert/strict';
import { ruteTerkunci } from '../src/lib/akses-premium.ts';

test('practice players are locked after the trial', () => {
  for (const h of ['/latihan/kotoba?mode=baru&count=10', '/latihan/kilat', '/analisis-foto?session=abc', '/choukai/123',
    '/progres/ulangan', '/penempatan', '/latihan/9f1c2d3e-aaaa-bbbb-cccc-000000000000', 'https://www.honixjlpt.com/latihan/kilat?x=1']) {
    assert.equal(ruteTerkunci(h), true, h);
  }
});

test('browsing pages stay open (buttons inside get the lock instead)', () => {
  for (const h of ['/', '/materi', '/materi/kotoba', '/latihan/set', '/latihan/tugas', '/kamus', '/kamus/catatan', '/progres',
    '/progres?tab=tes', '/pengaturan', '/premium', '/langganan', '/choukai', '/latihan/kotobaku']) {
    assert.equal(ruteTerkunci(h), false, h);
  }
});
