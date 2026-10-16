import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'prisma', 'pg', '@prisma/adapter-pg'],
  experimental: {
    optimizePackageImports: ['recharts'],
    // Desligado: com o cache em disco do Turbopack no build (padrão desde o Next
    // 16.3) e o `.next/cache` que a Vercel restaura entre deploys, o build de
    // 2026-10-16 saiu com o JavaScript novo e o CSS do deploy anterior — sem o verde
    // da marca e sem a régua do /orcamento. Reproduzido localmente: build de um
    // commit antigo, depois do atual sobre o mesmo cache. Religar só com prova de
    // que o defeito foi corrigido no Next.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
