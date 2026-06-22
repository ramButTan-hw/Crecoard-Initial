import type { NextConfig } from "next";

// When building for Electron production, ELECTRON_BUILD=1 triggers static export.
// Dev and regular web builds work normally without it.
const isElectronBuild = process.env.ELECTRON_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isElectronBuild ? { output: "export", trailingSlash: true } : {}),
  images: { unoptimized: true },
  transpilePackages: ["@plancraft/ui", "@plancraft/db"],
};

export default nextConfig;
