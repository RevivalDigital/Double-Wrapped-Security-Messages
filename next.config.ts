import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Enable React Strict Mode for better development experience */
  reactStrictMode: true,

  /* Experimental features for better performance */
  experimental: {
    // Enable turbopack for faster builds (Next.js 16+)
    turbo: {
      // Configure turbopack if needed
    },
  },

  /* Image optimization configuration */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow images from PocketBase
      },
    ],
  },

  /* Webpack configuration for better bundle size */
  webpack: (config) => {
    // Optimize bundle size by excluding unnecessary dependencies
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },

  /* Environment variables to expose to the client */
  env: {
    NEXT_PUBLIC_PB_URL: process.env.NEXT_PUBLIC_PB_URL,
  },
};

export default nextConfig;