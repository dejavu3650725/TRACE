import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Curriculum files remain the single source of truth outside PostgreSQL.
  // Include them in every server trace because the loader discovers the actual
  // source paths from its manifest at runtime.
  outputFileTracingIncludes: {
    "/*": ["./Curriculum JSON/**/*.json"],
  },
};

export default nextConfig;
