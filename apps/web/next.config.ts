import type { NextConfig } from 'next';

const config: NextConfig = {
  // The contracts package ships compiled ESM; nothing to transpile.
  poweredByHeader: false,
  reactStrictMode: true,
  // Standalone output: the Docker image of spec 010 copies only what runs.
  output: 'standalone',
};

export default config;
