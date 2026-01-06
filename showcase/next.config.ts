import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@heilgar/file-storage-adapter-core',
    '@heilgar/file-storage-adapter-fs',
    '@heilgar/file-storage-adapter-vercel-blob',
  ],
};

export default nextConfig;
