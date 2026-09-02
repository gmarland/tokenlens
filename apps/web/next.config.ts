import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";

// Turborepo starts Next.js with apps/web as its working directory. Load the
// repository-wide environment before Auth.js and Next.js read process.env.
loadEnvironment({ path: new URL("../../.env", import.meta.url), quiet: true });

export default {
  transpilePackages: ["@tokenlens/analytics", "@tokenlens/database"],
  allowedDevOrigins: ["127.0.0.1"],
} satisfies NextConfig;
