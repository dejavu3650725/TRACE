import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // One request carries one file. Leave multipart boundary headroom above the
    // 30MB PDF product limit; image batches are sent sequentially.
    serverActions: { bodySizeLimit: "31mb" },
  },
  // Curriculum files remain the single source of truth outside PostgreSQL.
  // Include them in every server trace because the loader discovers the actual
  // source paths from its manifest at runtime.
  outputFileTracingIncludes: {
    "/*": ["./Curriculum JSON/**/*.json"],
  },
};

export default nextConfig;
