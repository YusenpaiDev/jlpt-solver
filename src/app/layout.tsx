import type { Metadata } from "next";
import { Noto_Serif_JP, Noto_Sans_JP } from "next/font/google";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { HonixLevelUp } from "@/components/honix/HonixLevelUp";
import "./globals.css";

// v1 fonts (existing pages still depend on these — keep until last v1 page migrates)
/* Font latin di-host sendiri (file dari Google Fonts, subset latin, variabel).
   Build Vercel berkali-kali gagal acak pas next/font/google ngunduh font
   ("next/font/google queries have exactly one entry") — 8 Okt 2026 kena Space
   Grotesk, lalu JetBrains Mono. File lokal = build gak bergantung jaringan.
   Noto JP tetap dari Google: dipecah ratusan potongan unicode-range. */
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-latin.woff2",
  variable: "--font-jakarta",
  weight: "400 800",
  display: "swap",
});
const manrope = localFont({
  src: "./fonts/Manrope-latin.woff2",
  variable: "--font-manrope",
  weight: "400 700",
  display: "swap",
});
const spaceGrotesk = localFont({
  src: "./fonts/SpaceGrotesk-latin.woff2",
  variable: "--font-space",
  weight: "400 700",
  display: "swap",
});

// v2 fonts (warm earthy redesign)
const notoSerifJp = Noto_Serif_JP({
  variable: "--font-serif-jp",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const notoSansJp = Noto_Sans_JP({
  variable: "--font-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-latin.woff2",
  variable: "--font-mono",
  weight: "400 500",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sensei JLPT",
  description: "Taklukan JLPT dengan Presisi AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${manrope.variable} ${spaceGrotesk.variable} ${GeistSans.variable} ${notoSerifJp.variable} ${notoSansJp.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen app-canvas">
        {children}
        <HonixLevelUp />
      </body>
    </html>
  );
}
