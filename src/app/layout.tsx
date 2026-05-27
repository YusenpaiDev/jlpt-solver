import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope, Space_Grotesk, Noto_Serif_JP, Noto_Sans_JP, JetBrains_Mono } from "next/font/google";
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
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      <body className="min-h-screen bg-space">
        {/* ── Global AI background (v1) — pages opt into v2 via <AuroraBackground/> ── */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
          <div className="stars" />
          <div className="ai-ring ai-ring-1" />
          <div className="ai-ring ai-ring-2" />
          <div className="ai-ring ai-ring-3" />
          <div className="particle particle-1" />
          <div className="particle particle-2" />
          <div className="particle particle-3" />
          <div className="particle particle-4" />
        </div>
        {children}
      </body>
    </html>
  );
}
