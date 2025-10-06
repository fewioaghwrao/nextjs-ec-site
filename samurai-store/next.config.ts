import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // 型エラーでも落としたくない場合は↓も（必要なければ外す）
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
