import "server-only";

/**
 * Kirim email pemberitahuan ke admin (ADMIN_EMAILS) lewat Resend.
 * RESEND_API_KEY belum diisi → dilewati diam-diam; datanya tetap ada di /admin.
 * Gak pernah ngelempar: gagal kirim email gak boleh gagalin aksi user.
 */
export async function kirimEmailAdmin(subjek: string, teks: string): Promise<void> {
  const kunci = process.env.RESEND_API_KEY?.trim();
  const ke = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!kunci || ke.length === 0) return;
  // Tanpa domain terverifikasi, Resend cuma boleh kirim dari onboarding@resend.dev
  // ke email pemilik akun Resend.
  const dari = process.env.EMAIL_DARI?.trim() || "Honix JLPT <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${kunci}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: dari, to: ke, subject: subjek, text: teks }),
    });
    if (!res.ok) console.error("[email-admin] gagal kirim:", res.status, (await res.text()).slice(0, 200));
  } catch (err) {
    console.error("[email-admin]", err instanceof Error ? err.message : err);
  }
}
