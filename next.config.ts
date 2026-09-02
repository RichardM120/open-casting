import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The spreadsheet library is CommonJS with its own streams; Node loads it as
  // it is rather than the bundler rewriting it.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
