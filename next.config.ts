import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Font TTF kartu pamer dibaca pakai fs di /api/kartu-pamer — pastiin ikut ke fungsi server. */
  outputFileTracingIncludes: {
    "/api/kartu-pamer": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
