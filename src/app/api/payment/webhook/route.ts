import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

/* ─── Supabase admin client (bypasses RLS) ─────────────────────── */
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/* ─── Verify Midtrans signature ────────────────────────────────── */
function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  incomingSig: string
): boolean {
  const raw = orderId + statusCode + grossAmount + serverKey;
  const expected = createHash("sha512").update(raw).digest("hex");
  return expected === incomingSig;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = body;

    /* ── Verify signature ── */
    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    if (!verifySignature(order_id, status_code, gross_amount, serverKey, signature_key)) {
      console.warn("Invalid Midtrans signature for order:", order_id);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    /* ── Only process successful payments ── */
    const isSuccess =
      (transaction_status === "capture" && fraud_status === "accept") ||
      transaction_status === "settlement";

    if (!isSuccess) {
      // Not a success — acknowledge but do nothing
      return NextResponse.json({ received: true });
    }

    /* ── Extract user_id from order_id: SJLPT-{userId8}-{planId}-{ts} ── */
    // We stored only 8 chars of userId, need to find the full user
    // Order format: SJLPT-{user.id.slice(0,8)}-{planId}-{timestamp}
    const parts = order_id.split("-");
    // parts[0]=SJLPT, parts[1]=userId8, rest=planId parts + timestamp
    const userIdPrefix = parts[1];

    const supabase = adminClient();

    /* ── Find profile by id prefix ── */
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .like("id", `${userIdPrefix}%`)
      .limit(1);

    if (!profiles || profiles.length === 0) {
      console.error("User not found for order:", order_id);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = profiles[0].id;

    /* ── Update profile: set is_premium = true ── */
    const { error } = await supabase
      .from("profiles")
      .update({ is_premium: true })
      .eq("id", userId);

    if (error) {
      console.error("Failed to update profile:", error);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    console.log(`✓ Premium activated for user ${userId} (order: ${order_id})`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
