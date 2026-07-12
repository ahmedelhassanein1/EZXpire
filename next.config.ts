import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include root prompt file in serverless bundles (Vercel does not
  // auto-trace loose .txt reads via process.cwd()).
  outputFileTracingIncludes: {
    "/api/parse-receipt": ["./QueryPrompt.txt"],
  },
};

export default nextConfig;
