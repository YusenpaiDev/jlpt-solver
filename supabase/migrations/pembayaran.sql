-- ============================================================
-- Pembayaran: tabel transaksi + masa berlaku Pro.
--
-- Dua lubang yang ditutup di sini:
--
--   1. Gak ada masa berlaku. `profiles.is_premium` cuma boolean — sekali
--      true, Pro selamanya. Paket "Bulanan" Rp129rb praktisnya jadi lifetime,
--      dan gak ada cara tau kapan seseorang harus dicabut selain diingat
--      manual.
--
--   2. Webhook nebak pemilik pembayaran. Versi lama nyimpen 8 karakter
--      pertama UUID di order_id, lalu nyari `LIKE '<8 karakter>%'` + limit(1).
--      Dua user dengan prefix UUID sama = premium nyasar ke akun orang lain.
--      Sekarang barisnya dicatat SEBELUM user dilempar ke Snap, dan webhook
--      tinggal cari lewat order_id.
--
-- Jalanin di Supabase → SQL Editor → Run. Idempoten.
-- ============================================================


-- ── 1. Masa berlaku Pro ──────────────────────────────────────
-- null = gak punya langganan berbayar (atau Lifetime, lihat is_lifetime).

alter table public.profiles
  add column if not exists premium_until timestamptz,
  add column if not exists is_lifetime   boolean not null default false;


-- ── 2. Transaksi ─────────────────────────────────────────────
-- Dibikin waktu user mulai bayar, di-update pas webhook masuk. Jadi jejak
-- kalau ada sengketa — dulu gak ada catatan sama sekali.

create table if not exists public.transaksi (
  order_id     text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  paket_id     text not null,
  jumlah       integer not null,
  status       text not null default 'pending'
                 check (status in ('pending','lunas','gagal','kadaluarsa','refund')),
  midtrans     jsonb,                  -- payload webhook mentah, buat audit
  dibuat       timestamptz not null default now(),
  diperbarui   timestamptz not null default now()
);

create index if not exists transaksi_user_idx on public.transaksi (user_id, dibuat desc);

alter table public.transaksi enable row level security;

-- User boleh lihat riwayat pembayarannya sendiri. Nulis cuma dari server
-- (service role) — gak ada policy INSERT/UPDATE, jadi status "lunas" gak bisa
-- dikarang dari browser.
drop policy if exists "transaksi: baca sendiri" on public.transaksi;
create policy "transaksi: baca sendiri" on public.transaksi
  for select to authenticated using (auth.uid() = user_id);


-- ── 3. is_pro() ngerti masa berlaku ──────────────────────────
--
-- Urutan: Lifetime → langganan yang belum lewat tanggal → whitelist.
-- `is_premium` yang lama tetap dibaca supaya akun yang udah terlanjur
-- di-set true gak tiba-tiba kehilangan akses pas migrasi ini jalan.

create or replace function public.is_pro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select p.is_lifetime from public.profiles p where p.id = auth.uid()), false)
    or coalesce((select p.premium_until > now() from public.profiles p where p.id = auth.uid()), false)
    or coalesce((select p.is_premium from public.profiles p where p.id = auth.uid()), false)
    or exists (
      select 1
      from public.pro_whitelist w
      where lower(w.email) = lower((select u.email from auth.users u where u.id = auth.uid()))
    );
$$;

grant execute on function public.is_pro() to authenticated;


-- ── 4. Aktifkan Pro sesudah pembayaran lunas ─────────────────
--
-- Dipanggil server (service role) dari webhook. Menambah masa berlaku dari
-- sisa yang ADA, bukan dari hari ini — biar orang yang perpanjang sebelum
-- habis gak kehilangan sisa harinya.

create or replace function public.aktifkan_pro(
  p_user_id uuid,
  p_bulan   int      -- null = lifetime
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  mulai timestamptz;
  sampai timestamptz;
begin
  if p_bulan is null then
    update public.profiles set is_lifetime = true where id = p_user_id;
    return null;
  end if;

  select greatest(coalesce(premium_until, now()), now()) into mulai
  from public.profiles where id = p_user_id;

  sampai := mulai + make_interval(months => p_bulan);
  update public.profiles set premium_until = sampai where id = p_user_id;
  return sampai;
end;
$$;

revoke execute on function public.aktifkan_pro(uuid, int) from anon, authenticated;
