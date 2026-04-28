import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* ─── Plan definitions ─────────────────────────────────────────── */
const PLANS: Record<string, { name: string; amount: number }> = {
  "pro-monthly":    { name: "Sensei JLPT Pro - Bulanan",   amount: 49_000  },
  "pro-yearly":     { name: "Sensei JLPT Pro - Tahunan",   amount: 399_000 },
  "sensei-monthly": { name: "Sensei JLPT Sensei - Bulanan", amount: 149_000 },
  "sensei-yearly":  { name: "Sensei JLPT Sensei - Tahunan", amount: 799_000 },
};

const IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === "true";
const MIDTRANS_BASE = IS_PRODUCTION
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json();

    const plan = PLANS[planId];
    if (!plan) {
      return NextResponse.json({ error: "Plan tidak valid" }, { status: 400 });
    }

    /* ── Get current user ── */
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Kamu harus login dulu" }, { status: 401 });
    }

    /* ── Get profile for display name ── */
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    const orderId = `SJLPT-${user.id.slice(0, 8)}-${planId}-${Date.now()}`;

    /* ── Create Midtrans Snap transaction ── */
    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const authHeader = "Basic " + Buffer.from(serverKey + ":").toString("base64");

    const body = {
      transaction_details: {
        order_id: orderId,
        gross_amount: plan.amount,
      },
      customer_details: {
        email: user.email,
        first_name: profile?.username || user.email?.split("@")[0] || "Pengguna",
      },
      item_details: [
        {
          id: planId,
          price: plan.amount,
          quantity: 1,
          name: plan.name,
        },
      ],
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_SITE_URL}/premium/sukses`,
        error:  `${process.env.NEXT_PUBLIC_SITE_URL}/premium`,
        pending: `${process.env.NEXT_PUBLIC_SITE_URL}/premium`,
      },
    };

    const midtransRes = await fetch(MIDTRANS_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    const midtransData = await midtransRes.json();

    if (!midtransRes.ok) {
      console.error("Midtrans error:", midtransData);
      return NextResponse.json(
        { error: "Gagal membuat transaksi. Coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      snapToken: midtransData.token,
      orderId,
    });
  } catch (err) {
    console.error("Payment create error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
