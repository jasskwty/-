import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // مكتبة Claude تشتغل في السيرفر فقط
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
