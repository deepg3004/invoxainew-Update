const path = require("path");

// Load the single root .env so NEXT_PUBLIC_* values are inlined at build time
// and server env is populated regardless of the per-app working directory.
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS — let Next transpile them.
  transpilePackages: [
    "@invoxai/ui",
    "@invoxai/db",
    "@invoxai/utils",
    "@invoxai/auth",
    "@invoxai/config",
  ],
  // Native/CJS deps that should NOT be bundled into server output.
  serverExternalPackages: ["@prisma/client", ".prisma/client", "ioredis"],
};

module.exports = nextConfig;
