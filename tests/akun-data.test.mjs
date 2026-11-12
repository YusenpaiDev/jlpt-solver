import test from 'node:test';
import assert from 'node:assert/strict';
import { TABEL_PROGRES, TABEL_AKUN, cocokKonfirmasi, tabelGakAda } from '../src/lib/akun-data.ts';

test('reset keeps Kamus, notes, XP and subscription', () => {
  for (const t of ['saved_words', 'catatan', 'profiles', 'transaksi', 'kurikulum_user']) assert.ok(!TABEL_PROGRES.includes(t), t);
  for (const t of ['sessions', 'kotoba_progress', 'bunpou_progress', 'aktivitas_harian', 'item_status']) assert.ok(TABEL_PROGRES.includes(t), t);
});

test('account deletion covers progress + personal data', () => {
  for (const t of TABEL_PROGRES) assert.ok(TABEL_AKUN.includes(t), t);
  for (const t of ['saved_words', 'catatan', 'kurikulum_user', 'ganti_target']) assert.ok(TABEL_AKUN.includes(t), t);
});

test('typed confirmation', () => {
  assert.equal(cocokKonfirmasi('reset', ' reset '), true);
  assert.equal(cocokKonfirmasi('hapus', 'HAPUS'), true);
  assert.equal(cocokKonfirmasi('hapus', 'RESET'), false);
  assert.equal(cocokKonfirmasi('hapus', undefined), false);
});

test('missing tables are skipped, other errors are not', () => {
  assert.equal(tabelGakAda({ code: '42P01', message: 'relation "public.ulangan" does not exist' }), true);
  assert.equal(tabelGakAda({ code: 'PGRST205', message: "Could not find the table 'public.simulasi'" }), true);
  assert.equal(tabelGakAda({ code: '42501', message: 'permission denied' }), false);
  assert.equal(tabelGakAda(null), false);
  assert.equal(tabelGakAda({ code: '42703', message: 'column "user_id" does not exist' }), false);
  assert.equal(tabelGakAda({ message: 'function public.x() does not exist' }), false);
});
