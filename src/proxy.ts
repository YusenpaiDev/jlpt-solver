import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/* Mode dev tanpa login (lihat src/lib/dev-beranda.ts). Sengaja ditulis
   langsung di file ini, bukan diimport: Next cuma bisa ganti env jadi
   literal & buang cabangnya kalau ekspresinya ada di modul yang sama. */
const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";

export async function proxy(request: NextRequest) {
  // Mode dev tanpa login — false di production.
  if (DEV_BYPASS) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  // (except login page itself and public routes)
  /* /api/payment/webhook WAJIB publik: yang manggil itu server Midtrans, dan
     dia gak punya sesi login. Tanpa ini middleware balas 307 ke /login,
     notifikasi pembayaran gak pernah sampai, dan Pro gak pernah nyala walau
     uangnya udah masuk. Keamanannya bukan dari sesi — payload-nya diverifikasi
     pakai tanda tangan SHA512 di route handler-nya. */
  const publicPaths = ["/login", "/premium", "/auth", "/api/payment/webhook"];
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Onboarding first-login: user login tapi belum kelarin onboarding → paksa ke
  // /onboarding (kecuali lagi di /onboarding atau route publik). Flag disimpan
  // di user_metadata.onboarding_completed. Lihat handoff onboarding.
  if (
    user &&
    !user.user_metadata?.onboarding_completed &&
    !request.nextUrl.pathname.startsWith("/onboarding") &&
    !isPublic
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
