import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope, Noto_Serif_JP, Noto_Sans_JP, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

// v1 fonts (existing pages still depend on these — keep until last v1 page migrates)
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
/* Space Grotesk di-host sendiri (file dari Google Fonts, subset latin, variabel
   400–700). Build production di Vercel gagal 8 Okt 2026 pas next/font/google
   ngunduh font ini ("next/font/google queries have exactly one entry"),
   padahal build lokal & preview sebelumnya lolos. File lokal = gak bergantung
   jaringan pas build. */
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
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      </body>
    </html>
  );
}
