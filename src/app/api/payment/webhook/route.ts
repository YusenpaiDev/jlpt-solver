import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { PAKET, adalahPaket } from "@/lib/paket";

/**
 * Notifikasi pembayaran dari Midtrans.
 *
 * Tiga hal yang salah di versi sebelumnya:
 *
 *   1. Baca env `SUPABASE_SERVICE_ROLE_KEY` — nama itu gak pernah ada di
 *      project ini (yang ada `SUPABASE_SECRET_KEY`). Jadi klien admin-nya
 *      dibikin pakai `undefined`, dan aktivasi premium gak akan pernah jalan.
 *
 *   2. Nyari pemilik pembayaran dari 8 karakter pertama UUID yang dititipin
 *      di order_id, pakai `LIKE '<8 karakter>%'` + `limit(1)`. Dua user yang
 *      prefix UUID-nya kebetulan sama = premium nyasar ke akun orang lain.
 *      Sekarang dicari lewat tabel `transaksi`, yang barisnya ditulis waktu
 *      pembayaran dimulai.
 *
 *   3. Gak ngecek nominal. Signature Midtrans emang udah ngunci
 *      order_id+status+gross_amount, tapi nominalnya gak pernah dicocokin
 *      sama harga paket yang kita simpan — jadi kalau ada yang bisa bikin
 *      transaksi Rp1.000 buat order paket Rp129.000, tetap lolos.
 */

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SECRET_KEY!.trim(),
    { auth: { persistSession: false } }
  );

/** SHA512(order_id + status_code + gross_amount + server_key) — aturan Midtrans. */
function tandaTanganCocok(
  orderId: string, statusCode: string, grossAmount: string,
  serverKey: string, dikirim: string,
): boolean {
  const harusnya = createHash("sha512")
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest("hex");
  return harusnya === dikirim;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      order_id, status_code, gross_amount, signature_key,
      transaction_status, fraud_status,
    } = body;

    const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
    if (!serverKey) {
      console.error("[webhook] MIDTRANS_SERVER_KEY belum di-set — notifikasi gak bisa diverifikasi");
      return NextResponse.json({ error: "Belum dikonfigurasi" }, { status: 503 });
    }

    if (!tandaTanganCocok(order_id, status_code, gross_amount, serverKey, signature_key)) {
      console.warn("[webhook] tanda tangan gak cocok:", order_id);
      return NextResponse.json({ error: "Tanda tangan tidak sah" }, { status: 403 });
    }

    const sb = admin();
    const { data: tx } = await sb
      .from("transaksi")
      .select("order_id, user_id, paket_id, jumlah, status")
      .eq("order_id", order_id)
      .single();

    if (!tx) {
      /* Tanda tangannya sah tapi ordernya gak kita kenal — biasanya sisa tes
         lama atau salah environment. Balas 200 biar Midtrans berhenti nyoba
         ulang; gak ada yang bisa kita kerjain. */
      console.warn("[webhook] order gak dikenal:", order_id);
      return NextResponse.json({ received: true });
    }

    /* Midtrans ngirim ulang notifikasi yang sama sampai dibalas 200. Tanpa
       gerbang ini, satu pembayaran bisa nambah masa berlaku berkali-kali.
       Ini cuma jalan pintas — penjaga yang sebenarnya klaim atomik di bawah. */
    if (tx.status === "lunas") {
      return NextResponse.json({ received: true, catatan: "sudah diproses" });
    }

    const sukses =
      (transaction_status === "capture" && fraud_status === "accept") ||
      transaction_status === "settlement";

    if (!sukses) {
      const status =
        transaction_status === "expire" ? "kadaluarsa"
        : ["deny", "cancel", "failure"].includes(transaction_status) ? "gagal"
        : "pending";
      /* neq lunas: notifikasi telat (mis. `pending` yang nyampe sesudah
         `settlement`) gak boleh nurunin transaksi yang udah lunas. */
      await sb.from("transaksi")
        .update({ status, midtrans: body, diperbarui: new Date().toISOString() })
        .eq("order_id", order_id)
        .neq("status", "lunas");
      return NextResponse.json({ received: true });
    }

    /* Nominal harus sama persis sama harga paket yang kita simpan. */
    if (!adalahPaket(tx.paket_id)) {
      console.error("[webhook] paket gak dikenal di transaksi:", tx.paket_id);
      return NextResponse.json({ received: true });
    }
    const paket = PAKET[tx.paket_id];
    if (Math.round(Number(gross_amount)) !== paket.harga) {
      console.error(
        `[webhook] nominal gak cocok buat ${order_id}: dibayar ${gross_amount}, harga ${paket.harga}`
      );
      await sb.from("transaksi")
        .update({ status: "gagal", midtrans: body, diperbarui: new Date().toISOString() })
        .eq("order_id", order_id);
      return NextResponse.json({ received: true });
    }

    /* Klaim DULU, baru aktifkan. Pembayaran kartu ngirim `capture` lalu
       `settlement` — dua-duanya sukses, dan kalau nyampe hampir barengan,
       dua-duanya lolos gerbang `tx.status` di atas (sama-sama baca "pending").
       Versi lama aktifkan dulu baru nandain lunas, jadi masa Pro nambah dua kali.
       UPDATE bersyarat ini atomik: Postgres ngunci barisnya, yang kedua nunggu,
       lalu nilai ulang `status <> 'lunas'` → 0 baris → mundur. */
    const { data: klaim, error: eKlaim } = await sb.from("transaksi")
      .update({ status: "lunas", midtrans: body, diperbarui: new Date().toISOString() })
      .eq("order_id", order_id)
      .neq("status", "lunas")
      .select("order_id");
    if (eKlaim) {
      console.error("[webhook] gagal klaim transaksi:", eKlaim.message);
      return NextResponse.json({ error: "Kesalahan server" }, { status: 500 });
    }
    if (!klaim?.length) {
      return NextResponse.json({ received: true, catatan: "sudah diproses" });
    }

    const { data: sampai, error: eAktif } = await sb.rpc("aktifkan_pro", {
      p_user_id: tx.user_id,
      p_bulan: paket.bulan,
    });
    if (eAktif) {
      /* JANGAN balas 200 — biar Midtrans coba lagi. Uangnya udah masuk;
         yang gagal cuma aktivasinya, dan itu harus diulang. Klaimnya dilepas
         dulu, kalau nggak percobaan ulang ketahan "sudah diproses". */
      console.error("[webhook] gagal aktifkan Pro:", eAktif.message);
      await sb.from("transaksi")
        .update({ status: tx.status, diperbarui: new Date().toISOString() })
        .eq("order_id", order_id);
      return NextResponse.json({ error: "Aktivasi gagal" }, { status: 500 });
    }

    console.log(
      `[webhook] Pro aktif buat ${tx.user_id} · ${paket.id} · ` +
      (paket.bulan === null ? "selamanya" : `sampai ${sampai}`)
    );
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[webhook] error:", e);
    return NextResponse.json({ error: "Kesalahan server" }, { status: 500 });
  }
}
