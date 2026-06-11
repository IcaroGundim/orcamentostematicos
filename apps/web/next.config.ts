import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'prisma', 'pg', '@prisma/adapter-pg'],
  experimental: {
    optimizePackageImports: ['recharts'],
  },
};

export default nextConfig;
