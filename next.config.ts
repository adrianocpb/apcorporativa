import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  // Aplicação autenticada e personalizada por usuário: todas as páginas são dinâmicas.
  // Cache Components fica desligado para que nenhuma sessão ou permissão seja servida de cache.
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      // Arquivos servidos pela plataforma podem ser exibidos em iframe da própria aplicação (PDF).
      { source: "/:path((?!api/arquivos/).*)", headers: securityHeaders },
      {
        source: "/api/arquivos/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
