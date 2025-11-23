/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      
      {
        protocol: "https",
        hostname: "www.teslarati.com",
      },
      {
        protocol: "https",
        hostname: "www.notateslaapp.com",
      },
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
      {
        protocol: "https",
        hostname: "s.w.org",
      },
      {
        protocol: "https",
        hostname: "electrek.co",
      },
    ],
  },
};

export default nextConfig;

