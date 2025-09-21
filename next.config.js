/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'instagram.*.fna.fbcdn.net' },
      { protocol: 'https', hostname: 'instagram.*' },
      { protocol: 'https', hostname: '*.fbcdn.net' },
      { protocol: 'https', hostname: 'scontent.*.fbcdn.net' },
    ],
  },
};

module.exports = nextConfig;
