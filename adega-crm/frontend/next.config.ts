import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  // Lint runs as an explicit CI step; Next 15's legacy build bridge is not
  // compatible with this workspace's flat ESLint configuration.
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    const api = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/static/:path*', destination: `${api}/static/:path*` },
    ];
  },
};

export default nextConfig;
