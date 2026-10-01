import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Status satu pesanan, buat layar /premium/sukses yang polling.
 *
 * Sengaja cuma BACA. Yang nyalain Pro tetap webhook Midtrans → server;
 * endpoint ini cuma nanya ke DB "udah sampai belum". Dibaca pakai sesi user
 * (bukan service role), jadi RLS "transaksi: baca sendiri" yang mastiin orang
 * gak bisa ngintip pesanan akun lain cuma dengan nebak order_id.
 *
 * Tanpa ?order_id → pesanan terakhir user. Kejadian kalau orang balik ke
 * halaman sukses dari bookmark / riwayat browser tanpa query.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Login dulu." }, { status: 401 });
  }

  const orderId = req.nextUrl.searchParams.get("order_id");
  let q = supabase
    .from("transaksi")
    .select("order_id, paket_id, jumlah, status, dibuat, diperbarui")
    .eq("user_id", user.id);
  q = orderId ? q.eq("order_id", orderId) : q.order("dibuat", { ascending: false }).limit(1);
  const { data: tx, error } = await q.maybeSingle();

  if (error) {
    console.error("[payment/status]", error.message);
    return NextResponse.json({ error: "Gagal membaca status." }, { status: 500 });
  }
  if (!tx) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  /* "lunas" di transaksi ditulis SEBELUM aktifkan_pro() jalan, dan dibalikin
     kalau aktivasinya gagal. Jadi "aktif" baru dibilang aktif kalau is_pro()
     juga udah bilang iya — biar layar segel 極 gak muncul sedetik terlalu cepat. */
  const [{ data: pro }, { data: profil }] = await Promise.all([
    supabase.rpc("is_pro"),
    supabase.from("profiles").select("premium_until, is_lifetime").eq("id", user.id).single(),
  ]);

  const aktif = tx.status === "lunas" && pro === true;

  return NextResponse.json({
    order_id: tx.order_id,
    paket_id: tx.paket_id,
    jumlah: tx.jumlah,
    /* pending | lunas | gagal | kadaluarsa | refund */
    status: aktif ? "aktif" : tx.status === "lunas" ? "pending" : tx.status,
    dibuat: tx.dibuat,
    diperbarui: tx.diperbarui,
    premium_until: profil?.premium_until ?? null,
    is_lifetime: profil?.is_lifetime === true,
  }, { headers: { "Cache-Control": "no-store" } });
}
