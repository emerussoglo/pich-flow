/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure server components / server actions handle environment variables properly
  serverExternalPackages: ['@libsql/client'],
};

export default nextConfig;

