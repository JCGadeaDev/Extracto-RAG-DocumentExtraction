import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "unpdf", "@napi-rs/canvas"],
};

export default nextConfig;
