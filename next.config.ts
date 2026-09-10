import type { NextConfig } from "next";

const firebaseAuthHost = `https://${(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "leading-lights-global-platform").trim()}.firebaseapp.com`;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  // Serve Firebase's auth handler from our own domain so Google sign-in works in
  // storage-partitioned browsers (iOS Safari). See lib/firebase/config.ts.
  async rewrites() {
    return [
      { source: "/__/auth/:path*", destination: `${firebaseAuthHost}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `${firebaseAuthHost}/__/firebase/:path*` },
    ];
  },
};

export default nextConfig;
