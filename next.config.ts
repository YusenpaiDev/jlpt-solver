import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Font TTF kartu pamer dibaca pakai fs di /api/kartu-pamer — pastiin ikut ke fungsi server. */
  outputFileTracingIncludes: {
    "/api/kartu-pamer": ["./assets/fonts/**/*"],
  },
  /* Nav 5 menu (HANDOFF-alur-belajar §6): halaman lama pindah jadi tab. Query ikut kebawa. */
  async redirects() {
    return [
      { source: "/bank-soal", destination: "/latihan/set", permanent: true },
      { source: "/lembar-tugas", destination: "/latihan/tugas", permanent: true },
      { source: "/catatan", destination: "/kamus/catatan", permanent: true },
    ];
  },
};

export default nextConfig;
