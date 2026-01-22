/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false, // Enable TypeScript checking for production
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Performance optimizations (swcMinify is now automatic in Next.js 16)
  poweredByHeader: false,
  reactStrictMode: true,
  // Enable compression
  compress: true,
}

export default nextConfig
