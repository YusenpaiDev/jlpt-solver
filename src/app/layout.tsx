import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

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
      className={`${jakarta.variable} ${manrope.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-space">
        {/* ── Global AI background ── */}
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
