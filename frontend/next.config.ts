import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Production builds are a static export (`out/`) served by the FastAPI backend.
// `next dev` can't serve the API itself, so it proxies /api to the backend.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export default function nextConfig(phase: string): NextConfig {
  const config: NextConfig = {
    // Don't generate AGENTS.md on `next dev`.
    agentRules: false,
    // Emit /nda/index.html etc. so FastAPI's StaticFiles can serve every route.
    trailingSlash: true,
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    config.rewrites = async () => [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  } else {
    config.output = "export";
  }
  return config;
}
