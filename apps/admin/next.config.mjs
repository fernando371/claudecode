/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Não gerar arquivos de instrução para agentes dentro do projeto.
  agentRules: false,
  // Cabeçalhos de segurança para o painel.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
